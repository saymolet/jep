import { expect, test, type Page } from "@playwright/test";

import { goto, reload, startMockGame, trackHydrationErrors } from "./helpers";

/** Page background (Classic: white; Dark: charcoal #0e1117). */
const CLASSIC_PAGE = "rgb(255, 255, 255)";
const DARK_PAGE = "rgb(14, 17, 23)";

function pageBackground(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

function colorScheme(page: Page) {
  return page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
}

async function themeCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === "theme")?.value;
}

test.describe("themes", () => {
  test("Classic by default", async ({ page }) => {
    await goto(page, "/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
    expect(await pageBackground(page)).toBe(CLASSIC_PAGE);
    expect(await colorScheme(page)).toBe("light");
  });

  test("switches to Dark from the header and keeps it after a reload", async ({
    page,
  }) => {
    const errors = trackHydrationErrors(page);
    await goto(page, "/");

    await page.getByRole("button", { name: "Theme: Classic" }).click();
    await page
      .getByRole("menuitemradio", { name: "Dark", exact: true })
      .click();

    // Applied at once, without a reload.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(() => pageBackground(page)).toBe(DARK_PAGE);
    expect(await colorScheme(page)).toBe("dark");
    expect(await themeCookie(page)).toBe("dark");

    await reload(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await pageBackground(page)).toBe(DARK_PAGE);
    await expect(
      page.getByRole("button", { name: "Theme: Dark" }),
    ).toBeVisible();

    // Back to Classic.
    await page.getByRole("button", { name: "Theme: Dark" }).click();
    await page
      .getByRole("menuitemradio", { name: "Classic", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
    await expect.poll(() => pageBackground(page)).toBe(CLASSIC_PAGE);
    expect(await themeCookie(page)).toBe("classic");

    expect(errors).toEqual([]);
  });

  test("plays a solo question in Dark", async ({ page, context }) => {
    await context.addCookies([
      { name: "theme", value: "dark", url: "http://localhost" },
    ]);
    const errors = trackHydrationErrors(page);
    await startMockGame(page, "/mock");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const clueButton = page.getByRole("button", { name: "$ 200" }).first();
    await expect(async () => {
      await clueButton.click();
      await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });

  test("the theme menu is in Ukrainian", async ({ page, context }) => {
    await context.addCookies([
      { name: "lang", value: "uk", url: "http://localhost" },
    ]);
    await goto(page, "/");
    await page.getByRole("button", { name: "Тема: Класична" }).click();
    await expect(
      page.getByRole("menuitemradio", { name: "Класична", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("menuitemradio", { name: "Темна", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(
      page.getByRole("button", { name: "Тема: Темна" }),
    ).toBeVisible();
    await expect(page.getByRole("menuitemradio")).toHaveCount(0);
    await page.getByRole("button", { name: "Тема: Темна" }).click();
    await expect(
      page.getByRole("menuitemradio", { name: "Системна", exact: true }),
    ).toBeVisible();
  });
});

for (const [theme, scheme, background] of [
  ["dark", "light", DARK_PAGE],
  ["system", "dark", DARK_PAGE],
  ["system", "light", CLASSIC_PAGE],
] as const) {
  test.describe(`theme ${theme}, device ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    for (const path of ["/", "/mock", "/howto", "/login"]) {
      test(`${path} renders without a hydration mismatch`, async ({
        page,
        context,
      }) => {
        await context.addCookies([
          { name: "theme", value: theme, url: "http://localhost" },
        ]);
        const errors = trackHydrationErrors(page);
        await goto(page, path);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(await pageBackground(page)).toBe(background);
        expect(errors).toEqual([]);
      });
    }
  });
}
