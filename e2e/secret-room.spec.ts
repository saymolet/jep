import { readFileSync } from "fs";
import path from "path";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  stubExternalMedia,
  uploadGame,
  waitForConnected,
} from "./helpers";

const SECRET_GAME_PATH = path.resolve("app/static/mock-secret.jep.json");

interface GameJson {
  boards: {
    categories: {
      clues: { secret?: boolean; secretTopic?: string; secretValue?: number }[];
    }[];
  }[];
}

function allSecrets(game: GameJson) {
  return game.boards.flatMap((b) =>
    b.categories.flatMap((c) =>
      c.clues.map(({ secret, secretTopic, secretValue }) => ({
        secret,
        secretTopic,
        secretValue,
      })),
    ),
  );
}

/** Click a cell, retrying until the "cat in the bag" screen opens. */
async function chooseSecret(page: Page, name: string, nth = 0) {
  await expect(async () => {
    await page.getByRole("button", { name }).nth(nth).click();
    await expect(page.getByText("Cat in the bag!").first()).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 10_000 });
}

test.describe("secret questions in a room", () => {
  test("the chooser hands the question to the other player", async ({
    authedPage: host,
    browser,
  }) => {
    await stubExternalMedia(host);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, SECRET_GAME_PATH);

    // The JSON export round-trips the secret fields through the DB.
    const response = await host.request.get(`/game/${gameId}/json`);
    expect(response.ok()).toBe(true);
    const exported: GameJson = await response.json();
    const original: GameJson = JSON.parse(
      readFileSync(SECRET_GAME_PATH, "utf-8"),
    );
    expect(allSecrets(exported)).toEqual(allSecrets(original));

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

    // Animals $400 is a secret question on "Famous cats" worth $500.
    await chooseSecret(host, "$ 400");
    await expect(guest.getByText("Cat in the bag!").first()).toBeVisible();
    for (const page of [host, guest]) {
      await expect(page.getByText("Famous cats")).toBeVisible();
    }
    await expect(
      guest.getByText(/is choosing who gets the secret question/i),
    ).toBeVisible();
    await expect(
      guest.getByRole("list", { name: "Players" }).getByRole("button"),
    ).toHaveCount(0);

    // The host can only give it to the guest.
    const choices = host
      .getByRole("list", { name: "Players" })
      .getByRole("button");
    await expect(choices).toHaveCount(1);
    await choices.click();

    // Only the guest answers.
    await expect(guest.getByTestId("secret-receiver")).toHaveText(
      /your secret question/i,
    );
    await expect(host.getByTestId("secret-receiver")).toHaveText(
      /secret question for/i,
    );
    await expect(
      host.getByRole("button", { name: /reveal answer/i }),
    ).toHaveCount(0);
    await guest.getByRole("button", { name: /reveal answer/i }).click();
    await guest.getByRole("button", { name: /^incorrect$/i }).click();

    // Wrong: the guest loses $500 and the host keeps board control.
    await expect(guest.getByText("-$500").first()).toBeVisible();
    await expect(host.getByText("-$500").first()).toBeVisible();
    await host.getByRole("button", { name: /back to board/i }).click();

    // Science $200 is a secret multiple choice question: Ir / Fe (correct).
    await chooseSecret(host, "$ 200", 1);
    await host
      .getByRole("list", { name: "Players" })
      .getByRole("button")
      .click();
    await expect(guest.getByText("Pick your answer")).toBeVisible();
    await expect(host.getByText(/waiting for .* to pick/i)).toBeVisible();
    await guest.waitForTimeout(600); // pick debounce
    await guest.getByRole("button", { name: "B: Fe" }).click();

    // Right: the guest scores $200 (now -$300) and takes board control.
    for (const page of [host, guest]) {
      await expect(
        page.locator('[data-testid="choices"] [data-choice="B"]'),
      ).toHaveAttribute("data-status", "correct");
      await expect(page.getByText("-$300").first()).toBeVisible();
    }
    await expect(
      guest.getByRole("button", { name: /back to board/i }),
    ).toBeVisible();
    await expect(
      host.getByRole("button", { name: /back to board/i }),
    ).toHaveCount(0);

    await context.close();
  });
});
