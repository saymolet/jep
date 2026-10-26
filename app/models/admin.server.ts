/** Data access for the admin panel (`/admin`). Server only, always with the
 * service-role client: callers must have passed `requireAdmin` first. */

import { z } from "zod";

import { ADMIN_PAGE_SIZE } from "~/admin/constants";
import {
  findOrphans,
  type GameClueMediaRow,
  type MediaObject,
  planGameMediaDeletion,
  referencedPaths,
} from "~/admin/media-refs";
import { parseUtcMs } from "~/engine/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { GameState, stateFromGame } from "~/engine/state";
import { summarizePlayers } from "~/models/active-rooms";
import type { Game } from "~/models/convert.server";
import { getGame, type GameVisibility } from "~/models/game.server";
import { getRoomEvents } from "~/models/room-event.server";
import { GAME_MEDIA_BUCKET } from "~/models/siq/media-store.server";
import { getSupabaseAdmin } from "~/supabase/admin.server";

/** Storage removes at most this many files per request. */
const REMOVE_BATCH = 1000;
/** Rows per request when reading every media-carrying clue. */
const CLUE_PAGE_SIZE = 1000;

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

function pageRange(page: number) {
  const from = (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE;
  return { from, to: from + ADMIN_PAGE_SIZE - 1 };
}

/* Dashboard */

const AdminStatsSchema = z.object({
  games_public: z.number(),
  games_unlisted: z.number(),
  games_private: z.number(),
  accounts: z.number(),
  rooms: z.number(),
  rooms_active_24h: z.number(),
  rooms_active_7d: z.number(),
  room_events: z.number(),
  reports: z.number(),
  media_objects: z.number(),
  media_bytes: z.number(),
  database_bytes: z.number(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_stats");
  if (error) fail(error);
  return AdminStatsSchema.parse(data);
}

/* Games */

/** searchFilter builds a PostgREST `or` filter matching every word in the
 * title or every word in the author. `.or` takes raw filter syntax, so only
 * letters (any language), digits and spaces are kept. */
export function searchFilter(search: string | null): string | null {
  const words = (search ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (words.length === 0) return null;
  return ["title", "author"]
    .map(
      (column) =>
        `and(${words.map((w) => `${column}.ilike.*${w}*`).join(",")})`,
    )
    .join(",");
}

export interface AdminGameRow {
  id: string;
  title: string;
  author: string;
  visibility: GameVisibility;
  created_at: string;
  uploaderEmail: string | null;
  questions: number;
}

interface GameRowWithJoins {
  id: string;
  title: string;
  author: string;
  visibility: GameVisibility;
  created_at: string;
  accounts: { email: string } | null;
  categories: { clues: { count: number }[] }[];
}

const GAME_COLUMNS =
  "id, title, author, visibility, created_at, accounts(email), categories(clues(count))";

function toAdminGameRow(row: GameRowWithJoins): AdminGameRow {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    visibility: row.visibility,
    created_at: row.created_at,
    uploaderEmail: row.accounts?.email ?? null,
    questions: row.categories.reduce(
      (sum, c) => sum + (c.clues[0]?.count ?? 0),
      0,
    ),
  };
}

export async function listAdminGames({
  page,
  search,
}: {
  page: number;
  search: string | null;
}): Promise<{ games: AdminGameRow[]; total: number }> {
  const { from, to } = pageRange(page);
  let query = getSupabaseAdmin()
    .from("games")
    .select<string, GameRowWithJoins>(GAME_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  const filter = searchFilter(search);
  if (filter) query = query.or(filter);
  const { data, error, count } = await query;
  if (error) fail(error);
  return { games: data.map(toAdminGameRow), total: count ?? 0 };
}

export interface AdminReport {
  id: number;
  game_id: string;
  game_title: string | null;
  reason: string;
  created_at: string;
  reporterEmail: string | null;
}

interface ReportRowWithJoins {
  id: number;
  game_id: string;
  reason: string;
  created_at: string;
  games: { title: string } | null;
  accounts: { email: string } | null;
}

const REPORT_COLUMNS =
  "id, game_id, reason, created_at, games(title), accounts(email)";

function toAdminReport(row: ReportRowWithJoins): AdminReport {
  return {
    id: row.id,
    game_id: row.game_id,
    game_title: row.games?.title ?? null,
    reason: row.reason,
    created_at: row.created_at,
    reporterEmail: row.accounts?.email ?? null,
  };
}

export interface AdminGameDetails extends AdminGameRow {
  rooms: number;
  reports: AdminReport[];
  /** Storage files deleted with the game / kept because another game uses
   * them. */
  media: { remove: string[]; keep: string[] };
}

export async function getAdminGame(
  gameId: string,
): Promise<AdminGameDetails | null> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("games")
    .select<string, GameRowWithJoins>(GAME_COLUMNS)
    .eq("id", gameId)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;

  const [rooms, reports, rows] = await Promise.all([
    client
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId),
    client
      .from("reports")
      .select<string, ReportRowWithJoins>(REPORT_COLUMNS)
      .eq("game_id", gameId)
      .order("created_at", { ascending: false }),
    getAllClueMediaRows(),
  ]);
  if (rooms.error) fail(rooms.error);
  if (reports.error) fail(reports.error);

  return {
    ...toAdminGameRow(data),
    rooms: rooms.count ?? 0,
    reports: reports.data.map(toAdminReport),
    media: planGameMediaDeletion(gameId, rows),
  };
}

/** setAdminGameVisibility returns the game's title, or null when there is
 * no such game. */
export async function setAdminGameVisibility(
  gameId: string,
  visibility: GameVisibility,
): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("games")
    .update({ visibility })
    .eq("id", gameId)
    .select("title");
  if (error) fail(error);
  return data.at(0)?.title ?? null;
}

/** getAllClueMediaRows reads every clue that has media, with its game. */
export async function getAllClueMediaRows(): Promise<GameClueMediaRow[]> {
  const rows: GameClueMediaRow[] = [];
  for (let from = 0; ; from += CLUE_PAGE_SIZE) {
    const { data, error } = await getSupabaseAdmin()
      .from("clues")
      .select<
        string,
        {
          media: unknown;
          answer_media: unknown;
          image_src: string | null;
          categories: { game_id: string };
        }
      >("id, media, answer_media, image_src, categories!inner(game_id)")
      .or("media.not.is.null,answer_media.not.is.null,image_src.not.is.null")
      .order("id")
      .range(from, from + CLUE_PAGE_SIZE - 1);
    if (error) fail(error);
    for (const row of data) {
      rows.push({
        game_id: row.categories.game_id,
        media: row.media,
        answer_media: row.answer_media,
        image_src: row.image_src,
      });
    }
    if (data.length < CLUE_PAGE_SIZE) return rows;
  }
}

/** removeMediaFiles deletes files from the "game-media" bucket. */
export async function removeMediaFiles(paths: string[]) {
  const bucket = getSupabaseAdmin().storage.from(GAME_MEDIA_BUCKET);
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const { error } = await bucket.remove(paths.slice(i, i + REMOVE_BATCH));
    if (error) fail(error);
  }
}

