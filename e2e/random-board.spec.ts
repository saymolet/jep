import { randomUUID } from "crypto";

import { expect, test, type Page } from "@playwright/test";

import { goto, waitForConnected } from "./helpers";

/** A small game with `categories` uniquely named categories of 3 questions. */
function gameJson(categories: number) {
  const id = randomUUID().slice(0, 8);
  const names = Array.from(
    { length: categories },
    (_, k) => `Random E2E ${id} ${k + 1}`,
  );
  return JSON.stringify({
    title: `Random source ${id}`,
    author: "E2E",
    copyright: "",
    note: "",
    boards: [
      {
        categoryNames: names,
        categories: names.map((name) => ({
          name,
          clues: [200, 400, 600].map((value) => ({
            clue: `${name} question ${value}`,
            answer: `answer ${value}`,
            value,
          })),
        })),
      },
    ],
  });
}

/** Upload a game publicly as a guest, so it joins the random board pool. */
async function uploadPublicGame(page: Page, categories: number) {
  await goto(page, "/");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("#upload-button").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "random-source.jep.json",
    mimeType: "application/json",
    buffer: Buffer.from(gameJson(categories)),
  });
  await page.getByRole("button", { name: /upload publicly/i }).click();
  await expect(page.getByText(/created new public game/i)).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("random board", () => {
  test("generates a board from public games and opens a new room", async ({
    page,
  }) => {
    await uploadPublicGame(page, 3);
    await uploadPublicGame(page, 3);

    await goto(page, "/");
    await page.getByRole("link", { name: "Random board" }).click();
    await expect(
      page.getByRole("heading", { name: "Random board" }),
    ).toBeVisible();

    await page.getByText("3", { exact: true }).click();
    await page.getByText("Add a final question").click();
    await page
      .getByRole("button", { name: "Generate and play with friends" })
      .click();

    await expect(page).toHaveURL(/\/room\/\d+-\w+$/, { timeout: 15_000 });
    await waitForConnected(page);
    await expect(page.getByText(/Random board · /).first()).toBeVisible();

    await page.getByRole("button", { name: /join game/i }).click();
    const startRound = page.getByRole("button", { name: /start round/i });
    await startRound.click();
    await expect(startRound).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("columnheader")).toHaveCount(3);
  });

  test("works in Ukrainian with two rounds and solo play", async ({
    page,
    context,
  }) => {
    await uploadPublicGame(page, 4);
    await uploadPublicGame(page, 4);

    await context.addCookies([
      { name: "lang", value: "uk", url: "http://localhost" },
    ]);
    await goto(page, "/random-board");
    await expect(
      page.getByRole("heading", { name: "Випадкова гра" }),
    ).toBeVisible();
    await expect(page.getByText("Категорій у раунді")).toBeVisible();

    await page.getByText("4", { exact: true }).click();
    await page.getByText("2 раунди").click();
    await page.getByRole("button", { name: "Створити й грати самому" }).click();

    await expect(page).toHaveURL(/\/game\/[^/]+\/solo$/, { timeout: 15_000 });
    await expect(page.getByText(/Випадкова гра · /).first()).toBeVisible();
    await page.getByRole("button", { name: "Приєднатися" }).click();
    const startRound = page.getByRole("button", { name: "Почати раунд" });
    await startRound.click();
    await expect(startRound).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole("columnheader")).toHaveCount(4);
  });
});
