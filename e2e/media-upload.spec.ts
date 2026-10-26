import { readFileSync } from "fs";
import path from "path";

import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  openClue,
  stubExternalMedia,
  uploadGame,
  waitForConnected,
} from "./helpers";

const MEDIA_GAME_PATH = path.resolve("app/static/mock-media.jep.json");

interface ClueJson {
  clue: string;
  media?: unknown[];
  answerMedia?: unknown[];
}
interface GameJson {
  boards: { categories: { clues: ClueJson[] }[] }[];
}

function clueMedia(game: GameJson) {
  return game.boards.flatMap((b) =>
    b.categories.flatMap((c) =>
      c.clues.map(({ clue, media, answerMedia }) => ({
        clue,
        media,
        answerMedia,
      })),
    ),
  );
}

test.describe("uploaded media questions", () => {
  test("media survives upload and export, and plays in a room", async ({
    authedPage: page,
  }) => {
    await stubExternalMedia(page);
    await goto(page, "/profile");
    const gameId = await uploadGame(page, MEDIA_GAME_PATH);

    // The JSON export round-trips media and answer media through the DB.
    const response = await page.request.get(`/game/${gameId}/json`);
    expect(response.ok()).toBe(true);
    const exported: GameJson = await response.json();
    const original: GameJson = JSON.parse(
      readFileSync(MEDIA_GAME_PATH, "utf-8"),
    );
    expect(clueMedia(exported)).toEqual(clueMedia(original));

    // Open the audio question in a real room.
    await goto(page, `/game/${gameId}/play`);
    await expect(page).toHaveURL(/\/room\/\d+-\w+$/);
    await waitForConnected(page);
    await page.getByRole("button", { name: /join game/i }).click();
    await clickStartRound(page);

    await openClue(page, page.getByRole("button", { name: "$ 200" }).nth(1));
    await expect(page.locator("audio")).toHaveAttribute(
      "src",
      /Beethoven_Moonlight_1st_movement\.ogg\.mp3$/,
    );
    await expect(
      page.getByRole("button", { name: /(play|pause) audio/i }),
    ).toBeVisible();
  });
});
