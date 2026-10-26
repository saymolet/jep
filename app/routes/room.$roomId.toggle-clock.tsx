import { ActionType } from "~/engine";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { createRoomEventAsServer } from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";

import type { Route } from "./+types/room.$roomId.toggle-clock";

export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  if (roomId === -1) {
    return { type: ActionType.ToggleClock, ts: Date.now() };
  }

  const authSession = await getValidAuthSession(request);
  const room = await getRoom(roomId, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }

  await createRoomEventAsServer(room.id, ActionType.ToggleClock, null);

  return null;
}
