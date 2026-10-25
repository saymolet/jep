import {
  ACTIVE_ROOM_MAX_AGE_MS,
  type ActiveRoom,
  MAX_ACTIVE_ROOMS,
  summarizeActiveRoom,
} from "~/models/active-rooms";
import { AuthSession } from "~/models/auth";
import type { Database } from "~/models/database.types";
import type { Game } from "~/models/game.server";
import { getRoomEvents } from "~/models/room-event.server";
import { getSupabase } from "~/supabase";
import { getRandomWord } from "~/utils";

type RoomTable = Database["public"]["Tables"]["rooms"];
type Room = RoomTable["Row"];

/* Reads */

export async function getRoom(
  roomId: number,
  accessToken?: AuthSession["accessToken"],
): Promise<Room | null> {
  const client = getSupabase(accessToken);
  const { data, error } = await client
    .from<"rooms", RoomTable>("rooms")
    .select("*")
    .eq("id", roomId);

  if (error !== null) {
    throw new Error(error.message);
  }

  const room = data.at(0);
  if (!room) {
    return null;
  }

  return room;
}

/** getRoomByName finds a room by its URL name ("<id>-<word>", e.g.
 * "42-apple"). Null when there is no such room or the word doesn't match. */
export async function getRoomByName(
  roomName: string,
  accessToken?: AuthSession["accessToken"],
): Promise<Room | null> {
  const [idPart, word] = roomName.split("-");
  const roomId = parseInt(idPart);
  if (!Number.isFinite(roomId)) return null;
  const room = await getRoom(roomId, accessToken);
  if (!room || room.name !== word) return null;
  return room;
}

/** getActiveRooms lists the game's rooms that are still in progress: had
 * activity in the last ACTIVE_ROOM_MAX_AGE_MS, have players and aren't over.
 * Most recently active first.
 *
 * Rooms have no created_at, so recent rooms are found via their room_events:
 * one query returns the newest rooms (highest ids) that have a recent event,
 * then each candidate's events are replayed to get its players and state.
 */
export async function getActiveRooms(
  game: Game,
  accessToken?: AuthSession["accessToken"],
  now = Date.now(),
): Promise<ActiveRoom[]> {
  const client = getSupabase(accessToken);
  const since = new Date(now - ACTIVE_ROOM_MAX_AGE_MS).toISOString();
  const { data, error } = await client
    .from<"rooms", RoomTable>("rooms")
    .select("id, name, room_events!inner(ts)")
    .eq("game_id", game.id)
    .gte("room_events.ts", since)
    .order("id", { ascending: false })
    .limit(1, { referencedTable: "room_events" })
    .limit(MAX_ACTIVE_ROOMS);

  if (error !== null) {
    throw new Error(error.message);
  }

  const rooms = await Promise.all(
    data.map(async (room) =>
      summarizeActiveRoom(
        game,
        room,
        await getRoomEvents(room.id, accessToken),
        now,
      ),
    ),
  );

  return rooms
    .filter((room): room is ActiveRoom => room !== null)
    .sort((a, b) => a.minutesAgo - b.minutesAgo);
}

/* Writes */

export async function createRoom(gameId: string, accessToken?: string) {
  const client = getSupabase(accessToken);
  const word = getRandomWord();

  const { data, error } = await client
    .from<"rooms", RoomTable>("rooms")
    .insert<RoomTable["Insert"]>({ name: word, game_id: gameId })
    .select();

  if (error !== null) {
    throw new Error(error.message);
  }

  const room = data.at(0);
  if (!room) {
    throw new Error("room not created");
  }
  return room.id + "-" + word;
}
