import type { Browser, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { goto, openClue, uploadGame, waitForConnected } from "./helpers";

/** Upload the 1×1 game, open a room and join it with the host and an
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
  return { guest, context };
}

/** Set the answer time in the round preview dialog. */
async function setAnswerTime(page: Page, seconds: string) {
  const settings = page
    .getByRole("dialog")
    .getByTestId("answer-timer-settings");
  const option = settings.getByRole("radio", { name: seconds });
  await expect(async () => {
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true", {
      timeout: 2_000,
    });
  }).toPass({ timeout: 10_000 });
  return settings;
}

/** The host opens the only question and wins the buzz (the guest doesn't
 * buzz). */
async function hostWinsBuzz(host: Page) {
  await expect(async () => {
    const start = host.getByRole("button", { name: /start round/i });
    if (await start.isVisible()) await start.click({ timeout: 2_000 });
    await expect(start).toBeHidden({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await openClue(host, host.getByRole("button", { name: "$ 200" }).first());
  const reveal = host.getByRole("button", { name: /reveal answer/i });
  await expect(async () => {
    if (!(await reveal.isVisible())) await host.keyboard.press("Enter");
    await expect(reveal).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("answer timer in a room", () => {
  test("time runs out: everyone sees it and the answer counts as wrong", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    const { guest, context } = await roomWithTwoPlayers(host, browser);

    // The host turns on a 10 second timer; the guest sees the change.
    await setAnswerTime(host, "10 s");
    const guestSettings = guest
      .getByRole("dialog")
      .getByTestId("answer-timer-settings");
    await expect(
      guestSettings.getByRole("radio", { name: "10 s" }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 10_000 });
    await expect(
      guestSettings.getByLabel("Mark wrong when time runs out"),
    ).toBeChecked();

    await hostWinsBuzz(host);

    // Both see the countdown.
    for (const page of [host, guest]) {
      await expect(page.getByTestId("answer-timer")).toHaveAttribute(
        "data-state",
        "running",
        { timeout: 10_000 },
      );
    }
    await expect(host.getByTestId("answer-timer")).toContainText(
      /\d+ seconds? left/,
    );
    await expect(
      host.getByText("When the time runs out, your answer counts as wrong."),
    ).toBeVisible();

    // The host does nothing: time's up for everyone, and the host's own
    // device marks the answer wrong. The question goes on (the guest may
    // buzz), and both are told the host's time ran out.
    for (const page of [host, guest]) {
      const notice = page.getByTestId("times-up-notice");
      await expect(notice).toContainText("Time's up!", { timeout: 15_000 });
      await expect(notice).toContainText(/ran out of time/);
    }
    await expect(host.getByText("-$200").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(guest.getByText("-$200").first()).toBeVisible({
      timeout: 10_000,
    });

    await context.close();
  });

  test("without auto-marking, nothing is sent when time runs out", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    const { guest, context } = await roomWithTwoPlayers(host, browser);

    const settings = await setAnswerTime(host, "10 s");
    const autoWrong = settings.getByLabel("Mark wrong when time runs out");
    await expect(async () => {
      await autoWrong.uncheck();
      await expect(autoWrong).not.toBeChecked({ timeout: 2_000 });
    }).toPass({ timeout: 10_000 });
    await expect(
      guest
        .getByRole("dialog")
        .getByTestId("answer-timer-settings")
        .getByLabel("Mark wrong when time runs out"),
    ).not.toBeChecked({ timeout: 10_000 });

    await hostWinsBuzz(host);

    for (const page of [host, guest]) {
      await expect(page.getByTestId("answer-timer")).toContainText(
        "Time's up!",
        { timeout: 20_000 },
      );
    }
    await expect(host.getByText("Mark your answer now.")).toBeVisible();

    // Still the host's turn: nothing was marked.
    await host.waitForTimeout(2_000);
    await expect(
      host.getByRole("button", { name: /reveal answer/i }),
    ).toBeVisible();
    await expect(guest.getByText(/waiting for/i).first()).toBeVisible();
    for (const page of [host, guest]) {
      await expect(page.getByText("-$200")).toHaveCount(0);
    }

    await context.close();
  });
});
