import { z } from "zod";

import { authorizeRoomActor } from "~/admin/room-actor.server";
import { ActionType } from "~/engine";
import { applyRoomEventsToState } from "~/engine/room-event";
import { getBuzzWindowMs } from "~/engine/room-timers";
import { GameState, stateFromGame } from "~/engine/state";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { mayCloseBuzzersYet } from "~/models/buzzers";
import {
  createRoomEventAsServer,
  getRoomEvents,
} from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/room.$roomId.buzzers";

const formSchema = z.object({
  intent: z.enum(["open", "close"]),
  userId: z.string().min(1),
  round: z.coerce.number().int(),
  i: z.coerce.number().int(),
  j: z.coerce.number().int(),
});

/** The buzzers of the open question (feature 27): the room's opener device —
 * the host's in host mode, else a player's — opens them once the question
 * is read, and closes them when the buzz time is over, so a lagging phone
 * never holds up the game. Requests that come too late (the question moved
 * on) are ignored; the event is inserted with the service role. */
export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }
  const formData = await request.formData();
  const form = parseFormData(formData, formSchema);
  // Solo play: the engine runs in the browser.
  if (roomId === -1) {
    const { userId, round, i, j } = form;
    return {
      type:
        form.intent === "open"
          ? ActionType.OpenBuzzers
          : ActionType.CloseBuzzers,
      payload: { userId, round, i, j },
      ts: Date.now(),
    };
  }
  const authSession = await getValidAuthSession(request);
  const actor = await authorizeRoomActor(
    request,
    formData,
    form.userId,
    authSession,
    t,
    roomId,
  );
  const room = await getRoom(roomId, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }
  const game = await getGame(room.game_id, authSession?.userId);
  if (!game) {
    throw new Response(t("room.error.gameNotFound"), { status: 404 });
  }
  const events = await getRoomEvents(room.id, authSession?.accessToken);
  const state = applyRoomEventsToState(stateFromGame(game), events);

  if (!actor.admin) {
    if (state.host ? !actor.host : !state.players.has(form.userId)) {
      throw new Response(t("room.error.hostRunsGame"), { status: 403 });
    }
  }
  const { round, i, j } = form;
  const current =
    state.type === GameState.ReadClue &&
    state.round === round &&
    state.activeClue?.[0] === i &&
    state.activeClue[1] === j;
  // Another device already did it, or the question moved on: nothing to do.
  if (!current) return null;
  if (form.intent === "open" ? state.buzzersOpen : !state.buzzersOpen) {
    return null;
  }
  // Players' devices may only close the buzzers once the buzz time is
  // over; the host and the admin may close them any time.
  if (
    form.intent === "close" &&
    !actor.admin &&
    !actor.host &&
    !mayCloseBuzzersYet(events, form, getBuzzWindowMs(state), Date.now())
  ) {
    return null;
  }

  await createRoomEventAsServer(
    room.id,
    form.intent === "open" ? ActionType.OpenBuzzers : ActionType.CloseBuzzers,
    { userId: form.userId, round, i, j, ...actor },
  );
  return null;
}
