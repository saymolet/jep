// @vitest-environment node
// (happy-dom drops the Cookie header from Request, like a browser.)
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => {
  const ENV: Record<string, string | undefined> = {
    ADMIN_PASSWORD: "test-admin-password",
    SESSION_SECRET: "unit-test-session-secret",
    NODE_ENV: "test",
    SUPABASE_URL: "http://127.0.0.1:54321",
    BASE_URL: "http://localhost:3000",
  };
  return { ENV };
});
vi.mock("varlock/env", () => env);

// No admin route may reach the database before the admin check passes.
const db = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(() => {
    throw new Error("database used without an admin session");
  }),
}));
vi.mock("~/supabase/admin.server", () => db);
vi.mock("~/supabase", () => ({ getSupabase: db.getSupabaseAdmin }));

import { ADMIN_SESSION_MS, adminLogin, requireAdmin } from "./auth.server";
import { LoginThrottle } from "./throttle";

const PASSWORD = "test-admin-password";
const GAME_ID = "1f0b8a3c-2d4e-4f60-8a1b-9c2d3e4f5a6b";

type RouteModule = {
  loader?: Handler;
  action?: Handler;
};

// Every admin route module (app/routes/admin*.tsx).
const modules = import.meta.glob<RouteModule>("../routes/admin*.tsx", {
  eager: true,
});

/** Public by design: the layout (shows the navigation only to admins) and the
 * login page. Both still answer 404 when the admin panel is off. */
const PUBLIC = new Set(["../routes/admin.tsx", "../routes/admin.login.tsx"]);

const handlers = Object.entries(modules).flatMap(([path, mod]) =>
  (["loader", "action"] as const)
    .filter((kind) => typeof mod[kind] === "function")
    .map((kind) => ({ name: `${path} ${kind}`, path, kind, fn: mod[kind]! })),
);
const guarded = handlers.filter((h) => !PUBLIC.has(h.path));

function request(
  kind: "loader" | "action",
  { cookie, csrf }: { cookie?: string; csrf?: string } = {},
) {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  if (kind === "loader") {
    return new Request("http://localhost/admin/x", { headers });
  }
  const body = new FormData();
  if (csrf !== undefined) body.set("csrf", csrf);
  body.set("intent", "delete");
  body.set("gameId", GAME_ID);
  body.set("roomId", "1");
  body.set("roomName", "1-x");
  body.set("reportId", "1");
  body.set("visibility", "PUBLIC");
  return new Request("http://localhost/admin/x", {
    method: "POST",
    headers,
    body,
  });
}

type Handler = (args: {
  request: Request;
  params: Record<string, string>;
  context: object;
}) => unknown;

async function call(fn: Handler, req: Request) {
  try {
    return await fn({ request: req, params: { gameId: GAME_ID }, context: {} });
  } catch (thrown) {
    return thrown;
  }
}

/** adminCookie logs in and returns the session cookie. */
async function adminCookie(now = Date.now()) {
  const result = await adminLogin(
    new Request("http://localhost/admin/login", { method: "POST" }),
    PASSWORD,
    { now, loginThrottle: new LoginThrottle() },
  );
  if (!result.ok) throw new Error("login failed");
  const setCookie = result.headers.get("Set-Cookie") ?? "";
  return setCookie.split(";")[0];
}

/** The CSRF token inside a session cookie (the cookie is signed, not
 * encrypted). */
function csrfOf(cookie: string) {
  const value = decodeURIComponent(cookie.split("=")[1]);
  const json: { admin: { csrf: string } } = JSON.parse(
    Buffer.from(value.slice(0, value.lastIndexOf(".")), "base64").toString(),
  );
  return json.admin.csrf;
}

function expectRedirectToLogin(result: unknown) {
  if (!(result instanceof Response))
    throw new Error(`not a Response: ${result}`);
  expect(result.status).toBe(302);
  expect(result.headers.get("Location")).toMatch(/^\/admin\/login\b/);
}

function expectStatus(result: unknown, status: number) {
  if (!(result instanceof Response))
    throw new Error(`not a Response: ${result}`);
  expect(result.status).toBe(status);
}

beforeEach(() => {
  env.ENV.ADMIN_PASSWORD = PASSWORD;
  db.getSupabaseAdmin.mockClear();
});

