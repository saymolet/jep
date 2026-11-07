import fs from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  openClue,
  uploadGame,
  waitForConnected,
} from "./helpers";

/* The TV screen fits a projector (feature 24): on 1920x1080 and on a laptop
 * with display scaling (1280x720 CSS pixels) the whole board is on screen
 * without scrolling, and an open question takes the whole screen with the
 * players in a strip below it. */

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

/** A big board: 8 categories of 8 questions. */
function bigPack() {
  const names = Array.from({ length: 8 }, (_, j) => `Category ${j + 1}`);
  return {
    title: "Big board",
    author: "e2e",
    copyright: "",
    note: "",
    boards: [
      {
        categoryNames: names,
        categories: names.map((name, j) => ({
          name,
          clues: Array.from({ length: 8 }, (_, i) => ({
            clue: `Question ${j + 1}-${i + 1}`,
            answer: `Answer ${j + 1}-${i + 1}`,
            value: (i + 1) * 100,
          })),
        })),
      },
    ],
  };
}

/** Nothing on `page` is cut off: no scrolling, and `locator`'s bottom is on
 * screen. */
async function expectFits(page: Page, bottomTestId: string) {
  const size = page.viewportSize()!;
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(scroll).toEqual(size);
  const box = await page.getByTestId(bottomTestId).last().boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
}

test("the TV screen fits 1080p and scaled laptop screens", async ({
  authedPage: host,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const packPath = testInfo.outputPath("big-board.jep.json");
  fs.writeFileSync(packPath, JSON.stringify(bigPack()));
  await goto(host, "/profile");
  const gameId = await uploadGame(host, packPath);
  await goto(host, `/game/${gameId}/play`);
  await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
  const roomPath = new URL(host.url()).pathname;
  await waitForConnected(host);

  const tvs: Page[] = [];
  for (const viewport of SIZES) {
    const tv = await (await browser.newContext({ viewport })).newPage();
    // Like a TV nobody has touched yet (Playwright's Chromium reports the
    // page as already activated).
    await tv.addInitScript(() => {
      Object.defineProperty(navigator, "userActivation", {
        value: { hasBeenActive: false, isActive: false },
      });
    });
    await goto(tv, `${roomPath}/present`);
    await waitForConnected(tv);
    tvs.push(tv);
  }

  // One click on each TV turns on its sound (and fullscreen).
  for (const tv of tvs) {
    await tv.getByTestId("presenter-start").click();
    await expect(tv.getByTestId("presenter-start")).toBeHidden();
  }

  await host.getByRole("button", { name: /join game/i }).click();
  // A TV is connected: the sound plays there, not on the players' devices.
  await expect(host.getByTestId("sound-on-tv").first()).toBeAttached({
    timeout: 10_000,
  });
  await clickStartRound(host);

  for (const tv of tvs) {
    await expect(tv.getByTestId("viewer-status")).toHaveText(
      /is choosing a question/,
      { timeout: 10_000 },
    );
    // The bottom row ($800) is on screen.
    await expect(tv.getByText("800").first()).toBeVisible();
    await expect(async () => {
      const last = await tv.locator("tbody tr").last().boundingBox();
      expect(last!.y + last!.height).toBeLessThanOrEqual(
        tv.viewportSize()!.height,
      );
    }).toPass({ timeout: 5_000 });
    await expectFits(tv, "fit-to-box");
  }

  // An open question takes the whole screen; players are in a strip below.
  await openClue(host, host.getByRole("button", { name: "$ 800" }).first());
  for (const tv of tvs) {
    await expect(tv.getByTestId("presenter-prompt")).toBeVisible({
      timeout: 10_000,
    });
    await expect(tv.getByTestId("presenter-players")).toBeHidden();
    await expect(tv.getByTestId("presenter-player-strip")).toBeVisible();
    await expectFits(tv, "presenter-player-strip");
  }
});
