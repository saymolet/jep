import { applyRoomEventsToState } from "~/engine/room-event";
import { stateFromGame } from "~/engine/state";
import type { createT } from "~/i18n";
import type { AuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { getRoomEvents } from "~/models/room-event.server";

/** getRoomState replays a room's events into its current game state (for
 * routes that check an action against the game before inserting it). 404
 * when the room's game is gone. */
export async function getRoomState(
  room: { id: number; game_id: string },
  authSession: Pick<AuthSession, "userId" | "accessToken"> | null,
  t: ReturnType<typeof createT>,
) {
  const game = await getGame(room.game_id, authSession?.userId);
  if (!game) {
    throw new Response(t("room.error.gameNotFound"), { status: 404 });
  }
  const state = applyRoomEventsToState(
    stateFromGame(game),
    await getRoomEvents(room.id, authSession?.accessToken),
  );
  return { game, state };
}