describe("admin routes", () => {
  it("finds the admin route modules", () => {
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(8);
    expect(guarded.length).toBeGreaterThanOrEqual(12);
  });

  describe.each(handlers)("$name", ({ kind, fn }) => {
    it("answers 404 when ADMIN_PASSWORD is not set", async () => {
      env.ENV.ADMIN_PASSWORD = undefined;
      expectStatus(await call(fn, request(kind)), 404);
      env.ENV.ADMIN_PASSWORD = "";
      expectStatus(await call(fn, request(kind)), 404);
      expect(db.getSupabaseAdmin).not.toHaveBeenCalled();
    });
  });

  describe.each(guarded)("$name", ({ kind, fn }) => {
    it("redirects to the login page without an admin session", async () => {
      expectRedirectToLogin(await call(fn, request(kind)));
      expect(db.getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it("redirects when the admin session has expired", async () => {
      const cookie = await adminCookie(Date.now() - ADMIN_SESSION_MS - 1);
      expectRedirectToLogin(
        await call(fn, request(kind, { cookie, csrf: csrfOf(cookie) })),
      );
      expect(db.getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it("redirects when the admin password was changed", async () => {
      const cookie = await adminCookie();
      env.ENV.ADMIN_PASSWORD = "a-new-admin-password";
      expectRedirectToLogin(
        await call(fn, request(kind, { cookie, csrf: csrfOf(cookie) })),
      );
      expect(db.getSupabaseAdmin).not.toHaveBeenCalled();
    });

    if (kind === "action") {
      it("refuses a submission without the right CSRF token", async () => {
        const cookie = await adminCookie();
        expectStatus(await call(fn, request(kind, { cookie })), 403);
        expectStatus(
          await call(fn, request(kind, { cookie, csrf: "wrong" })),
          403,
        );
        expect(db.getSupabaseAdmin).not.toHaveBeenCalled();
      });
    }

    it("passes the admin check with a valid session", async () => {
      const cookie = await adminCookie();
      const result = await call(
        fn,
        request(kind, { cookie, csrf: csrfOf(cookie) }),
      );
      // Past the check, the route goes on to the (mocked, throwing)
      // database, or redirects somewhere other than the login page (logout).
      // (The mock throwing proves the check let it through.)
      if (result instanceof Response) {
        expect([403, 404]).not.toContain(result.status);
        if (kind === "loader") {
          expect(result.headers.get("Location")).not.toMatch(/^\/admin\/login/);
        }
      } else if (result instanceof Error) {
        expect(result.message).toBe("database used without an admin session");
      }
      // Otherwise the page rendered its data (e.g. the storage page before a
      // scan, or the dashboard showing the database error).
    });
  });
});

describe("requireAdmin", () => {
  it("redirects a client-side navigation back to the page, not its .data URL", async () => {
    // The header's admin button navigates in the browser: React Router
    // fetches "/admin.data" (and "/admin/games.data") for the loaders.
    for (const [url, redirectTo] of [
      ["http://localhost/admin.data", "%2Fadmin"],
      ["http://localhost/admin/games.data?page=2", "%2Fadmin%2Fgames"],
      ["http://localhost/admin", "%2Fadmin"],
    ]) {
      const result = await requireAdmin(new Request(url)).catch(
        (error: unknown) => error,
      );
      if (!(result instanceof Response)) throw new Error("expected redirect");
      expect(result.headers.get("Location")).toBe(
        `/admin/login?redirectTo=${redirectTo}`,
      );
    }
  });
});

describe("admin login", () => {
  it("opens a 12 h session with the right password only", async () => {
    const throttle = new LoginThrottle();
    const req = () =>
      new Request("http://localhost/admin/login", {
        method: "POST",
        headers: { "X-Real-IP": "10.0.0.1" },
      });
    expect(
      await adminLogin(req(), "wrong", { loginThrottle: throttle }),
    ).toEqual({ ok: false, status: 401 });
    expect(await adminLogin(req(), "", { loginThrottle: throttle })).toEqual({
      ok: false,
      status: 401,
    });
    const ok = await adminLogin(req(), PASSWORD, { loginThrottle: throttle });
    expect(ok.ok).toBe(true);
  });

  it("refuses even the right password while locked out", async () => {
    const throttle = new LoginThrottle();
    const req = () =>
      new Request("http://localhost/admin/login", {
        method: "POST",
        headers: { "X-Real-IP": "10.0.0.2" },
      });
    for (let i = 0; i < 5; i++) {
      await adminLogin(req(), "wrong", { loginThrottle: throttle, now: i });
    }
    expect(
      await adminLogin(req(), PASSWORD, { loginThrottle: throttle, now: 10 }),
    ).toEqual({ ok: false, status: 401 });
    // Another address can still log in.
    const other = new Request("http://localhost/admin/login", {
      method: "POST",
      headers: { "X-Real-IP": "10.0.0.3" },
    });
    expect(
      (await adminLogin(other, PASSWORD, { loginThrottle: throttle, now: 10 }))
        .ok,
    ).toBe(true);
  });
});
