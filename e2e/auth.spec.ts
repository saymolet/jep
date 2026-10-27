import { expect, test } from "@playwright/test";

import {
  test as authedTest,
  expect as authedExpect,
  TEST_EMAIL,
} from "./fixtures";
import { goto } from "./helpers";

test.describe("auth (unauthenticated)", () => {
  test("redirects to login when visiting /profile unauthenticated", async ({
    page,
  }) => {
    await goto(page, "/profile");

    // Should redirect to /login with redirectTo param
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fprofile/);

    // Login form should be visible
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await goto(page, "/login");

    await page.getByLabel(/email address/i).fill("fake@example.com");
    await page.locator("input#password").fill("wrongpassword");
    await page
      .getByRole("main")
      .getByRole("button", { name: /log in/i })
      .click();

    // Should show an error message and stay on /login
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

authedTest.describe("auth (authenticated)", () => {
  authedTest(
    "can visit /profile without redirect",
    async ({ authedPage: page }) => {
      await goto(page, "/profile");

      // Should stay on /profile (not redirected to /login)
      await authedExpect(page).toHaveURL(/\/profile/);

      // User email should be visible on the profile page
      await authedExpect(page.getByText(TEST_EMAIL)).toBeVisible();
    },
  );

  authedTest(
    "header keeps the profile link for an existing account session",
    async ({ authedPage: page }) => {
      await goto(page, "/");

      // AccountButton renders as a Link with aria-label="Profile"
      await authedExpect(
        page.getByRole("link", { name: /profile/i }),
      ).toBeVisible();

      // Logging in is hidden from the UI: no "Log in" link either way
      await authedExpect(
        page.getByRole("link", { name: /log in/i }),
      ).not.toBeVisible();
    },
  );

  authedTest(
    "visiting /login redirects away when already authenticated",
    async ({ authedPage: page }) => {
      await goto(page, "/login");

      // The login loader redirects authenticated users to /
      await authedExpect(page).not.toHaveURL(/\/login/);
    },
  );
});