/** deleteGameWithMedia deletes a game (its categories, questions, rooms,
 * room events, solves and reports go with it, by foreign-key cascade) and
 * then the Storage files only it used. The files are planned against every
 * other game's questions right before the delete. If removing files fails,
 * they are left behind as orphans for the Storage cleanup. */
export async function deleteGameWithMedia(
  gameId: string,
): Promise<{ title: string; removed: number; kept: number } | null> {
  const plan = planGameMediaDeletion(gameId, await getAllClueMediaRows());
  const { data, error } = await getSupabaseAdmin()
    .from("games")
    .delete()
    .eq("id", gameId)
    .select("title");
  if (error) fail(error);
  const game = data.at(0);
  if (!game) return null;
  await removeMediaFiles(plan.remove);
  return {
    title: game.title,
    removed: plan.remove.length,
    kept: plan.keep.length,
  };
}

/* Rooms */

export type AdminRoomStatus = "playing" | "finished" | "empty" | "unknown";

export interface AdminRoom {
  id: number;
  roomName: string;
  gameId: string;
  gameTitle: string;
  /** ISO time of the last event (UTC), or null without events. */
  lastActivity: string | null;
  events: number;
  status: AdminRoomStatus;
  players: string[];
}

function describeRoom(
  game: Game | null,
  events: Awaited<ReturnType<typeof getRoomEvents>>,
): Pick<AdminRoom, "status" | "players"> {
  if (events.length === 0) return { status: "empty", players: [] };
  if (!game) return { status: "unknown", players: [] };
  try {
    const state = applyRoomEventsToState(stateFromGame(game), events);
    return {
      status: state.type === GameState.GameOver ? "finished" : "playing",
      players: summarizePlayers(state).players.map((p) => p.name),
    };
  } catch {
    return { status: "unknown", players: [] };
  }
}

