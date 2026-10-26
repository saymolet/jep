import { readFileSync } from "fs";
import path from "path";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  openClue,
  stubExternalMedia,
  uploadGame,
  waitForConnected,
} from "./helpers";

const CHOICE_GAME_PATH = path.resolve("app/static/mock-choice.jep.json");

interface GameJson {
  boards: { categories: { clues: { choices?: string[] }[] }[] }[];
}

function allChoices(game: GameJson) {
  return game.boards.flatMap((b) =>
    b.categories.flatMap((c) => c.clues.map((clue) => clue.choices)),
  );
}

function option(page: Page, letter: string) {
  return page.locator(`[data-testid="choices"] [data-choice="${letter}"]`);
}

async function buzzUntilPicking(page: Page) {
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(page.getByText("Pick your answer")).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 20_000 });
}

test.describe("multiple choice questions in a room", () => {
  test("two players: a wrong pick locks out, the other picks right", async ({
    authedPage: host,
    browser,
  }) => {
    await stubExternalMedia(host);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, CHOICE_GAME_PATH);

    // The JSON export round-trips the options through the DB.
    const response = await host.request.get(`/game/${gameId}/json`);
    expect(response.ok()).toBe(true);
    const exported: GameJson = await response.json();
    const original: GameJson = JSON.parse(
      readFileSync(CHOICE_GAME_PATH, "utf-8"),
    );
    expect(allChoices(exported)).toEqual(allChoices(original));

    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    await waitForConnected(host);
    await host.getByRole("button", { name: /join game/i }).click();
    await expect(host.getByRole("button", { name: /join game/i })).toBeHidden({
      timeout: 10_000,
    });

    // A second, anonymous player joins the same room.
    const context = await browser.newContext();
    const guest = await context.newPage();
    await stubExternalMedia(guest);
    await goto(guest, roomUrl);
    await waitForConnected(guest);
    await guest.getByRole("button", { name: /join game/i }).click();
    await expect(guest.getByRole("button", { name: /join game/i })).toBeHidden({
      timeout: 10_000,
    });

    await clickStartRound(host);

    // Capitals $200: Sydney / Canberra (correct) / Melbourne / Perth.
    await openClue(host, host.getByRole("button", { name: "$ 200" }).first());
    await expect(guest.getByTestId("choices").locator("li")).toHaveCount(4);

    // The host wins the buzz and picks wrong.
    await buzzUntilPicking(host);
    await expect(guest.getByText(/waiting for .* to pick/i)).toBeVisible();
    await host.getByRole("button", { name: "A: Sydney" }).click();

    // Everyone sees the wrong pick; the answer stays hidden; the host is
    // locked out and the guest can buzz in.
    for (const page of [host, guest]) {
      await expect(option(page, "A")).toHaveAttribute("data-status", "wrong");
      await expect(option(page, "B")).toHaveAttribute("data-status", "neutral");
    }

    await buzzUntilPicking(guest);
    await guest.getByRole("button", { name: "B: Canberra" }).click();

    for (const page of [host, guest]) {
      await expect(option(page, "B")).toHaveAttribute("data-status", "correct");
      await expect(option(page, "A")).toHaveAttribute("data-status", "wrong");
    }
    // The guest scored and now controls the board.
    await expect(guest.getByText("$200").first()).toBeVisible();
    await expect(host.getByText("-$200").first()).toBeVisible();

    await context.close();
  });
});
