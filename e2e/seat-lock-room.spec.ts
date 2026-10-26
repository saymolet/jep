import path from "node:path";

import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  logInAsAdmin,
  playOneClue,
  uploadGame,
  waitForConnected,
} from "./helpers";

const MOCK_3x3_PATH = path.resolve("app/static/mock-3x3.jep.json");

function env() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(supabaseUrl && anonKey && serviceKey).toBeTruthy();
  return {
    supabaseUrl: supabaseUrl!,
    anonKey: anonKey!,
    serviceKey: serviceKey!,
  };
}

function roomIdOf(roomUrl: string) {
  const id = roomUrl.match(/\/room\/(\d+)-/)?.[1];
  expect(id).toBeTruthy();
  return Number(id);
}

function rest(request: APIRequestContext, key: string) {
  const { supabaseUrl } = env();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  return {
    get: (pathAndQuery: string) =>
      request.get(`${supabaseUrl}/rest/v1/${pathAndQuery}`, { headers }),
    post: (table: string, data: unknown) =>
      request.post(`${supabaseUrl}/rest/v1/${table}`, {
        headers: { ...headers, Prefer: "return=representation" },
        data,
      }),
    rpc: (fn: string, data: unknown) =>
      request.post(`${supabaseUrl}/rest/v1/rpc/${fn}`, { headers, data }),
  };
}

/** The players who joined the room, in order: [{ userId, name }]. */
async function joinedPlayers(page: Page, roomId: number) {
  const { anonKey } = env();
  const res = await rest(page.request, anonKey).get(
    `room_events?room_id=eq.${roomId}&type=eq.join&select=payload&order=id`,
  );
  const rows: { payload: { userId: string; name: string } }[] =
    await res.json();
  return rows.map((r) => r.payload);
}

async function join(page: Page) {
  await waitForConnected(page);
  await page.getByRole("button", { name: /join game/i }).click();
  await expect(page.getByRole("button", { name: /join game/i })).toBeHidden({
    timeout: 10_000,
  });
}

/** DELETE /room/:id/player as the page's visitor (their cookies). */
function kick(
  page: Page,
  roomId: number,
  player: { userId: string; name: string },
) {
  return page.request.delete(`/room/${roomId}/player`, {
    form: { userId: player.userId, name: player.name },
  });
}

