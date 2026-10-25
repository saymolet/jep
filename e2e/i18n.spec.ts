import { expect, test } from "@playwright/test";

import { goto, reload, trackHydrationErrors } from "./helpers";

test.describe("language", () => {
  test("is English by default", async ({ page }) => {
    await goto(page, "/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "EN" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("switches to Ukrainian and keeps it after a reload", async ({
    page,
  }) => {
    const errors = trackHydrationErrors(page);
    await goto(page, "/");
    await page.getByRole("button", { name: "УКР" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
    await expect(page.getByRole("link", { name: "Увійти" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Як грати" }).first(),
    ).toBeVisible();

    await reload(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
    await expect(page.getByRole("link", { name: "Увійти" })).toBeVisible();
    await expect(page.getByRole("button", { name: "УКР" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // And back to English.
    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await reload(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    expect(errors).toEqual([]);
  });

  test("plays a solo question in Ukrainian", async ({ page, context }) => {
    await context.addCookies([
      { name: "lang", value: "uk", url: "http://localhost" },
    ]);
    await goto(page, "/mock");
    await page.getByRole("button", { name: "Приєднатися" }).click();
    const startRound = page.getByRole("button", { name: "Почати раунд" });
    await startRound.click();
    await expect(startRound).toBeHidden();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const clueButton = page.getByRole("button", { name: "$ 200" }).first();
    await expect(async () => {
      await clueButton.click();
      await expect(page.getByText(/щоб відповідати/)).toBeVisible({
        timeout: 1_000,
      });
    }).toPass({ timeout: 10_000 });

    const reveal = page.getByRole("button", { name: "Показати відповідь" });
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(reveal).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(reveal).toBeEnabled({ timeout: 5_000 });
    await reveal.click();

    await page.getByRole("button", { name: "правильно!" }).click();
    const back = page.getByRole("button", { name: "До табло" });
    await expect(back).toBeVisible({ timeout: 5_000 });
    await back.click();
    await expect(back).toBeHidden();
  });
});

test.describe("Accept-Language: uk", () => {
  test.use({ locale: "uk-UA" });

  for (const path of ["/", "/mock", "/howto", "/about", "/login"]) {
    test(`${path} renders in Ukrainian and hydrates cleanly`, async ({
      page,
    }) => {
      const errors = trackHydrationErrors(page);
      await goto(page, path);
      await expect(page.locator("html")).toHaveAttribute("lang", "uk");
      await expect(page.locator("html")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      // By selector, not role: on /mock the join dialog hides the header
      // from the accessibility tree.
      await expect(page.locator('button[lang="uk"]').first()).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(errors).toEqual([]);
    });
  }
});
