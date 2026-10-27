import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { goto, uploadGame } from "./helpers";

/** Set for the test server by scripts/with-local-supabase.sh. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

/** Each test comes from its own (fake) address, so the admin login lockout
 * of one test never affects another (see admin.spec.ts). */
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({
    "X-Real-IP": `10.${octet()}.${octet()}.${octet()}`,
  });
});

/** expectNoAccountLogin checks that the page offers no way to log in or
 * sign up (accounts are hidden from the UI). */
async function expectNoAccountLogin(page: Page) {
  await expect(
    page.getByRole("link", { name: /log in|sign up|увійти/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /log in|sign up|увійти/i }),
  ).toHaveCount(0);
  await expect(
    page.locator('a[href^="/login"], a[href^="/signup"]'),
  ).toHaveCount(0);
}

test.describe("header admin button", () => {
  test("leads to the admin login, then shows the active state", async ({
    page,
  }) => {
    await goto(page, "/");
    const header = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    const adminLink = header.getByRole("link", { name: "Admin", exact: true });
    await expect(adminLink).toHaveAttribute("data-active", "false");
    await adminLink.click();
    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin$/);

    await page.getByLabel("Admin password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const activeLink = header.getByRole("link", { name: "Admin panel" });
    await expect(activeLink).toHaveAttribute("data-active", "true");
    await goto(page, "/");
    await expect(activeLink).toBeVisible();
    await expect(activeLink).toHaveAttribute("data-active", "true");
  });

  test("is in Ukrainian", async ({ page, baseURL }) => {
    await page
      .context()
      .addCookies([{ name: "lang", value: "uk", url: baseURL }]);
    await goto(page, "/");
    await expect(
      page.getByRole("link", { name: "Адміністратор", exact: true }),
    ).toHaveAttribute("title", "Адміністратор");
  });
});

test.describe("hidden account login", () => {
  test("a guest sees no log in on the home, game and room pages", async ({
    authedPage,
    browser,
  }) => {
    // An account uploads a game; a guest then opens it and a room.
    await goto(authedPage, "/profile");
    const gameId = await uploadGame(authedPage);

    const context = await browser.newContext();
    const page = await context.newPage();

    await goto(page, "/");
    await expectNoAccountLogin(page);

    await goto(page, `/game/${gameId}`);
    await expectNoAccountLogin(page);

    await goto(page, `/game/${gameId}/play`);
    await expect(page).toHaveURL(/\/room\/\d+-\w+$/);
    await expect(
      page.getByRole("button", { name: /join game/i }),
    ).toBeVisible();
    await expectNoAccountLogin(page);

    await context.close();
  });
});
