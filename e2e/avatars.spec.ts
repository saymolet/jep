import { expect, test } from "@playwright/test";

import { goto, pickEmoji } from "./helpers";

test.describe("avatars", () => {
  test("join with an emoji avatar, then change it in game", async ({
    page,
  }) => {
    await goto(page, "/mock");
    await pickEmoji(page, "🦊");
    await page.getByRole("button", { name: /join game/i }).click();

    const icons = page.getByTestId("player-icon");
    await expect(icons.filter({ hasText: "🦊" }).first()).toBeVisible();

    await page.getByRole("button", { name: /start round/i }).click();
    // The round preview dialog has its own "Change avatar" button; wait for
    // it to close so the click below hits the one next to the board.
    await expect(
      page.getByRole("button", { name: /start round/i }),
    ).toBeHidden();

    // Change it from the score box next to the name.
    await page.getByRole("button", { name: "Change avatar" }).click();
    await expect(
      page.getByRole("heading", { name: "Choose your avatar" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Avatar 🐙" }).click();
    await expect(
      page.getByRole("heading", { name: "Choose your avatar" }),
    ).toBeHidden();
    await expect(icons.filter({ hasText: "🐙" })).toBeVisible();
    await expect(icons.filter({ hasText: "🦊" })).toHaveCount(0);

    // The pick is remembered on this device for the next join.
    await goto(page, "/mock");
    await expect(
      page.getByRole("button", { name: "Avatar 🐙" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
