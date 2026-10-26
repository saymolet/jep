import type { createT } from "~/i18n";
import { requireSessionUserId } from "~/session.server";

import { getAdmin } from "./auth.server";

/** The form field the room's admin panel sets ("true") when the site admin
 * does a player's step for them (act for a player). */
export const ACT_AS_ADMIN_FIELD = "admin";

/** authorizeRoomActor checks who may send a room action for `userId` and
 * returns true when the site admin does it for that player.
 *
 * - A normal request (no `admin` field): the visitor may only act as
 *   themselves (requireSessionUserId, 403 otherwise).
 * - An admin intervention (`admin=true`): the visitor must have a valid admin
 *   session (403 otherwise) and may then act for any player — they needn't
 *   play in the room. The route tags the event `admin: true`; the engine
 *   still applies every game rule (whose turn it is, …) exactly as if the
 *   player had done it.
 *
 * The event is then inserted by the server (createRoomEventAsServer): the
 * browser key may not insert room events at all, so this check can't be
 * skipped by writing to the table directly. */
export async function authorizeRoomActor(
  request: Request,
  formData: FormData,
  userId: string,
  authSession: { userId: string } | null,
  t: ReturnType<typeof createT>,
): Promise<boolean> {
  if (formData.get(ACT_AS_ADMIN_FIELD) === "true") {
    if (!(await getAdmin(request))) {
      throw new Response(t("room.error.adminOnly"), { status: 403 });
    }
    return true;
  }
  await requireSessionUserId(request, userId, authSession);
  return false;
}

/** adminTag is spread into an event payload: `{ admin: true }` for an admin
 * intervention, nothing otherwise. */
export function adminTag(byAdmin: boolean): { admin?: true } {
  return byAdmin ? { admin: true } : {};
}
