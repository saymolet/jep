import type { Browser, Page } from "@playwright/test";

import { expect, TEST_EMAIL, test } from "./fixtures";
import {
  goto,
  trackHydrationErrors,
  uploadGame,
  waitForConnected,
} from "./helpers";

const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "test-password";

// The server renders in its own time zone, so render in time zones far from
// it (together these two always disagree with the server about the date, which
// the profile page shows).
const TIME_ZONES = ["Pacific/Kiritimati", "Etc/GMT+12"];

async function newPage(
  browser: Browser,
  timezoneId: string,
  { loggedIn }: { loggedIn: boolean },
): Promise<Page> {
  const context = await browser.newContext({ timezoneId });
  if (loggedIn) {
    const response = await context.request.post("/login", {
      form: { email: TEST_EMAIL, password: PASSWORD },
    });
    expect(response.ok()).toBe(true);
  }
  return context.newPage();
}

test.describe("hydration of game and room pages", () => {
  // Both tests share the one test user.
  test.describe.configure({ mode: "serial" });

  for (const timezoneId of TIME_ZONES) {
    test(`pages hydrate without a mismatch (${timezoneId})`, async ({
      browser,
    }) => {
      const page = await newPage(browser, timezoneId, { loggedIn: true });
      const errors = trackHydrationErrors(page);

      await goto(page, "/profile");
      // A fresh game, so "Play" creates a new room instead of offering the
      // rooms in progress.
      const gameId = await uploadGame(page);
      await goto(page, `/game/${gameId}`);

      // A new room, then join it.
      await goto(page, `/game/${gameId}/play`);
      await expect(page).toHaveURL(/\/room\/\d+-\w+$/);
      const roomPath = new URL(page.url()).pathname;
      await waitForConnected(page);
      await page.getByRole("button", { name: /join game/i }).click();
      await expect(
        page.getByRole("button", { name: /start round/i }),
      ).toBeVisible();

      // The room again, now with a player in it.
      await goto(page, roomPath);
      // The chooser listing the room in progress.
      await goto(page, `/game/${gameId}/play`);
      await expect(page).toHaveURL(`/game/${gameId}/play`);
      // The profile, now with a game in progress.
      await goto(page, "/profile");

      // A guest opening the room.
      const guest = await newPage(browser, timezoneId, { loggedIn: false });
      const guestErrors = trackHydrationErrors(guest);
      await goto(guest, roomPath);
      await expect(
        guest.getByRole("button", { name: /join game/i }),
      ).toBeVisible();
      await goto(guest, `/game/${gameId}`);
      // The TV (presenter) view of the room, with its QR code.
      await goto(guest, `${roomPath}/present`);
      await expect(guest.getByTestId("join-qr")).toBeVisible();

      expect(errors).toEqual([]);
      expect(guestErrors).toEqual([]);

      await guest.context().close();
      await page.context().close();
    });
  }
});
