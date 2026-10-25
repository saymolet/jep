import { ActionType } from "~/engine";
import { PlayerFormPayload } from "~/engine/actions";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { createRoomEvent } from "~/models/room-event.server";
import { getRoom } from "~/models/room.server";
import { getSolve, markAttempted } from "~/models/solves.server";
import { getUserSession, requireSessionUserId } from "~/session.server";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/room.$roomId.player";

async function getDeleteActionType(
  request: Request,
  targetUserId: string,
): Promise<ActionType> {
  // Check Supabase auth first, then fall back to guest cookie session.
  const authSession = await getValidAuthSession(request);
  const currentUserId = authSession?.userId ?? (await getUserSession(request));
  return currentUserId === targetUserId ? ActionType.Leave : ActionType.Kick;
}

export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  if (
    request.method !== "POST" &&
    request.method !== "PATCH" &&
    request.method !== "DELETE"
  ) {
    throw new Response(t("room.error.methodNotAllowed"), { status: 405 });
  }
  const formData = await request.formData();
  const { name, userId, color, avatar } = parseFormData(
    formData,
    PlayerFormPayload,
  );

  const roomId = params.roomId ? parseInt(params.roomId) : undefined;
  if (!roomId) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  if (roomId === -1) {
    const type =
      request.method === "POST"
        ? ActionType.Join
        : request.method === "PATCH"
          ? ActionType.ChangeName
          : ActionType.Kick;
    return { type, payload: { userId, name, color, avatar }, ts: Date.now() };
  }

  const authSession = await getValidAuthSession(request);
  // Validate userId for self-actions (Join, ChangeName). DELETE is excluded
  // because it's either Leave (self) or Kick (cross-user), handled by
  // getDeleteActionType.
  if (request.method === "POST" || request.method === "PATCH") {
    await requireSessionUserId(request, userId, authSession);
  }
  const type =
    request.method === "POST"
      ? ActionType.Join
      : request.method === "PATCH"
        ? ActionType.ChangeName
        : await getDeleteActionType(request, userId);
  const room = await getRoom(roomId, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }

  // Mark the game as started if it hasn't been already
  if (authSession && request.method === "POST") {
    const solve = await getSolve(
      authSession.userId,
      room.game_id,
      authSession.accessToken,
    );
    if (!solve) {
      await markAttempted(
        authSession.userId,
        room.game_id,
        room.id,
        authSession.accessToken,
      );
    }
  }

  await createRoomEvent(
    room.id,
    type,
    {
      userId,
      name,
      color,
      // Only Join and ChangeName carry an avatar.
      ...(avatar !== undefined && request.method !== "DELETE"
        ? { avatar }
        : {}),
    },
    authSession?.accessToken,
  );

  return null;
}
