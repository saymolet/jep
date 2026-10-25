import { z } from "zod";

import { ActionType } from "~/engine";
import { isAnswerTimeSec } from "~/engine/answer-timer";
import { applyRoomEventsToState } from "~/engine/room-event";
import { GameState, stateFromGame } from "~/engine/state";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { createRoomEvent, getRoomEvents } from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";
import { requireSessionUserId } from "~/session.server";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/room.$roomId.settings";

const formSchema = z.object({
  /** The player changing the settings: any player, only as themselves. */
  userId: z.string().min(1),
  /** Seconds for the answer timer, 0 = off. */
  answerTimeSec: z.coerce.number().int().refine(isAnswerTimeSec),
  /** "true" / "false": mark the answer wrong when the time runs out. */
  autoWrongOnTimeout: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Changes the room settings (the answer timer). Last change wins. */
export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const { userId, answerTimeSec, autoWrongOnTimeout } = parseFormData(
    formData,
    formSchema,
  );
  const payload = { userId, answerTimeSec, autoWrongOnTimeout };

  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  if (roomId === -1) {
    return { type: ActionType.SetSettings, payload, ts: Date.now() };
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
  if (state.type === GameState.GameOver) {
    throw new Response(t("room.error.gameIsOver"), { status: 409 });
  }
  if (state.activeClue !== null) {
    throw new Response(t("room.error.settingsBetweenQuestions"), {
      status: 409,
    });
  }

  await createRoomEvent(
    room.id,
    ActionType.SetSettings,
    payload,
    authSession?.accessToken,
  );

  return null;
}
