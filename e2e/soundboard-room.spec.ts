import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { clickStartRound, goto, uploadGame, waitForConnected } from "./helpers";

async function join(page: Page) {
  await page.getByRole("button", { name: /join game/i }).click();
  await expect(page.getByRole("button", { name: /join game/i })).toBeHidden({
    timeout: 10_000,
  });
}

/** Open the soundboard and tap a sound. */
async function playSound(page: Page, label: string) {
  const panel = page.getByTestId("soundboard-panel");
  if (!(await panel.isVisible())) {
    await page.getByTestId("soundboard-button").click();
  }
  const button = panel.getByRole("button", { name: label });
  // Wait out the cooldown of an earlier sound.
  await expect(button).toHaveAttribute("aria-disabled", "false", {
    timeout: 5_000,
  });
  await button.click();
}

function toast(page: Page, sound: string) {
  return page.locator(
    `[data-testid="soundboard-toast"][data-sound="${sound}"]`,
  );
}

test.describe("soundboard in a room", () => {
  test("a player's sound reaches the other player and spectators, and respects mute", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    await waitForConnected(host);
    await join(host);

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await goto(guest, roomUrl);
    await waitForConnected(guest);
    await join(guest);

    // A spectator watches.
    const spectatorContext = await browser.newContext();
    const spectator = await spectatorContext.newPage();
    await goto(spectator, roomUrl);
    await waitForConnected(spectator);
    await spectator.getByRole("button", { name: "Just watch" }).click();
    await expect(spectator.getByRole("dialog")).toHaveCount(0);
    await expect(host.getByTestId("watcher-count")).toHaveText(/1 watching/, {
      timeout: 15_000,
    });

    // The round starts: the board is on screen for everyone.
    await clickStartRound(host);
    await expect(guest.getByRole("dialog")).toHaveCount(0, {
      timeout: 10_000,
    });

    // Spectators can listen but not send.
    await expect(spectator.getByTestId("soundboard-button")).toHaveCount(0);
    await expect(guest.getByTestId("soundboard-button")).toBeVisible();

    // The host plays applause: everyone sees "👏 <host>".
    await playSound(host, "Applause");
    const own = toast(host, "applause");
    await expect(own).toBeVisible();
    await expect(own).toContainText("👏");
    // The visible text is "<emoji> <name>"; the name is its second part.
    // Read it with a retrying assertion and textContent: innerText depends on
    // layout and could read empty while the toast scales in.
    const ownName = own.locator("span").nth(1);
    await expect(ownName).toHaveText(/\S/);
    const hostName = ((await ownName.textContent()) ?? "").trim();
    const guestToast = toast(guest, "applause");
    await expect(guestToast).toBeVisible({ timeout: 10_000 });
    await expect(guestToast.locator("span").nth(1)).toHaveText(hostName);
    // The guest tapped the page (Join), so the sound played there.
    await expect(guestToast).toHaveAttribute("data-played", "true");
    await expect(toast(spectator, "applause")).toBeVisible({ timeout: 10_000 });

    // The guest mutes the soundboard on their device: the toast still shows,
    // but nothing plays.
    await guest.getByTestId("soundboard-button").click();
    await guest
      .getByTestId("soundboard-panel")
      .getByLabel("Mute soundboard on this device")
      .check();
    await guest.keyboard.press("Escape");
    await playSound(host, "Ding!");
    await expect(toast(guest, "ding")).toBeVisible({ timeout: 10_000 });
    await expect(toast(guest, "ding")).toHaveAttribute("data-played", "false");
    // Remembered on this device.
    expect(
      await guest.evaluate(() => localStorage.getItem("jep-soundboard-mute")),
    ).toBe("1");

    // The guest can still send sounds to others.
    await playSound(guest, "Crickets");
    await expect(toast(host, "crickets")).toBeVisible({ timeout: 10_000 });
    await expect(toast(host, "crickets")).toHaveAttribute(
      "data-played",
      "true",
    );

    await spectatorContext.close();
    await guestContext.close();
  });
});

test.describe("soundboard button placement", () => {
  test("doesn't cover the footer links on a phone", async ({
    authedPage: host,
  }) => {
    test.setTimeout(60_000);
    await host.setViewportSize({ width: 390, height: 844 });
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    await waitForConnected(host);
    await join(host);
    await clickStartRound(host);

    const button = host.getByTestId("soundboard-button");
    await expect(button).toBeVisible();
    // Scroll to the end, where the fixed button used to sit on the footer.
    await host.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const footer = host.locator("footer");
    await expect(footer).toBeVisible();
    const b = await button.boundingBox();
    const f = await footer.boundingBox();
    expect(b && f).toBeTruthy();
    // The button sits entirely below the footer.
    expect(b!.y).toBeGreaterThanOrEqual(f!.y + f!.height - 1);
  });
});