test.describe("seat lock", () => {
  test("players kick only before the game; then only the admin; a returning player keeps their points", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, MOCK_3x3_PATH);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    const roomId = roomIdOf(roomUrl);
    await join(host);

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await goto(guest, roomUrl);
    await join(guest);

    const extraContext = await browser.newContext();
    const extra = await extraContext.newPage();
    await goto(extra, roomUrl);
    await join(extra);

    const [hostPlayer, guestPlayer, extraPlayer] = await joinedPlayers(
      host,
      roomId,
    );
    expect(extraPlayer).toBeTruthy();

    // Before the game: a player may still kick another (as before).
    expect((await kick(host, roomId, extraPlayer)).ok()).toBe(true);
    await expect(extra.getByRole("button", { name: /join game/i })).toBeVisible(
      { timeout: 10_000 },
    );
    await extraContext.close();

    // The game starts and the first question is played: seats are locked.
    await clickStartRound(host);
    await playOneClue(host);
    await expect(host.getByText("$200").first()).toBeVisible({
      timeout: 10_000,
    });
    // No kick buttons for players any more (leaving yourself still works).
    await expect(
      host.getByRole("button", { name: /^Kick player/ }),
    ).toHaveCount(0);
    await expect(
      guest.getByRole("button", { name: /^Kick player/ }),
    ).toHaveCount(0);
    // And the server refuses it.
    const refused = await kick(guest, roomId, hostPlayer);
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain("only the admin can kick");

    // The admin, watching on their own device, may remove a player.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await logInAsAdmin(admin);
    await goto(admin, roomUrl);
    await waitForConnected(admin);
    await admin.getByRole("button", { name: "Just watch" }).click();
    await expect(
      admin.getByRole("button", { name: /^Kick player/ }),
    ).toHaveCount(2);
    await admin
      .getByRole("button", { name: `Kick player ${hostPlayer.name}` })
      .click();
    await admin
      .getByRole("menu")
      .getByText("Kick player", { exact: true })
      .click();

    // The host is out of the game (the guest now picks)...
    await expect(host.getByRole("button", { name: /join game/i })).toBeVisible({
      timeout: 10_000,
    });
    // ...and joins again: same seat, same $200.
    await host.getByRole("button", { name: /join game/i }).click();
    await expect(host.getByRole("button", { name: /join game/i })).toBeHidden({
      timeout: 10_000,
    });
    await expect(host.getByText("$200").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(guest.getByText("$200").first()).toBeVisible({
      timeout: 10_000,
    });
    expect(guestPlayer).toBeTruthy();

    // The kick was stored by the server, tagged as the admin's.
    const { anonKey } = env();
    const kicks = await (
      await rest(host.request, anonKey).get(
        `room_events?room_id=eq.${roomId}&type=eq.kick&select=payload&order=id`,
      )
    ).json();
    expect(kicks).toEqual([
      { payload: expect.objectContaining({ userId: extraPlayer.userId }) },
      {
        payload: expect.objectContaining({
          userId: hostPlayer.userId,
          admin: true,
        }),
      },
    ]);

    await adminContext.close();
    await guestContext.close();
  });

  test("the browser key can't insert any room event", async ({
    authedPage: host,
  }) => {
    const { anonKey } = env();
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomId = roomIdOf(host.url());
    const anon = rest(host.request, anonKey);

    // Every room event is inserted by the server (feature 20): the browser
    // key may not insert any type, for anyone.
    const forgeries: [string, unknown][] = [
      ["kick", { userId: "victim", name: "Victim", admin: true }],
      ["leave", { userId: "victim", name: "Victim" }],
      ["transfer_player", { oldUserId: "victim", newUserId: "thief" }],
      [
        "set_settings",
        { userId: "x", answerTimeSec: 10, autoWrongOnTimeout: true },
      ],
      ["join", { userId: "someone", name: "Someone" }],
      ["change_name", { userId: "victim", name: "Renamed" }],
      ["start_round", { round: 0, userId: "victim" }],
      ["choose_clue", { userId: "victim", i: 0, j: 0 }],
      ["buzz", { userId: "victim", i: 0, j: 0, deltaMs: 1 }],
      ["answer", { userId: "victim", i: 0, j: 0, answer: "x" }],
      ["check", { userId: "victim", i: 0, j: 0, correct: true }],
      [
        "correct_check",
        { round: 0, userId: "victim", i: 0, j: 0, correct: true },
      ],
      ["set_clue_wager", { userId: "victim", i: 0, j: 0, wager: 5 }],
      ["pass_clue", { userId: "victim", i: 0, j: 0, toUserId: "thief" }],
      ["next_clue", { userId: "victim", i: 0, j: 0 }],
      ["toggle_pause", null],
      ["toggle_clock", null],
      ["set_team", { userId: "victim", team: "red" }],
      ["rename_team", { userId: "victim", team: "red", name: "X" }],
      ["skip_clue", { i: 0, j: 0, admin: true }],
      ["adjust_score", { userId: "victim", delta: 1000, admin: true }],
    ];
    for (const [type, payload] of forgeries) {
      const forged = await anon.post("room_events", {
        room_id: roomId,
        type,
        payload,
      });
      expect([401, 403], type).toContain(forged.status());
      expect((await forged.json()).code, type).toBe("42501");
    }
    const stored = await (
      await anon.get(`room_events?room_id=eq.${roomId}&select=id`)
    ).json();
    expect(stored).toEqual([]);
  });
});

