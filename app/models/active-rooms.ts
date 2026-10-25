import { parseUtcMs } from "~/engine/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { GameState, stateFromGame } from "~/engine/state";
import type { Game } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import { getPlayerColor } from "~/utils";

/** How far back to look for activity when listing rooms in progress. */
export const ACTIVE_ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** At most this many rooms are inspected (and listed) per game. */
export const MAX_ACTIVE_ROOMS = 8;

export interface ActiveRoom {
  id: number;
  /** URL slug for /room/:roomName, e.g. "42-apple". */
  roomName: string;
  players: { name: string; color: string }[];
  /** Whole minutes since the room's last event. */
  minutesAgo: number;
}

/** summarizeActiveRoom replays a room's events and describes it for a "rooms
 * in progress" list. Returns null for rooms that should not be listed: nobody
 * is in them, the game is over, or their events can't be replayed. */
export function summarizeActiveRoom(
  game: Game,
  room: { id: number; name: string },
  events: DbRoomEvent[],
  now: number,
): ActiveRoom | null {
  const last = events.at(-1);
  if (!last) return null;

  let state;
  try {
    state = applyRoomEventsToState(stateFromGame(game), events);
  } catch {
    return null;
  }
  if (state.type === GameState.GameOver || state.players.size === 0) {
    return null;
  }

  const lastActivity = Math.max(...events.map((e) => parseUtcMs(e.ts)));
  return {
    id: room.id,
    roomName: `${room.id}-${room.name}`,
    players: Array.from(state.players.values()).map((p) => ({
      name: p.name,
      color: getPlayerColor(p),
    })),
    minutesAgo: Math.max(0, Math.floor((now - lastActivity) / 60_000)),
  };
}

/** formatTimeAgo renders a compact relative time for the rooms list. */
export function formatTimeAgo(minutes: number) {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}
