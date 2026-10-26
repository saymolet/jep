import { z } from "zod";

import { ActionType } from "~/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { GameState, stateFromGame } from "~/engine/state";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import {
  createRoomEventAsServer,
  getRoomEvents,
} from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";
import { normalizeTeamName, TEAM_IDS } from "~/models/team";
import { requireSessionUserId } from "~/session.server";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/room.$roomId.team-name";

const formSchema = z.object({
  /** The member renaming their team: only yourself. */
  userId: z.string().min(1),
  team: z.enum(TEAM_IDS),
  /** The new name; blank resets the default name. */
  name: z.string(),
});

/** Renames the player's own team (team mode). */
export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const { userId, team, name: rawName } = parseFormData(formData, formSchema);
  const name = normalizeTeamName(rawName);
  if (name === undefined) {
    throw new Response(t("room.error.teamNameTooLong"), { status: 400 });
  }

  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  if (roomId === -1) {
    return {
      type: ActionType.RenameTeam,
      payload: { userId, team, name },
      ts: Date.now(),
    };
  }

  const authSession = await getValidAuthSession(request);
  await requireSessionUserId(request, userId, authSession);
  const room = await getRoom(roomId, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }

  const game = await getGame(room.game_id, authSession?.userId);
  if (!game) {
    throw new Response(t("room.error.gameNotFound"), { status: 404 });
  }
  const state = applyRoomEventsToState(
    stateFromGame(game),
    await getRoomEvents(room.id, authSession?.accessToken),
  );
  if (state.players.get(userId)?.team !== team) {
    throw new Response(t("room.error.notOnTeam"), { status: 403 });
  }
  if (state.type === GameState.GameOver) {
    throw new Response(t("room.error.gameIsOver"), { status: 409 });
  }

  await createRoomEventAsServer(room.id, ActionType.RenameTeam, {
    userId,
    team,
    name,
  });

  return null;
}