export async function listAdminRooms(
  page: number,
): Promise<{ rooms: AdminRoom[]; total: number }> {
  const client = getSupabaseAdmin();
  const { from } = pageRange(page);
  const [list, total] = await Promise.all([
    client.rpc("admin_recent_rooms", {
      max_count: ADMIN_PAGE_SIZE,
      skip: from,
    }),
    client.from("rooms").select("id", { count: "exact", head: true }),
  ]);
  if (list.error) fail(list.error);
  if (total.error) fail(total.error);

  const games = new Map<string, Promise<Game | null>>();
  const gameFor = (gameId: string) => {
    let game = games.get(gameId);
    if (!game) {
      game = getGame(gameId, undefined, { ignoreVisibility: true }).catch(
        () => null,
      );
      games.set(gameId, game);
    }
    return game;
  };

  const rooms = await Promise.all(
    list.data.map(async (room): Promise<AdminRoom> => {
      const [game, events] = await Promise.all([
        gameFor(room.game_id),
        getRoomEvents(room.room_id).catch(() => []),
      ]);
      return {
        id: room.room_id,
        roomName: `${room.room_id}-${room.room_name}`,
        gameId: room.game_id,
        gameTitle: room.game_title,
        lastActivity: room.last_activity
          ? new Date(parseUtcMs(room.last_activity)).toISOString()
          : null,
        events: room.event_count,
        ...describeRoom(game, events),
      };
    }),
  );
  return { rooms, total: total.count ?? 0 };
}

/** deleteRoom deletes a room; its events and solves go with it (cascade). */
export async function deleteRoom(roomId: number) {
  const { error } = await getSupabaseAdmin()
    .from("rooms")
    .delete()
    .eq("id", roomId);
  if (error) fail(error);
}

/* Reports */

export async function listReports(
  page: number,
): Promise<{ reports: AdminReport[]; total: number }> {
  const { from, to } = pageRange(page);
  const { data, error, count } = await getSupabaseAdmin()
    .from("reports")
    .select<string, ReportRowWithJoins>(REPORT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) fail(error);
  return { reports: data.map(toAdminReport), total: count ?? 0 };
}

export async function deleteReport(reportId: number) {
  const { error } = await getSupabaseAdmin()
    .from("reports")
    .delete()
    .eq("id", reportId);
  if (error) fail(error);
}

/* Storage cleanup */

async function getMediaObjects(): Promise<MediaObject[]> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_media_objects");
  if (error) fail(error);
  return data.map((o) => ({
    name: o.name,
    size: Number(o.size),
    created_at: o.created_at,
  }));
}

/** scanOrphans finds files of the "game-media" bucket that no question of
 * any game uses (and that are older than an hour, so a running import is
 * never caught). */
export async function scanOrphans(now = Date.now()) {
  const [objects, rows] = await Promise.all([
    getMediaObjects(),
    getAllClueMediaRows(),
  ]);
  return {
    objects: objects.length,
    ...findOrphans(objects, referencedPaths(rows), { now }),
  };
}

/** deleteOrphans scans again (never trusting a list sent by the browser) and
 * deletes what is orphaned now. */
export async function deleteOrphans(now = Date.now()) {
  const { orphans, bytes } = await scanOrphans(now);
  await removeMediaFiles(orphans.map((o) => o.name));
  return { count: orphans.length, bytes };
}
