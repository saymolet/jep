import { randomUUID } from "node:crypto";

import { createCookieSessionStorage } from "react-router";
import { ENV } from "varlock/env";
import { z } from "zod";

const FormStateSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  /** Extra lines, e.g. what a SIGame import skipped. */
  details: z.array(z.string()).optional(),
});
type FormState = z.infer<typeof FormStateSchema>;

const FORM_STATE_KEY = "formState";
const USER_SESSION_KEY = "userId";

const { getSession, commitSession } = createCookieSessionStorage({
  cookie: {
    name: "__session",

    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [ENV.SESSION_SECRET],
    secure: ENV.NODE_ENV === "production",
  },
});

/** getSessionFormState appends to existing headers if provided. */
export async function getSessionFormState(
  request: Request,
  headers = new Headers(),
): Promise<[FormState | undefined, Headers]> {
  const session = await getSession(request.headers.get("Cookie"));
  const data = session.get("formState");
  headers.append("Set-Cookie", await commitSession(session));
  if (!data) {
    return [undefined, headers];
  }
  return [FormStateSchema.parse(JSON.parse(data)), headers];
}

/** flashFormState appends to existing headers if provided. */
export async function flashFormState(
  request: Request,
  data: FormState,
  headers = new Headers(),
): Promise<Headers> {
  const session = await getSession(request.headers.get("Cookie"));
  session.flash(FORM_STATE_KEY, JSON.stringify(data));
  headers.append("Set-Cookie", await commitSession(session));
  return headers;
}

export async function getUserSession(request: Request) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get(USER_SESSION_KEY);
  if (typeof userId === "string") {
    return userId;
  }
  return null;
}

/**
 * Validates that the claimed userId from form data matches the authenticated
 * session. Throws a 403 Response if they don't match, preventing impersonation.
 */
export async function requireSessionUserId(
  request: Request,
  claimedUserId: string,
  authSession: { userId: string } | null,
): Promise<void> {
  const sessionUserId = authSession?.userId ?? (await getUserSession(request));
  if (sessionUserId !== claimedUserId) {
    throw new Response("userId does not match session", { status: 403 });
  }
}

/** createUserSession appends to existing headers if provided. */
async function createUserSession(
  request: Request,
  userId: string,
  headers = new Headers(),
) {
  const session = await getSession(request.headers.get("Cookie"));
  session.set(USER_SESSION_KEY, userId);
  headers.append("Set-Cookie", await commitSession(session));
  return headers;
}

/** getOrCreateUserSession appends to existing headers if provided. */
export async function getOrCreateUserSession(
  request: Request,
  headers = new Headers(),
) {
  let userId = await getUserSession(request);
  if (!userId) {
    userId = randomUUID();
    await createUserSession(request, userId, headers);
  }
  return userId;
}

const ADMIN_SESSION_KEY = "admin";

const AdminSessionSchema = z.object({
  /** When the admin session ends (ms since the epoch). */
  until: z.number(),
  /** Fingerprint of the admin password it was opened with. */
  key: z.string(),
  /** Token every admin form must send back (CSRF protection). */
  csrf: z.string(),
});
export type AdminSession = z.infer<typeof AdminSessionSchema>;

/** getAdminSessionData reads the admin part of the session cookie (not yet
 * checked for expiry or the password fingerprint; see `~/admin/auth.server`). */
export async function getAdminSessionData(
  request: Request,
): Promise<AdminSession | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const result = AdminSessionSchema.safeParse(session.get(ADMIN_SESSION_KEY));
  return result.success ? result.data : null;
}

/** setAdminSessionData stores (or with null, removes) the admin part of the
 * session cookie. Appends to existing headers if provided. */
export async function setAdminSessionData(
  request: Request,
  data: AdminSession | null,
  headers = new Headers(),
) {
  const session = await getSession(request.headers.get("Cookie"));
  if (data) session.set(ADMIN_SESSION_KEY, data);
  else session.unset(ADMIN_SESSION_KEY);
  headers.append("Set-Cookie", await commitSession(session));
  return headers;
}

const ROOM_SETTINGS_KEY = "roomSettings";

const RoomSettingsSchema = z.object({
  answerTimeSec: z.number(),
  autoWrongOnTimeout: z.boolean(),
  readTimeSec: z.number().nullable(),
  buzzWindowSec: z.number(),
  finalAnswerTimeSec: z.number(),
  wagerTimeSec: z.number(),
});
export type LastRoomSettings = z.infer<typeof RoomSettingsSchema>;

/** getLastRoomSettings reads the room settings the admin last created a
 * room with (pre-filled in the next "new room" step). Not validated beyond
 * the shape: callers check the values (see ~/engine/room-timers). */
export async function getLastRoomSettings(
  request: Request,
): Promise<LastRoomSettings | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const result = RoomSettingsSchema.safeParse(session.get(ROOM_SETTINGS_KEY));
  return result.success ? result.data : null;
}

/** setLastRoomSettings remembers the room settings the admin created a room
 * with. Appends to existing headers if provided. */
export async function setLastRoomSettings(
  request: Request,
  data: LastRoomSettings,
  headers = new Headers(),
) {
  const session = await getSession(request.headers.get("Cookie"));
  session.set(ROOM_SETTINGS_KEY, data);
  headers.append("Set-Cookie", await commitSession(session));
  return headers;
}
