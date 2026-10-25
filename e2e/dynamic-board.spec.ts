import { expect, test, type Page } from "@playwright/test";

import { openClue, startMockGame } from "./helpers";

/** The clue button at row i, column j of the game board. */
function cell(page: Page, i: number, j: number) {
  return page
    .getByTestId("board-scroller")
    .locator("tbody tr")
    .nth(i)
    .locator("td")
    .nth(j)
    .locator("button");
}

/** Answer the clue at (i, j) correctly and close it. */
async function answerCell(page: Page, i: number, j: number) {
  await openClue(page, cell(page, i, j));

  // Press Enter to buzz in, retrying until the read timer finishes.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  const revealButton = page.getByRole("button", { name: /reveal answer/i });
  await expect(revealButton).toBeEnabled({ timeout: 5_000 });
  await revealButton.click();
  await page.getByRole("button", { name: /correct!/i }).click();

  const back = page.getByRole("button", { name: /back to board/i });
  await expect(back).toBeVisible({ timeout: 5_000 });
  await back.click();
}

test.describe("boards with uneven categories", () => {
  test("plays an uneven board to the end of the round", async ({ page }) => {
    test.setTimeout(120_000);
    await startMockGame(page, "/mock?game=ragged");

    // Short (3 questions), Full (5), Middle (4): three empty cells.
    await expect(page.getByTestId("empty-cell")).toHaveCount(3);
    await expect(page.getByRole("columnheader")).toHaveCount(3);

    const cells: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [4, 1],
      [3, 1],
      [2, 1],
      [1, 1],
      [0, 1],
      [3, 2],
      [2, 2],
      [1, 2],
      [0, 2],
    ];
    for (const [i, j] of cells) {
      await answerCell(page, i, j);
    }

    // Every existing question is answered: on to round 2 (Pair 2, Single 1).
    await expect(page.getByText("Start round 2 of 2")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("$6,200").first()).toBeVisible();
    await page.getByRole("button", { name: /start round/i }).click();
    await expect(page.getByRole("columnheader")).toHaveCount(2);
    await expect(page.getByTestId("empty-cell")).toHaveCount(1);
  });
});

test.describe("boards with 8 categories", () => {
  test("fit a 390px-wide phone with finger-sized cells", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await startMockGame(page, "/mock?game=8x5");
    await expect(page.getByRole("columnheader")).toHaveCount(8);
    await expect(cell(page, 4, 7)).toBeVisible();

    const sizes = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(
        '[data-testid="board-scroller"]',
      );
      const table = scroller?.querySelector("table");
      const buttons = Array.from(
        scroller?.querySelectorAll("tbody button") ?? [],
      ).map((b) => b.getBoundingClientRect());
      return {
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        scroller: scroller
          ? [scroller.scrollWidth, scroller.clientWidth]
          : null,
        table: table?.getBoundingClientRect().right ?? Infinity,
        minButtonWidth: Math.min(...buttons.map((r) => r.width)),
        minButtonHeight: Math.min(...buttons.map((r) => r.height)),
      };
    });

    // Nothing overflows: no sideways scrolling of the page or the board.
    expect(sizes.page).toBeLessThanOrEqual(sizes.viewport);
    expect(sizes.scroller?.[0]).toBeLessThanOrEqual(sizes.scroller?.[1] ?? 0);
    expect(sizes.table).toBeLessThanOrEqual(sizes.viewport);
    // Tap targets stay at least 44px.
    expect(sizes.minButtonWidth).toBeGreaterThanOrEqual(44);
    expect(sizes.minButtonHeight).toBeGreaterThanOrEqual(44);

    await testInfo.attach("8 categories at 390px", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // The bottom-right cell is playable with a tap.
    await openClue(page, cell(page, 4, 7));
    await expect(page.getByText("Food & Drink question 5")).toBeVisible();
    await context.close();
  });

  test("use more of a big screen", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    await startMockGame(page, "/mock?game=8x5");
    const table = page.getByTestId("board-scroller").locator("table");
    await expect(table).toBeVisible();
    const box = await table.boundingBox();
    // Wider than the 1024px classic board, but not the whole TV width.
    expect(box?.width).toBeGreaterThan(1500);
    expect(box?.width).toBeLessThanOrEqual(1600);
    await context.close();
  });
});
