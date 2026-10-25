import { expect, test } from "@playwright/test";

import { stubExternalMedia, openClue, startMockGame } from "./helpers";

const AUDIO_SRC =
  "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/eb/Beethoven_Moonlight_1st_movement.ogg/Beethoven_Moonlight_1st_movement.ogg.mp3";

test.describe("media questions", () => {
  test.beforeEach(async ({ page }) => {
    await stubExternalMedia(page);
  });

  test("an audio question shows a play control and stops when it closes", async ({
    page,
  }) => {
    await startMockGame(page, "/mock?game=media");

    // Second column ("Music & Film") $200 is an audio-only question.
    await openClue(page, page.getByRole("button", { name: "$ 200" }).nth(1));

    const media = page.getByTestId("clue-media");
    await expect(media).toHaveAttribute("data-media-type", "audio");
    await expect(page.locator("audio")).toHaveAttribute("src", AUDIO_SRC);
    await expect(
      page.getByRole("button", { name: /(play|pause) audio/i }),
    ).toBeVisible();

    // Tapping the play control must not buzz in.
    await page.getByRole("button", { name: /(play|pause) audio/i }).click();
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeHidden();

    // Buzz in once the (longer, media) read time is over, reveal and finish.
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("button", { name: /reveal answer/i }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: /reveal answer/i }).click();
    await page.getByRole("button", { name: /correct!/i }).click();
    await page.getByRole("button", { name: /back to board/i }).click();

    // The prompt (and its audio) is gone.
    await expect(page.locator("audio")).toHaveCount(0);
  });

  test("answer media replaces the clue media when the answer is revealed", async ({
    page,
  }) => {
    await startMockGame(page, "/mock?game=media");

    // First column ("Pictures") $400 has a picture with the answer only.
    await openClue(page, page.getByRole("button", { name: "$ 400" }).first());
    await expect(page.getByTestId("clue-media")).toHaveCount(0);

    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("button", { name: /reveal answer/i }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: /reveal answer/i }).click();

    const media = page.getByTestId("clue-media");
    await expect(media).toHaveAttribute("data-media-type", "image");
    await expect(media).toHaveAttribute(
      "data-src",
      /^https:\/\/upload\.wikimedia\.org\/.*Mona_Lisa/,
    );
  });

  test("a YouTube question renders a privacy-enhanced embed", async ({
    page,
  }) => {
    await startMockGame(page, "/mock?game=media");
    await openClue(page, page.getByRole("button", { name: "$ 600" }).nth(1));

    const iframe = page.locator("iframe");
    await expect(iframe).toHaveAttribute(
      "src",
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/aqz-KE-bpKQ\?.*start=60/,
    );
  });
});
