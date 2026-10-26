import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  playOneClue,
  uploadGame,
  waitForConnected,
} from "./helpers";

async function join(page: Page) {
  const joinButton = page.getByRole("button", { name: /join game/i });
  await joinButton.click();
  await expect(joinButton).toBeHidden({ timeout: 10_000 });
}

/** Open the first $200 question, buzz in and mark it right. Enter is only
 * pressed until the buzz is won, so a slow check can't fire the autofocused
 * Reveal / Correct buttons by accident. */
async function answerFirstClueRight(page: Page) {
  const clue = page.getByRole("button", { name: "$ 200" }).first();
  await expect(async () => {
    await clue.click();
    await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });

  const reveal = page.getByRole("button", { name: /reveal answer/i });
  const correct = page.getByRole("button", { name: /correct!/i });
  const back = page.getByRole("button", { name: /back to board/i });
  const anyStep = reveal.or(correct).or(back).first();
  await expect(async () => {
    if (!(await anyStep.isVisible())) await page.keyboard.press("Enter");
    await expect(anyStep).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  if (await reveal.isVisible()) await reveal.click();
  await expect(correct.or(back).first()).toBeVisible({ timeout: 5_000 });
  if (await correct.isVisible()) await correct.click();
  await expect(back).toBeVisible({ timeout: 5_000 });
  await back.click();
}

test.describe("live standings", () => {
  test("the other player sees the rank order and the score change", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, "app/static/mock-3x3.jep.json");
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    await waitForConnected(host);
    await join(host);

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await goto(guest, roomUrl);
    await waitForConnected(guest);
    await join(guest);

    await clickStartRound(host);
    await answerFirstClueRight(host);

    // The guest opens the standings: the host leads with +$200.
    await guest.getByRole("button", { name: "Standings" }).click();
    const panel = guest.getByRole("dialog", { name: "Standings" });
    await expect(panel).toBeVisible();
    const rows = panel.getByTestId("standings-player");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("+$200", { timeout: 10_000 });
    await expect(rows.nth(0)).toContainText("Place 1");
    await expect(rows.nth(0)).toContainText("Picks next");
    await expect(rows.nth(1)).toContainText("(you)");
    await expect(rows.nth(1)).toContainText("Place 2");
    await expect(rows.nth(1)).toContainText("$0");

    // Esc closes it.
    await guest.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    await guestContext.close();
  });
});

test.describe("your games in progress", () => {
  test("a player finds their room on the home page and goes straight back in", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host);

    // Room A: the guest joins and leaves the game in progress.
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomA = new URL(host.url()).pathname;

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();

    // Before joining anything, the section isn't there.
    await goto(guest, "/");
    await expect(
      guest.getByRole("heading", { name: "Your games in progress" }),
    ).toHaveCount(0);

    await goto(guest, roomA);
    await waitForConnected(guest);
    await join(guest);

    // Room B: the guest plays the one-question game to the end.
    await goto(guest, `/game/${gameId}/play`);
    await guest.getByRole("link", { name: /start a new room/i }).click();
    await expect(guest).toHaveURL(/\/room\/\d+-\w+$/);
    const roomB = new URL(guest.url()).pathname;
    expect(roomB).not.toBe(roomA);
    await waitForConnected(guest);
    await join(guest);
    await clickStartRound(guest);
    await playOneClue(guest);
    await expect(guest).toHaveURL(/\/summary$/, { timeout: 15_000 });

    // Home: room A is listed, the finished room B isn't.
    await goto(guest, "/");
    const section = guest.getByTestId("my-rooms");
    await expect(
      section.getByRole("heading", { name: "Your games in progress" }),
    ).toBeVisible();
    const links = section.getByRole("link");
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveAttribute("href", roomA);
    await expect(links.first()).toContainText("Continue");
    await expect(section.locator(`a[href="${roomB}"]`)).toHaveCount(0);

    // One tap: back in room A as a player (no join dialog; as the only
    // player they may start the round).
    await links.first().click();
    await expect(guest).toHaveURL(roomA);
    await expect(
      guest.getByRole("button", { name: /start round/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByRole("button", { name: /join game/i })).toHaveCount(
      0,
    );

    await guestContext.close();
  });
});
