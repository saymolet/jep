import { expect, test, type Page } from "@playwright/test";

import { openClue, startMockGame, stubExternalMedia } from "./helpers";

/** Press Enter until the buzz is won and the options become pickable. */
async function buzzUntilPicking(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(page.getByText("Pick your answer")).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
}

function option(page: Page, letter: string) {
  return page.locator(`[data-testid="choices"] [data-choice="${letter}"]`);
}

test.describe("multiple choice questions (solo)", () => {
  test.beforeEach(async ({ page }) => {
    await stubExternalMedia(page);
  });

  test("options are shown while reading and a pick is checked automatically", async ({
    page,
  }) => {
    await startMockGame(page, "/mock?game=choice");

    // Capitals $200: Sydney / Canberra (correct) / Melbourne / Perth.
    await openClue(page, page.getByRole("button", { name: "$ 200" }).first());
    await expect(page.getByTestId("choices").locator("li")).toHaveCount(4);
    await expect(page.getByTestId("choices")).toContainText("Canberra");
    // Nothing to tap while the question is read; buzzing works as before.
    await expect(page.getByTestId("choices").locator("button")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toHaveCount(0);

    await buzzUntilPicking(page);
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeHidden();
    await page.getByRole("button", { name: "A: Sydney" }).click();

    // The only player picked wrong: everyone sees the wrong pick and the
    // correct option.
    await expect(option(page, "A")).toHaveAttribute("data-status", "wrong");
    await expect(option(page, "B")).toHaveAttribute("data-status", "correct");
    await expect(page.getByText("-$200").first()).toBeVisible();
    await page.getByRole("button", { name: /back to board/i }).click();

    // Capitals $400: Ottawa is option C; pick it with the keyboard.
    await openClue(page, page.getByRole("button", { name: "$ 400" }).first());
    await buzzUntilPicking(page);
    await page.waitForTimeout(600); // pick debounce after winning the buzz
    await page.keyboard.press("3");
    await expect(option(page, "C")).toHaveAttribute("data-status", "correct");
    await expect(page.getByText("$200").first()).toBeVisible();
  });

  test("a wagerable multiple choice question", async ({ page }) => {
    await startMockGame(page, "/mock?game=choice");

    // Mixed Bag $600 is wagerable: Ag / Au (correct) / Gd / Go.
    await expect(async () => {
      await page.getByRole("button", { name: "$ 600" }).nth(1).click();
      await expect(page.getByText(/how much will you wager/i)).toBeVisible({
        timeout: 1_000,
      });
    }).toPass({ timeout: 10_000 });
    await page.locator('input[name="wager"]').fill("100");
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page.getByTestId("choices").locator("li")).toHaveCount(4);
    await buzzUntilPicking(page);
    await page.getByRole("button", { name: "B: Au" }).click();
    await expect(option(page, "B")).toHaveAttribute("data-status", "correct");
    await expect(page.getByText("$100").first()).toBeVisible();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 664 }, hasTouch: true });

    test("options and the buzzer fit on screen, with a picture", async ({
      page,
    }) => {
      await startMockGame(page, "/mock?game=choice");

      // Mixed Bag $400 has a picture and four options.
      await openClue(page, page.getByRole("button", { name: "$ 400" }).nth(1));
      await expect(page.getByTestId("clue-media")).toBeVisible();
      const choices = page.getByTestId("choices");
      await expect(choices.locator("li")).toHaveCount(4);
      const viewport = page.viewportSize()!;

      // The question (the buzz target) and every option are fully on screen
      // (retried until the prompt's open animation is done).
      await expect(page.getByText("Who painted this portrait?")).toBeInViewport(
        { ratio: 1 },
      );
      for (const item of await choices.locator("li").all()) {
        await expect(item).toBeInViewport({ ratio: 1 });
      }

      // The big BUZZ button doesn't cover the options.
      const buzzer = page.getByTestId("buzz-bar").getByRole("button");
      const buzzerTop = (await buzzer.boundingBox())!.y;
      const lastOption = (await choices.locator("li").last().boundingBox())!;
      expect(lastOption.y + lastOption.height).toBeLessThanOrEqual(buzzerTop);

      // Tap BUZZ once the read time is over, then tap an option: big,
      // full-width tap targets.
      await expect(buzzer).toHaveAttribute("data-state", "open", {
        timeout: 15_000,
      });
      await buzzer.tap();
      await expect(page.getByText("Pick your answer")).toBeVisible();
      const button = page.getByRole("button", { name: "B: Leonardo da Vinci" });
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThan(viewport.width * 0.8);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await page.waitForTimeout(600);
      await button.tap();
      await expect(option(page, "B")).toHaveAttribute("data-status", "correct");
    });
  });
});
