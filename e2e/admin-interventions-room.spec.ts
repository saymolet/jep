import path from "node:path";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  logInAsAdmin,
  openClue,
  uploadGame,
  waitForConnected,
} from "./helpers";

/* Admin interventions (feature 20): the site admin, only watching, skips a
 * question, does a stuck player's step for them and changes a score. */

const MOCK_3x3_PATH = path.resolve("app/static/mock-3x3.jep.json");

function roomIdOf(roomUrl: string) {
  const id = roomUrl.match(/\/room\/(\d+)-/)?.[1];
  expect(id).toBeTruthy();
  return Number(id);
}

/** The players who joined the room, in order: [{ userId, name }]. */
async function joinedPlayers(page: Page, roomId: number) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  expect(supabaseUrl && anonKey).toBeTruthy();
  const res = await page.request.get(
    `${supabaseUrl}/rest/v1/room_events?room_id=eq.${roomId}&type=eq.join&select=payload&order=id`,
    { headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey}` } },
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

/** `page` buzzes in on the open question and wins the buzz (the other
 * player's device sends its "no buzz" after the buzz window). */
async function buzzIn(page: Page) {
  await expect(page.getByText(/buzz in/i).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

/** Open the admin controls sheet (the 🛡 button). */
async function openAdminPanel(admin: Page) {
  const panel = admin.getByTestId("admin-panel");
  await expect(async () => {
    if (!(await panel.isVisible())) {
      await admin.getByTestId("admin-controls-button").click();
    }
    await expect(panel).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return panel;
}

async function closeAdminPanel(admin: Page) {
  // (Escape would first dismiss a toast on the page.)
  await admin
    .getByTestId("admin-panel")
    .getByRole("button", { name: "Close" })
    .click();
  await expect(admin.getByTestId("admin-panel")).toBeHidden();
}

test.describe("admin interventions", () => {
  test("the admin skips a question, acts for players who are away and changes a score", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(180_000);
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
    const [hostPlayer, guestPlayer] = await joinedPlayers(host, roomId);
    expect(guestPlayer).toBeTruthy();

    // The admin watches on their own device.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await logInAsAdmin(admin);
    await goto(admin, roomUrl);
    await waitForConnected(admin);
    await admin.getByRole("button", { name: "Just watch" }).click();

    // Players don't get the admin controls (nor does the server let them).
    await expect(host.getByTestId("admin-controls-button")).toHaveCount(0);
    const refused = await guest.request.post(`/room/${roomId}/admin`, {
      form: {
        intent: "score",
        userId: guestPlayer.userId,
        op: "add",
        amount: "1000",
      },
    });
    expect(refused.status()).toBe(403);

    await clickStartRound(host);

    // 1. The admin gives the host $500: both players see it.
    let panel = await openAdminPanel(admin);
    const hostRow = panel.locator(
      `[data-testid="admin-score-row"][data-user-id="${hostPlayer.userId}"]`,
    );
    await hostRow.getByRole("spinbutton").fill("500");
    await hostRow.getByRole("button", { name: /^Add/ }).click();
    for (const page of [host, guest]) {
      await expect(
        page.getByTestId("admin-toast").filter({ hasText: "+$500" }),
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("$500").first()).toBeVisible();
    }
    await expect(hostRow.getByText("$500")).toBeVisible();
    await closeAdminPanel(admin);

    // 2. The host opens a question and the guest buzzes in (so the question
    // waits for them); the admin skips it: the answer is shown, nobody's
    // score changes, and the game goes back to the board.
    await openClue(host, host.getByRole("button", { name: "$ 200" }).first());
    await buzzIn(guest);
    panel = await openAdminPanel(admin);
    await panel.getByRole("button", { name: /Skip this question/ }).click();
    await panel.getByRole("button", { name: "Yes, skip" }).click();
    await expect(
      guest.getByText("The admin skipped this question."),
    ).toBeVisible({ timeout: 10_000 });
    // The host (board control) goes back to the board as after any question.
    await expect(panel.getByTestId("admin-step-status")).toHaveText(
      `Waiting for ${hostPlayer.name} to choose a question.`,
      { timeout: 15_000 },
    );
    await closeAdminPanel(admin);
    await expect(host.getByText(/buzz in/i)).toHaveCount(0);
    await expect(host.getByText("$500").first()).toBeVisible();
    await expect(guest.getByText("$0").first()).toBeVisible();

    // 3. The host opens another question (Cat B, $200: Cat A's was skipped);
    // the guest buzzes in and goes away before marking their answer.
    await openClue(host, host.getByRole("button", { name: "$ 200" }).nth(1));
    await buzzIn(guest);
    await guestContext.close();

    // The admin marks it right for them: +$200 and board control.
    panel = await openAdminPanel(admin);
    await expect(panel.getByTestId("admin-step-status")).toHaveText(
      `Waiting for ${guestPlayer.name} to mark their answer.`,
      { timeout: 10_000 },
    );
    await panel.getByRole("button", { name: "Right", exact: true }).click();
    await expect(
      panel.locator(
        `[data-testid="admin-score-row"][data-user-id="${guestPlayer.userId}"]`,
      ),
    ).toContainText("$200", { timeout: 10_000 });
    // Nobody is there to go back to the board: the admin does it for them.
    await panel
      .getByRole("button", {
        name: `Back to the board for ${guestPlayer.name}`,
      })
      .click();

    // 4. The guest has board control and is away: the admin picks the next
    // question for them, and it opens for the host.
    await expect(panel.getByTestId("admin-step-status")).toHaveText(
      `Waiting for ${guestPlayer.name} to choose a question.`,
      { timeout: 10_000 },
    );
    await panel
      .getByTestId("admin-choose-picker")
      .getByRole("button", { name: "Cat C, $400" })
      .click();
    await expect(host.getByText(/buzz in/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(panel.getByTestId("admin-step-status")).toHaveText(
      "Waiting for players to buzz in or pass.",
      { timeout: 10_000 },
    );

    // All of it was stored by the server, tagged as the admin's.
    const supabaseUrl = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const events: { type: string; payload: Record<string, unknown> }[] = await (
      await host.request.get(
        `${supabaseUrl}/rest/v1/room_events?room_id=eq.${roomId}&select=type,payload&order=id`,
        { headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey}` } },
      )
    ).json();
    const adminEvents = events.filter((e) => e.payload?.admin === true);
    expect(adminEvents.map((e) => e.type)).toEqual([
      "adjust_score",
      "skip_clue",
      "check",
      "next_clue",
      "choose_clue",
    ]);

    await adminContext.close();
  });

  test("Ukrainian admin controls", async ({ authedPage: host, browser }) => {
    test.setTimeout(90_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, MOCK_3x3_PATH);
    await goto(host, `/game/${gameId}/play`);
    const roomUrl = host.url();
    await join(host);

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await logInAsAdmin(admin);
    await adminContext.addCookies([
      { name: "lang", value: "uk", url: new URL(roomUrl).origin },
    ]);
    await goto(admin, roomUrl);
    await admin.getByRole("button", { name: "Просто дивитися" }).click();
    const panel = await openAdminPanel(admin);
    await expect(panel).toContainText("Керування адміністратора");
    await expect(panel.getByTestId("admin-step-status")).toContainText(
      "почне раунд",
    );
    await adminContext.close();
  });
});
