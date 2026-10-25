import { expect, test, type Locator, type Page } from "@playwright/test";

import { startMockGame, stubExternalMedia } from "./helpers";

/** Click a secret question on the board, retrying until its prompt opens
 * (the board fill animation silently ignores clicks). */
async function openSecretClue(page: Page, clueButton: Locator) {
  await expect(async () => {
    await clueButton.click();
    await expect(page.getByTestId("secret-receiver")).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 10_000 });
}

test.describe("secret questions (solo)", () => {
  test.beforeEach(async ({ page }) => {
    await stubExternalMedia(page);
  });

  test("alone, the chooser gets the secret question and answers it", async ({
    page,
  }) => {
    await startMockGame(page, "/mock?game=secret");

    // Animals $400 looks like any other cell but is a secret question worth
    // $500 on "Famous cats".
    await openSecretClue(
      page,
      page.getByRole("button", { name: "$ 400" }).first(),
    );
    await expect(page.getByTestId("secret-receiver")).toHaveText(
      /your secret question/i,
    );
    await expect(page.getByText("Famous cats")).toBeVisible();
    await expect(page.getByText(/buzz in/i)).toBeHidden();

    await page.getByRole("button", { name: /reveal answer/i }).click();
    await page.getByRole("button", { name: /correct!/i }).click();
    await expect(page.getByText("$500").first()).toBeVisible();
    await page.getByRole("button", { name: /back to board/i }).click();

    // Science $200 is a secret multiple choice question: Ir / Fe (correct).
    await openSecretClue(
      page,
      page.getByRole("button", { name: "$ 200" }).nth(1),
    );
    await expect(page.getByText("Pick your answer")).toBeVisible();
    await page.waitForTimeout(600); // pick debounce
    await page.getByRole("button", { name: "B: Fe" }).click();
    await expect(
      page.locator('[data-testid="choices"] [data-choice="B"]'),
    ).toHaveAttribute("data-status", "correct");
    await expect(page.getByText("$700").first()).toBeVisible();
  });
});
