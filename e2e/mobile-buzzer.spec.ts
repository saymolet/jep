import {
  devices,
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

import { goto, startMockGame, stubExternalMedia } from "./helpers";

// Chromium with the iPhone 13 screen, touch and mobile viewport (WebKit isn't
// installed for the e2e suite).
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
  devices["iPhone 13"];
const iPhone13 = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };

function buzzBar(page: Page) {
  return page.getByTestId("buzz-bar").getByRole("button");
}

/** Record every state the BUZZ button goes through (in a data attribute on
 * <body>), so short-lived states (the 250ms lockout) can't be missed by
 * polling. */
async function recordBuzzStates(page: Page) {
  await page.evaluate(() => {
    const states: string[] = [];
    const record = () => {
      const el = document.querySelector("[data-testid=buzz-bar] button");
      const state = el?.getAttribute("data-state");
      if (state && states.at(-1) !== state) {
        states.push(state);
        document.body.dataset.buzzStates = states.join(",");
      }
    };
    record();
    new MutationObserver(record).observe(document.body, {
      attributeFilter: ["data-state"],
      childList: true,
      subtree: true,
    });
  });
}

async function buzzStates(page: Page) {
  const states = await page.evaluate(() => document.body.dataset.buzzStates);
  return (states ?? "").split(",");
}

/** Tap a clue on the board, retrying until the BUZZ button appears. */
async function tapClue(page: Page, clueButton: Locator) {
  await expect(async () => {
    await clueButton.tap();
    await expect(buzzBar(page)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

/** Wait until the buzzers open, then tap the BUZZ button. */
async function buzzWhenOpen(page: Page) {
  await expect(buzzBar(page)).toHaveAttribute("data-state", "open", {
    timeout: 20_000,
  });
  await buzzBar(page).tap();
}

test.describe("mobile buzzer (iPhone 13)", () => {
  test.use(iPhone13);

  test.beforeEach(async ({ page }) => {
    await stubExternalMedia(page);
  });

  test("tapping while waiting locks out; tapping when open wins the buzz", async ({
    page,
  }) => {
    // Capitals $200 is a multiple choice question read for about 4 seconds.
    await startMockGame(page, "/mock?game=choice");
    await tapClue(page, page.getByRole("button", { name: "$ 200" }).first());

    const bar = buzzBar(page);
    await expect(bar).toHaveAttribute("data-state", "waiting");
    await expect(bar).toContainText("Wait…");
    await expect(page.getByText(/tap the button below/i)).toBeVisible();
    // Big, full-width thumb target at the bottom of the screen (once the
    // prompt has slid in).
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("no viewport");
    await expect
      .poll(async () => {
        const box = await bar.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBeGreaterThan(viewport.height - 40);
    const box = await bar.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(72);
    expect((box?.width ?? 0) / viewport.width).toBeGreaterThan(0.9);

    await recordBuzzStates(page);
    // Retry: taps right after the question opens are ignored on purpose.
    await expect(async () => {
      await bar.tap();
      await expect
        .poll(() => buzzStates(page), { timeout: 500 })
        .toContain("tooEarly");
    }).toPass({ timeout: 3_000 });

    await expect(bar).toHaveAttribute("data-state", "open", {
      timeout: 20_000,
    });
    await expect(bar).toContainText("BUZZ!");
    // Tapping the question itself doesn't buzz on a phone.
    await page.getByTestId("clue-buzz-area").tap();
    await page.waitForTimeout(300);
    await expect(bar).toHaveAttribute("data-state", "open");

    await bar.tap();
    // The options become pickable and the BUZZ button gets out of the way.
    await expect(page.getByText("Pick your answer")).toBeVisible();
    await expect(page.getByTestId("buzz-bar")).toHaveCount(0);
    expect(await buzzStates(page)).toContain("won");
    const canberra = page.getByRole("button", { name: "B: Canberra" });
    await expect(canberra).toBeInViewport();
    // Picks are ignored for a moment after winning the buzz.
    await expect(async () => {
      await canberra.tap();
      await expect(
        page.getByRole("button", { name: /back to board/i }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
  });

  test("the media play control doesn't buzz", async ({ page }) => {
    await startMockGame(page, "/mock?game=media");
    // Second column ("Music & Film") $200 is an audio-only question.
    await tapClue(page, page.getByRole("button", { name: "$ 200" }).nth(1));
    await recordBuzzStates(page);

    const play = page.getByRole("button", { name: /(play|pause) audio/i });
    await play.tap();
    await play.tap();
    await expect(buzzBar(page)).toHaveAttribute("data-state", /waiting|open/);
    expect(await buzzStates(page)).not.toContain("tooEarly");
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toHaveCount(0);

    await buzzWhenOpen(page);
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeVisible();
  });

  test("speaks Ukrainian", async ({ page, context }) => {
    await context.addCookies([
      { name: "lang", value: "uk", url: "http://localhost" },
    ]);
    await goto(page, "/mock");
    await page.getByRole("button", { name: "Приєднатися" }).click();
    const startRound = page.getByRole("button", { name: "Почати раунд" });
    await startRound.click();
    await expect(startRound).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

    await tapClue(page, page.getByRole("button", { name: "$ 200" }).first());
    const bar = buzzBar(page);
    await expect(bar).toContainText("Чекай…");
    await expect(page.getByText("Тисни кнопку внизу")).toBeVisible();
    await expect(bar).toContainText("ТИСНИ!", { timeout: 20_000 });
    await bar.tap();
    await expect(
      page.getByRole("button", { name: "Показати відповідь" }),
    ).toBeVisible();
  });
});

test.describe("desktop buzzing", () => {
  test("has no BUZZ button and still buzzes by clicking the question", async ({
    page,
  }) => {
    await startMockGame(page);
    const clueButton = page.getByRole("button", { name: "$ 200" }).first();
    await expect(async () => {
      await clueButton.click();
      await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(page.getByTestId("buzz-bar")).toBeHidden();

    const question = page.getByTestId("clue-buzz-area");
    await expect(async () => {
      await question.click();
      await expect(
        page.getByRole("button", { name: /reveal answer/i }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
  });
});
