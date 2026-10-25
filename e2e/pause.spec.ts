import { expect, test } from "@playwright/test";

import { startMockGame } from "./helpers";

test.describe("pause game", () => {
  test("pause shows an overlay for everyone; resume restores play", async ({
    page,
  }) => {
    await startMockGame(page);

    // On the board, the Pause control is available.
    const pauseButton = page.getByRole("button", { name: "Pause game" });
    await expect(pauseButton).toBeEnabled({ timeout: 10_000 });

    // Pausing shows the full-screen paused overlay.
    await pauseButton.click();
    const overlay = page.getByTestId("paused-overlay");
    await expect(overlay).toBeVisible();
    await expect(page.getByText(/game paused/i)).toBeVisible();

    // Resuming from the overlay dismisses it.
    await overlay.getByRole("button", { name: "Resume game" }).click();
    await expect(overlay).toBeHidden();

    // After resuming, gameplay works again: a clue can be opened.
    const clueButton = page.getByRole("button", { name: "$ 200" }).first();
    await expect(async () => {
      await clueButton.click();
      await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
  });
});