test.describe("inactive room cleanup", () => {
  const HOUR = 60 * 60 * 1000;
  /** `timestamp without time zone` in UTC, like room_events.ts. */
  const utc = (ms: number) => new Date(ms).toISOString().slice(0, -1);

  test("the admin deletes rooms idle for 5 hours; fresh rooms stay", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    const { anonKey, serviceKey } = env();
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    const service = rest(host.request, serviceKey);
    const now = Date.now();
    const sixHoursAgo = new Date(now - 6 * HOUR).toISOString();

    async function createRoom(
      name: string,
      createdAt: string,
      eventAt: number | null,
    ) {
      const res = await service.post("rooms", {
        name,
        game_id: gameId,
        created_at: createdAt,
      });
      expect(res.status()).toBe(201);
      const created: { id: number }[] = await res.json();
      const [room] = created;
      if (eventAt !== null) {
        const ev = await service.post("room_events", {
          room_id: room.id,
          type: "join",
          payload: { userId: `u-${name}`, name },
          ts: utc(eventAt),
        });
        expect(ev.status()).toBe(201);
      }
      return room.id;
    }
    const suffix = `${now}`;
    const idleRoom = await createRoom(
      `idle-${suffix}`,
      sixHoursAgo,
      now - 6 * HOUR,
    );
    const emptyOldRoom = await createRoom(`empty-${suffix}`, sixHoursAgo, null);
    const activeOldRoom = await createRoom(
      `active-${suffix}`,
      sixHoursAgo,
      now - 10 * 60 * 1000,
    );
    const freshRoom = await createRoom(
      `fresh-${suffix}`,
      new Date(now).toISOString(),
      null,
    );

    // Only the service role may call the function.
    const anonCall = await rest(host.request, anonKey).rpc(
      "cleanup_inactive_rooms",
      { max_idle: "5 hours", dry_run: true },
    );
    expect(anonCall.ok()).toBe(false);

    // The admin panel: count first, then confirm.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await logInAsAdmin(admin);
    await goto(admin, "/admin/rooms");
    await expect(
      admin.getByText(
        "Rooms with no activity for 5 hours are deleted automatically",
      ),
    ).toBeVisible();
    await admin
      .getByRole("link", { name: "Delete rooms inactive for 5 h now" })
      .click();
    const confirm = admin.getByRole("alertdialog");
    // At least our two idle rooms (older local test data may add more).
    await expect(confirm).toHaveAccessibleName(
      /^Delete \d+ rooms inactive for 5 hours\?$/,
    );
    const counted = Number(
      (await confirm.getAttribute("aria-label"))?.match(/\d+/)?.[0],
    );
    expect(counted).toBeGreaterThanOrEqual(2);
    await confirm.getByRole("button", { name: "Yes, delete" }).click();
    await expect(
      admin.getByText(/^Deleted \d+ inactive rooms?\.$/),
    ).toBeVisible();
    await expect(admin.getByRole("alertdialog")).toHaveCount(0);

    const remainingRes = await service.get(
      `rooms?id=in.(${idleRoom},${emptyOldRoom},${activeOldRoom},${freshRoom})&select=id`,
    );
    const remaining: { id: number }[] = await remainingRes.json();
    expect(remaining.map((r) => r.id).sort()).toEqual(
      [activeOldRoom, freshRoom].sort(),
    );
    // The idle room's events went with it.
    const events = await (
      await service.get(`room_events?room_id=eq.${idleRoom}&select=id`)
    ).json();
    expect(events).toEqual([]);

    // Ukrainian.
    await admin
      .context()
      .addCookies([{ name: "lang", value: "uk", url: admin.url() }]);
    await goto(admin, "/admin/rooms");
    await expect(
      admin.getByRole("link", {
        name: "Видалити кімнати без активності 5 год зараз",
      }),
    ).toBeVisible();

    await adminContext.close();
  });
});
