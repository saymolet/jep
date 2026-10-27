import { randomBytes } from "node:crypto";

import { redirect } from "react-router";
import { ENV } from "varlock/env";

import {
  type AdminSession,
  getAdminSessionData,
  setAdminSessionData,
} from "~/session.server";

import { ADMIN_LOGIN_PATH, CSRF_FIELD_NAME } from "./constants";
import {
  adminPasswordFingerprint,
  checkAdminPassword,
  safeEqual,
} from "./password.server";
import { getClientAddress, LoginThrottle } from "./throttle";

/** How long an admin stays logged in. */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

/** One throttle for the whole server process. */
const throttle = new LoginThrottle();

function adminPassword(): string | undefined {
  return ENV.ADMIN_PASSWORD || undefined;
}

/** isAdminEnabled tells whether the admin panel is on (ADMIN_PASSWORD set). */
export function isAdminEnabled(): boolean {
  return adminPassword() !== undefined;
}

/** requireAdminEnabled answers 404 when no ADMIN_PASSWORD is configured: the
 * admin panel is off and looks like it doesn't exist. */
export function requireAdminEnabled(): string {
  const password = adminPassword();
  if (!password) throw new Response("Not Found", { status: 404 });
  return password;
}

function fingerprint(password: string) {
  return adminPasswordFingerprint(password, ENV.SESSION_SECRET);
}

/** getAdmin returns the current admin session, or null when the visitor is
 * not (or no longer) logged in as admin. */
export async function getAdmin(
  request: Request,
  now = Date.now(),
): Promise<AdminSession | null> {
  const password = adminPassword();
  if (!password) return null;
  const session = await getAdminSessionData(request);
  if (!session || session.until <= now) return null;
  if (!safeEqual(session.key, fingerprint(password))) return null;
  return session;
}

/** requireAdmin guards every admin loader and action:
 *  - 404 when the admin panel is off (no ADMIN_PASSWORD);
 *  - redirect to the login page when not logged in as admin;
 *  - for anything but GET/HEAD, reads the form and checks its CSRF token
 *    (403 when it is missing or wrong).
 * Returns the CSRF token for the page's forms and, for submissions, the
 * parsed form data. */
export async function requireAdmin(
  request: Request,
): Promise<{ csrf: string; formData: FormData | null }> {
  requireAdminEnabled();
  const session = await getAdmin(request);
  if (!session) {
    // Without React Router's ".data" suffix (client-side navigations, e.g.
    // the header's admin button, fetch "/admin.data").
    const path = new URL(request.url).pathname.replace(/\.data$/, "");
    const params = new URLSearchParams([["redirectTo", path]]);
    throw redirect(`${ADMIN_LOGIN_PATH}?${params}`);
  }
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return { csrf: session.csrf, formData: null };
  }
  const formData = await request.formData();
  const token = formData.get(CSRF_FIELD_NAME);
  if (typeof token !== "string" || !safeEqual(token, session.csrf)) {
    throw new Response("Forbidden", { status: 403 });
  }
  return { csrf: session.csrf, formData };
}

export type AdminLoginResult =
  | { ok: true; headers: Headers }
  | { ok: false; status: number };

/** adminLogin checks a submitted password (rate limited per client address)
 * and opens an admin session on success. Wrong passwords and lockouts give
 * the same answer, so the response says nothing about which one it was. */
export async function adminLogin(
  request: Request,
  input: unknown,
  { now = Date.now(), loginThrottle = throttle } = {},
): Promise<AdminLoginResult> {
  const password = requireAdminEnabled();
  const client = getClientAddress(request.headers);
  if (loginThrottle.isLocked(client, now)) {
    return { ok: false, status: 401 };
  }
  if (!checkAdminPassword(input, password)) {
    loginThrottle.recordFailure(client, now);
    return { ok: false, status: 401 };
  }
  loginThrottle.recordSuccess(client);
  const headers = await setAdminSessionData(request, {
    until: now + ADMIN_SESSION_MS,
    key: fingerprint(password),
    csrf: randomBytes(24).toString("base64url"),
  });
  return { ok: true, headers };
}

/** adminLogout ends the admin session (the rest of the session cookie, e.g.
 * the player id, is kept). */
export function adminLogout(request: Request) {
  return setAdminSessionData(request, null);
}
