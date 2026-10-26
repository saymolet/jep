import { parseUtcMs } from "~/engine/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { rankByScore } from "~/engine/standings";
import { GameState, stateFromGame } from "~/engine/state";
import { type ActiveRoom, summarizePlayers } from "~/models/active-rooms";
import type { Game } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";

/** How far back to look for rooms in "Your games in progress". */
export const MY_ROOMS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** At most this many rooms are listed. */
export const MAX_MY_ROOMS = 6;

/** At most this many recently active rooms the user joined are replayed to
 * find the ones still in progress (some are over or were left). */
export const MAX_MY_ROOM_CANDIDATES = 12;

export interface MyRoom extends ActiveRoom {
  gameTitle: string;
  /** The user's score and place in the room (ties share a place). */
  score: number;
  rank: number;
}

/** summarizeMyRoom replays a room's events and describes it for "Your games
 * in progress". `userIds` are the ids the current user may play under, in
 * order of preference: their account id (when logged in), then the guest id
 * from their session cookie (a guest player is moved to the account when the
 * logged-in user opens the room, see ActionType.TransferPlayer).
 *
 * Returns null when the user isn't a player in the room (never joined, left
 * or was removed), the game is over, or the events can't be replayed. */
export function summarizeMyRoom(
  game: Game,
  room: { id: number; name: string },
  events: DbRoomEvent[],
  userIds: readonly string[],
  now: number,
): MyRoom | null {
  if (events.length === 0) return null;

  let state;
  try {
    state = applyRoomEventsToState(stateFromGame(game), events);
  } catch {
    return null;
  }
  if (state.type === GameState.GameOver) return null;

  const me = userIds
    .map((id) => state.players.get(id))
    .find((p) => p !== undefined);
  if (!me) return null;

  const ranked = rankByScore(
    Array.from(state.players.values()),
    (p) => p.score,
  );
  const rank = ranked.find(({ item }) => item === me)?.rank ?? 1;

  const lastActivity = Math.max(...events.map((e) => parseUtcMs(e.ts)));
  return {
    id: room.id,
    roomName: `${room.id}-${room.name}`,
    gameTitle: game.title,
    ...summarizePlayers(state),
    score: me.score,
    rank,
    minutesAgo: Math.max(0, Math.floor((now - lastActivity) / 60_000)),
  };
}
