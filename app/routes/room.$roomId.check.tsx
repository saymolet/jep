import { z } from "zod";

import { ActionType } from "~/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { stateFromGame } from "~/engine/state";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { createRoomEvent, getRoomEvents } from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";
import { requireSessionUserId } from "~/session.server";
import { hasChoices, isChoiceIndex, isCorrectChoice } from "~/utils/choices";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/room.$roomId.check";

const formSchema = z.object({
  i: z.coerce.number().int(),
  j: z.coerce.number().int(),
  userId: z.string(),
  /** "correct" / "incorrect" for a self-checked answer. */
  result: z.string().optional(),
  /** The option picked on a multiple choice question. */
  choice: z.coerce.number().int().optional(),
  /** "true" when the answering player's own device sends this because their
   * answer time ran out (answer timer). Always a wrong answer. */
  timedOut: z
    .literal("true")
    .transform(() => true)
    .optional(),
});

export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const { i, j, userId, result, choice, timedOut } = parseFormData(
    formData,
    formSchema,
  );
  // Running out of time is never a right answer.
  const claimedCorrect = !timedOut && result === "correct";
  const extra = {
    ...(choice === undefined ? {} : { choice }),
    ...(timedOut ? { timedOut } : {}),
  };

  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  if (roomId === -1) {
    // Solo play has no game on the server side; the engine checks the pick
    // against the answer itself (and ignores `correct` for it).
    return {
      type: ActionType.Check,
      payload: { i, j, userId, correct: claimedCorrect, ...extra },
      ts: Date.now(),
    };
  }

  const authSession = await getValidAuthSession(request);
  await requireSessionUserId(request, userId, authSession);
  const room = await getRoom(roomId, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }

  let correct = claimedCorrect;
  if (choice !== undefined) {
    // Multiple choice: decide correctness here from the game data, never from
    // the client. The engine re-checks it the same way on every client.
    const game = await getGame(room.game_id, authSession?.userId);
    if (!game) {
      throw new Response(t("room.error.gameNotFound"), { status: 404 });
    }
    const state = applyRoomEventsToState(
      stateFromGame(game),
      await getRoomEvents(room.id, authSession?.accessToken),
    );
    const clue = game.boards.at(state.round)?.categories.at(j)?.clues.at(i);
    if (!clue || !hasChoices(clue) || !isChoiceIndex(clue, choice)) {
      throw new Response(t("room.error.invalidChoice"), { status: 400 });
    }
    correct = isCorrectChoice(clue, choice);
  }

  await createRoomEvent(
    room.id,
    ActionType.Check,
    { i, j, userId, correct, ...extra },
    authSession?.accessToken,
  );

  return null;
}
