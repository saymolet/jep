import type { Browser, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  logInAsAdmin,
  uploadGame,
  waitForConnected,
} from "./helpers";

/** Upload the 1×1 game and open a room joined by the (non-admin) host and an
 * anonymous guest. */
async function roomWithTwoPlayers(host: Page, browser: Browser) {
  await goto(host, "/profile");
  const gameId = await uploadGame(host);
  await goto(host, `/game/${gameId}/play`);
  await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
  const roomUrl = host.url();
  await waitForConnected(host);
  await host.getByRole("button", { name: /join game/i }).click();
  await expect(host.getByRole("button", { name: /join game/i })).toBeHidden({
    timeout: 10_000,
  });

  const context = await browser.newContext();
  const guest = await context.newPage();
  await goto(guest, roomUrl);
  await waitForConnected(guest);
  await guest.getByRole("button", { name: /join game/i }).click();
  await expect(guest.getByRole("button", { name: /join game/i })).toBeHidden({
    timeout: 10_000,
  });
  return { guest, context, roomUrl };
}

function roomIdOf(roomUrl: string) {
  const id = roomUrl.match(/\/room\/(\d+)-/)?.[1];
  expect(id).toBeTruthy();
  return Number(id);
}

test.describe("only the admin changes the answer timer", () => {
  test("players see it read-only; the admin (not playing) changes it", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    const { guest, context, roomUrl } = await roomWithTwoPlayers(host, browser);

    // Players: the values are shown, nothing can be changed.
    for (const page of [host, guest]) {
      const settings = page
        .getByRole("dialog")
        .getByTestId("answer-timer-settings");
      await expect(
        settings.getByRole("radio", { name: "Off" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        settings.getByRole("radio", { name: "15 s" }),
      ).toBeDisabled();
      await expect(
        settings.getByLabel("Mark wrong when time runs out"),
      ).toBeDisabled();
      await expect(
        settings.getByText("Only the admin can change this."),
      ).toBeVisible();
    }

    // Asking the server directly doesn't help either (refused before the
    // userId is even looked at).
    const refused = await host.request.post(
      `/room/${roomIdOf(roomUrl)}/settings`,
      {
        form: {
          userId: "me",
          answerTimeSec: "15",
          autoWrongOnTimeout: "true",
        },
      },
    );
    expect(refused.status()).toBe(403);

    // The admin, on their own device, just watches the room.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await logInAsAdmin(admin);
    await goto(admin, roomUrl);
    await waitForConnected(admin);
    await admin.getByRole("button", { name: "Just watch" }).click();

    const timerButton = admin.getByRole("button", {
      name: "Answer time settings",
    });
    await timerButton.click();
    const adminSettings = admin
      .getByRole("dialog")
      .getByTestId("answer-timer-settings");
    const option = adminSettings.getByRole("radio", { name: "15 s" });
    await expect(async () => {
      await option.click();
      await expect(option).toHaveAttribute("aria-checked", "true", {
        timeout: 2_000,
      });
    }).toPass({ timeout: 10_000 });
    await expect(adminSettings.getByText("Only the admin")).toHaveCount(0);

    // Both players see the new value at once.
    for (const page of [host, guest]) {
      await expect(
        page
          .getByRole("dialog")
          .getByTestId("answer-timer-settings")
          .getByRole("radio", { name: "15 s" }),
      ).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
    }

    // On the board, the header shows the value without a button.
    await clickStartRound(host);
    const readOnly = host.getByTestId("answer-time-readonly");
    await expect(readOnly).toContainText("15 s");
    await expect(readOnly).toHaveAttribute(
      "title",
      "Answer time: 15 s. Only the admin can change this.",
    );
    await expect(
      host.getByRole("button", { name: "Answer time settings" }),
    ).toHaveCount(0);

    await adminContext.close();
    await context.close();
  });

  test("the browser key can't insert settings events", async ({
    authedPage: host,
  }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    expect(supabaseUrl && anonKey).toBeTruthy();

    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomId = roomIdOf(host.url());

    const insert = (type: string, payload: object | null) =>
      host.request.post(`${supabaseUrl}/rest/v1/room_events`, {
        headers: {
          apikey: anonKey!,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        data: { room_id: roomId, type, payload },
      });

    // A forged settings change is rejected by row-level security...
    const forged = await insert("set_settings", {
      userId: "forger",
      answerTimeSec: 60,
      autoWrongOnTimeout: false,
      admin: true,
    });
    expect([401, 403]).toContain(forged.status());
    expect((await forged.json()).code).toBe("42501");

    // ...like every other event type since all room events are inserted by
    // the server (see seat-lock-room.spec.ts for the full list).
    const pause = await insert("toggle_pause", null);
    expect([401, 403]).toContain(pause.status());

    const events = await host.request.get(
      `${supabaseUrl}/rest/v1/room_events?room_id=eq.${roomId}&select=type`,
      { headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey}` } },
    );
    expect(await events.json()).toEqual([]);
  });
});
