import path from "path";

import type { Browser, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  createRoomAsAdmin,
  goto,
  logInAsAdmin,
  openClue,
  uploadGame,
  waitForConnected,
} from "./helpers";

/** One category: a $200 question and a $400 Double Down. */
const ROOM_TIMERS_GAME = path.resolve("e2e/assets/room-timers.jep.json");

/** pick clicks a radio of a room timers group until it is selected. */
async function pick(panel: Locator, group: string, name: string) {
  const option = panel.getByTestId(group).getByRole("radio", { name });
  await expect(async () => {
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true", {
      timeout: 2_000,
    });
  }).toPass({ timeout: 10_000 });
}

function selected(page: Page, group: string) {
  return page
    .getByRole("dialog")
    .getByTestId(group)
    .locator('[role="radio"][aria-checked="true"]');
}

async function join(page: Page) {
  await waitForConnected(page);
  await page.getByRole("button", { name: /join game/i }).click();
  await expect(page.getByRole("button", { name: /join game/i })).toBeHidden({
    timeout: 10_000,
  });
}

async function guestJoins(browser: Browser, roomUrl: string) {
  const context = await browser.newContext();
  const guest = await context.newPage();
  await goto(guest, roomUrl);
  await join(guest);
  return { guest, context };
}

test.describe("room timers", () => {
  test("the admin creates a room with a 3 s buzz window, 0 s reading and 15 s wager time", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await logInAsAdmin(host);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, ROOM_TIMERS_GAME);

    // The "new room" step: today's defaults, one tap to accept.
    await createRoomAsAdmin(host, gameId, async (panel) => {
      await expect(
        panel
          .getByTestId("buzz-window-settings")
          .getByRole("radio", { name: "5 s" }),
      ).toHaveAttribute("aria-checked", "true");
      await pick(panel, "read-time-settings", "0 s");
      await pick(panel, "buzz-window-settings", "3 s");
      await pick(panel, "wager-time-settings", "15 s");
    });
    const roomUrl = host.url();
    await join(host);
    const { guest, context } = await guestJoins(browser, roomUrl);

    // Everyone sees the room's timers (read-only for the guest).
    for (const page of [host, guest]) {
      await expect(selected(page, "read-time-settings")).toHaveText("0 s");
      await expect(selected(page, "buzz-window-settings")).toHaveText("3 s");
      await expect(selected(page, "wager-time-settings")).toHaveText("15 s");
    }
    await expect(
      guest
        .getByRole("dialog")
        .getByTestId("buzz-window-settings")
        .getByRole("radio", { name: "7 s" }),
    ).toBeDisabled();

    // Nobody buzzes: with no reading time and a 3 s window the answer is
    // shown well before the default (reading + 5 s) would allow.
    await clickStartRound(host);
    await openClue(host, host.getByRole("button", { name: "$ 200" }).first());
    for (const page of [host, guest]) {
      await expect(page.getByText("Sundial")).toBeVisible({ timeout: 5_500 });
    }
    await host.getByRole("button", { name: /back to board/i }).click();

    // The Double Down: the wager countdown runs for everyone; when it runs
    // out, the host's own device wagers the minimum ($5).
    await openClue(host, host.getByRole("button", { name: "$ 400" }).first());
    for (const page of [host, guest]) {
      await expect(page.getByTestId("wager-timer")).toBeVisible();
    }
    await expect(
      host.getByText("When the time runs out, you wager $5."),
    ).toBeVisible();
    await expect(host.getByText("It counts down to zero")).toBeVisible({
      timeout: 25_000,
    });
    await expect(host.getByText(/wagered \$5/)).toBeVisible();
    await expect(guest.getByText("It counts down to zero")).toBeVisible();

    await context.close();
  });

  test("a non-admin creating a room gets the defaults without a create step", async ({
    authedPage: host,
  }) => {
    await goto(host, "/profile");
    const gameId = await uploadGame(host, ROOM_TIMERS_GAME);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    await join(host);

    await expect(selected(host, "read-time-settings")).toHaveText("Auto");
    await expect(selected(host, "buzz-window-settings")).toHaveText("5 s");
    await expect(selected(host, "final-answer-time-settings")).toHaveText(
      "30 s",
    );
    await expect(selected(host, "wager-time-settings")).toHaveText("No limit");
    await expect(
      host
        .getByRole("dialog")
        .getByTestId("buzz-window-settings")
        .getByRole("radio", { name: "3 s" }),
    ).toBeDisabled();
    // The admin-only route refuses the change.
    const response = await host.request.post(`/game/${gameId}/play`, {
      form: {
        answerTimeSec: "0",
        autoWrongOnTimeout: "true",
        buzzWindowSec: "3",
      },
    });
    expect(response.status()).toBe(403);
  });
});
