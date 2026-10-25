import path from "path";

import { expect, test } from "./fixtures";
import {
  goto,
  pickEmoji,
  reload,
  uploadGame,
  waitForConnected,
} from "./helpers";

const AVATAR_PNG = path.resolve("e2e/assets/avatar.png");

test.describe("avatars in a room", () => {
  test("a photo avatar is resized in the browser and seen by others", async ({
    authedPage: page,
    browser,
  }) => {
    await goto(page, "/profile");
    const gameId = await uploadGame(page);
    await goto(page, `/game/${gameId}/play`);
    await expect(page).toHaveURL(/\/room\/\d+-\w+$/);
    const roomPath = new URL(page.url()).pathname;
    await waitForConnected(page);

    // Upload a photo in the join dialog.
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Upload photo").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(AVATAR_PNG);
    const photo = 'img[src^="data:image/"]';
    const dialogPhoto = page.getByRole("dialog").locator(photo);
    await expect(dialogPhoto).toBeVisible();
    // 40×30 PNG in, 96×96 WebP out.
    expect(await dialogPhoto.getAttribute("src")).toMatch(
      /^data:image\/webp;base64,/,
    );
    expect(
      await dialogPhoto.evaluate((img: HTMLImageElement) => [
        img.naturalWidth,
        img.naturalHeight,
      ]),
    ).toEqual([96, 96]);

    await page.getByRole("button", { name: /join game/i }).click();
    await expect(
      page.getByRole("button", { name: /start round/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId("player-icon").locator(photo).first(),
    ).toBeVisible();

    // A second player sees the photo and joins with an emoji.
    const context = await browser.newContext();
    const guest = await context.newPage();
    await goto(guest, roomPath);
    await waitForConnected(guest);
    await expect(guest.getByRole("dialog").locator(photo)).toBeVisible();
    await pickEmoji(guest, "🐸");
    await guest.getByRole("button", { name: /join game/i }).click();
    await expect(guest.getByRole("button", { name: /join game/i })).toBeHidden({
      timeout: 10_000,
    });
    await expect(
      guest.getByTestId("player-icon").locator(photo).first(),
    ).toBeVisible();

    // ...and the first player sees the second player's emoji.
    await expect(
      page.getByTestId("player-icon").filter({ hasText: "🐸" }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  test("an account's default avatar is saved on the profile", async ({
    authedPage: page,
  }) => {
    const saved = () =>
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/settings") &&
          resp.request().method() === "POST",
      );

    await goto(page, "/profile");
    const openPicker = async () => {
      await expect(async () => {
        await page.getByRole("button", { name: "Change avatar" }).click();
        await expect(
          page.getByRole("heading", { name: "Default avatar" }),
        ).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 10_000 });
    };
    await openPicker();
    const unicorn = page.getByRole("button", { name: "Avatar 🦄" });
    const remove = page
      .getByRole("group", { name: "Emoji avatars" })
      .locator("..")
      .getByRole("button", { name: "Remove", exact: true });
    await expect(unicorn).toBeVisible();
    // Start from no default avatar, even if an earlier run failed midway.
    if ((await unicorn.getAttribute("aria-pressed")) === "true") {
      const cleared = saved();
      await remove.click();
      await cleared;
    }

    let save = saved();
    await pickEmoji(page, "🦄");
    await save;

    await reload(page);
    await openPicker();
    await expect(unicorn).toHaveAttribute("aria-pressed", "true");

    // Clean up so other specs start without a default avatar.
    save = saved();
    await remove.click();
    await save;
    await reload(page);
    await openPicker();
    await expect(unicorn).toHaveAttribute("aria-pressed", "false");
  });
});
