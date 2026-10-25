import { expect, test } from "@playwright/test";

import { goto, trackHydrationErrors } from "./helpers";

// A hydration mismatch makes React throw away the server HTML and re-render
// the page on the client, which delays interactivity (and loses taps on slow
// phones). These pages must hydrate cleanly.
const PAGES = [
  "/",
  "/mock",
  "/mock?game=choice",
  "/mock?game=secret",
  "/mockPersistent",
  "/howto",
  "/about",
  "/community",
  "/login",
  "/signup",
];

// The server renders in its own time zone, so render in time zones far from
// it (together these two always disagree with the server about the date).
for (const timezoneId of ["Pacific/Kiritimati", "Etc/GMT+12"]) {
  test.describe(`hydration (${timezoneId})`, () => {
    test.use({ timezoneId });

    for (const path of PAGES) {
      test(`${path} hydrates without a mismatch`, async ({ page }) => {
        const errors = trackHydrationErrors(page);
        await goto(page, path);
        await expect(page.locator("html")).toHaveAttribute(
          "data-hydrated",
          "true",
        );
        expect(errors).toEqual([]);
      });
    }
  });
}
