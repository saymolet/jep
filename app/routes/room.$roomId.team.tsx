import { z } from "zod";

import { ActionType } from "~/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { GameState, stateFromGame } from "~/engine/state";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { createRoomEvent, getRoomEvents } from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";
import { TEAM_IDS } from "~/models/team";
import { requireSessionUserId } from "~/session.server";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/room.$roomId.team";

const formSchema = z.object({
  /** The player changing team: only yourself. */
  userId: z.string().min(1),
  /** The team to join, or "" to play without a team. */
  team: z.union([z.enum(TEAM_IDS), z.literal("").transform(() => null)]),
});

/** Puts the player on a team (team mode) or takes them off it. */
export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const { userId, team } = parseFormData(formData, formSchema);

  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  if (roomId === -1) {
    return {
      type: ActionType.SetTeam,
      payload: { userId, team },
      ts: Date.now(),
    };
  }

  const authSession = await getValidAuthSession(request);
  await requireSessionUserId(request, userId, authSession);
  const room = await getRoom(roomId, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }

  // The engine ignores invalid changes on every client; checking here too
  // gives the player a clear error and keeps junk out of the room's events.
  const game = await getGame(room.game_id, authSession?.userId);
  if (!game) {
    throw new Response(t("room.error.gameNotFound"), { status: 404 });
  }
  const state = applyRoomEventsToState(
    stateFromGame(game),
    await getRoomEvents(room.id, authSession?.accessToken),
  );
  if (!state.players.has(userId)) {
    throw new Response(t("room.error.notInGame"), { status: 403 });
  }
  if (state.type === GameState.GameOver || state.activeClue !== null) {
    throw new Response(t("room.error.teamsBetweenQuestions"), {
      status: 409,
    });
  }

  await createRoomEvent(
    room.id,
    ActionType.SetTeam,
    { userId, team },
    authSession?.accessToken,
  );

  return null;
}
