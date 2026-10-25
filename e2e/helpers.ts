import path from "path";

import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/** Navigate to a mock game route, join, start round 1, and wait for the board
 *  fill animation to complete. */
export async function startMockGame(page: Page, route = "/mock") {
  await page.goto(route);
  await page.getByRole("button", { name: /join game/i }).click();
  await page.getByRole("button", { name: /start round/i }).click();
}

/** Play through a clue using only keyboard inputs.
 *  Assumes a clue cell is already focused. Presses Enter to select it, buzzes
 *  in, reveals the answer, marks correct, and returns to the board. */
export async function playOneClueKeyboard(page: Page) {
  // Press Enter on the focused clue cell to select it.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });

  // Press Enter to buzz in, retrying until the read timer finishes.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  // "Reveal answer" is focused automatically after the 500ms debounce via
  // a useEffect in check-form.tsx.
  const revealButton = page.getByRole("button", { name: /reveal answer/i });
  await expect(revealButton).toBeFocused({ timeout: 5_000 });
  await page.keyboard.press("Enter");

  // "correct!" has unconditional autoFocus.
  const correctButton = page.getByRole("button", { name: /correct!/i });
  await expect(correctButton).toBeFocused({ timeout: 2_000 });
  await page.keyboard.press("Enter");

  // "Back to board" has unconditional autoFocus.
  const backButton = page.getByRole("button", { name: /back to board/i });
  await expect(backButton).toBeVisible({ timeout: 5_000 });
  await expect(backButton).toBeFocused({ timeout: 2_000 });
  await page.keyboard.press("Enter");
}

const MOCK_1x1_PATH = path.resolve("app/static/mock-1x1.jep.json");

/** Upload a .jep.json file on a page that has an Upload widget (/profile or /).
 *  For authenticated pages the form submits immediately (no confirmation dialog).
 *  Returns the game ID extracted from the "My Games" list link. */
export async function uploadGame(
  page: Page,
  filePath = MOCK_1x1_PATH,
): Promise<string> {
  // Use the filechooser pattern to go through the upload button. This ensures
  // React has hydrated before the file change event fires (the hidden input's
  // onChange handler is only attached after hydration).
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("#upload-button").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);

  // Wait for the upload action to complete and the page to update.
  await expect(page.getByText(/created new/i)).toBeVisible({ timeout: 10_000 });

  // Extract the game ID from the first game link in the "My Games" list.
  // Links have the form /game/{id}/play.
  const gameLink = page.locator('a[href*="/game/"][href*="/play"]').first();
  const href = await gameLink.getAttribute("href");
  const match = href?.match(/\/game\/([^/]+)\/play/);
  if (!match) throw new Error(`Could not extract game ID from href: ${href}`);
  return match[1];
}

/** Play through a single $200 clue and return to the board. */
/** Wait for the realtime connection indicator before interacting with a
 * real (non-mock) room. Events posted before the websocket subscription is
 * established are only recovered by the missed-event catch-up, so tests
 * should wait like a player watching the "Connecting..." banner would. */
export async function waitForConnected(page: Page) {
  await expect(page.getByText(/^Connected/)).toBeVisible({ timeout: 15_000 });
}

export async function playOneClue(page: Page) {
  const clueButton = page.getByRole("button", { name: "$ 200" }).first();

  // The board fill animation silently ignores clicks, so retry clicking
  // until the clue prompt actually opens.
  await expect(async () => {
    await clueButton.click();
    await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });

  // Press Enter to buzz in, retrying until the read timer finishes.
  await expect(async () => {
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /reveal answer/i }),
    ).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  const revealButton = page.getByRole("button", { name: /reveal answer/i });
  await expect(revealButton).toBeEnabled({ timeout: 5_000 });
  await revealButton.click();

  await page.getByRole("button", { name: /correct!/i }).click();

  await expect(
    page.getByRole("button", { name: /back to board/i }),
  ).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /back to board/i }).click();
}

/** silentWav builds a short silent WAV file (8 kHz, 8-bit mono). */
function silentWav(seconds = 1): Buffer {
  const samples = 8000 * seconds;
  const buf = Buffer.alloc(44 + samples, 0x80);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(8000, 24); // sample rate
  buf.writeUInt32LE(8000, 28); // byte rate
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(samples, 40);
  return buf;
}

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Serve stand-ins for clue media hosted on the internet (Wikimedia, YouTube),
 * so e2e tests never depend on the network: they assert on the rendered
 * elements, not on the real files. */
export async function stubExternalMedia(page: Page) {
  await page.route(/^https:\/\/upload\.wikimedia\.org\//, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (/\.(png|jpe?g|gif|webp)$/i.test(path)) {
      return route.fulfill({ contentType: "image/png", body: ONE_PIXEL_PNG });
    }
    if (/\.(mp3|ogg|wav)$/i.test(path)) {
      return route.fulfill({ contentType: "audio/wav", body: silentWav() });
    }
    return route.abort();
  });
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\//, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>YouTube stub</title>",
    }),
  );
}

/** Click a clue on the board, retrying until its prompt opens. */
export async function openClue(page: Page, clueButton: Locator) {
  // The board fill animation silently ignores clicks.
  await expect(async () => {
    await clueButton.click();
    await expect(page.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

/** Pick a preset emoji avatar, retrying until React has hydrated and the
 * button reflects the choice. */
export async function pickEmoji(page: Page, emoji: string) {
  const button = page.getByRole("button", { name: `Avatar ${emoji}` });
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 10_000 });
}
