import { test, expect } from "./fixtures";
import { goto, reload } from "./helpers";

/** Wait for a debounced settings POST to complete. */
function waitForSettingsSave(page: import("@playwright/test").Page) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes("/settings") && resp.request().method() === "POST",
  );
}

test.describe("settings persistence", () => {
  test("wager hints setting persists across reload", async ({
    authedPage: page,
  }) => {
    await goto(page, "/profile");

    const alwaysTab = page.getByRole("tab", { name: "Always" });
    const onTapTab = page.getByRole("tab", { name: "On tap" });
    await expect(alwaysTab).toBeVisible();

    // Determine the current active tab so we can toggle to the other one.
    // This makes the test idempotent across repeated runs.
    const alwaysActive =
      (await alwaysTab.getAttribute("data-state")) === "active";
    const targetTab = alwaysActive ? onTapTab : alwaysTab;

    // Click the target tab and wait for the debounced save (500ms)
    const saveResponse = waitForSettingsSave(page);
    await targetTab.click();
    await saveResponse;

    // Reload and verify it persisted
    await reload(page);
    await expect(targetTab).toHaveAttribute("data-state", "active");
  });

  test("sound mute persists across reload without losing volume", async ({
    authedPage: page,
  }) => {
    await goto(page, "/profile");

    const muteButton = page.getByRole("button", { name: "Mute" });
    // Radix Slider puts role="slider" on the Thumb element, not the Root.
    const volumeThumb = page.getByRole("slider");
    await expect(muteButton).toBeVisible();
    await expect(volumeThumb).toBeVisible();

    // --- Setup: ensure unmuted with a non-zero volume ---
    // Previous buggy runs may have left volume at 0, which would mask the bug
    // where muting destructively zeroes the persisted volume.
    const isMuted = (await muteButton.getAttribute("data-state")) === "on";
    const currentVol = Number(await volumeThumb.getAttribute("aria-valuenow"));

    if (isMuted || currentVol === 0) {
      const setupSave = waitForSettingsSave(page);

      if (isMuted) {
        await muteButton.click();
      }

      if (currentVol === 0) {
        // Click the middle of the slider track to set ~50% volume
        const sliderRoot = page.locator('[aria-label="Volume"]');
        const box = await sliderRoot.boundingBox();
        if (!box) throw new Error("Volume slider not found");
        await sliderRoot.click({
          position: { x: box.width / 2, y: box.height / 2 },
        });
      }

      await setupSave;
      await reload(page);
    }

    // Read the volume slider value — should be non-zero.
    const volumeBefore = await volumeThumb.getAttribute("aria-valuenow");
    expect(Number(volumeBefore)).toBeGreaterThan(0);

    // Mute and wait for save
    const muteSave = waitForSettingsSave(page);
    await muteButton.click();
    await muteSave;

    // Reload — mute should persist AND volume should be preserved
    await reload(page);
    await expect(muteButton).toHaveAttribute("data-state", "on");

    const volumeAfterReload = await volumeThumb.getAttribute("aria-valuenow");
    expect(volumeAfterReload).toBe(volumeBefore);

    // Unmute after reload — volume should still be the original value
    const unmuteSave = waitForSettingsSave(page);
    await muteButton.click();
    await unmuteSave;

    await expect(muteButton).toHaveAttribute("data-state", "off");
    const volumeAfterUnmute = await volumeThumb.getAttribute("aria-valuenow");
    expect(volumeAfterUnmute).toBe(volumeBefore);
  });

  test("theme is saved to the account and follows the user to a new device", async ({
    authedPage: page,
  }) => {
    await goto(page, "/settings");
    const group = page.getByRole("group", { name: "Theme" });
    await expect(group).toBeVisible();

    const save = waitForSettingsSave(page);
    await group.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await save;

    // A new device: no theme cookie, so the theme comes from the account.
    await page.context().clearCookies({ name: "theme" });
    await reload(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(group.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Put the shared test user back on Classic.
    const reset = waitForSettingsSave(page);
    await group.getByRole("button", { name: "Classic" }).click();
    await reset;
    await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
  });
});
