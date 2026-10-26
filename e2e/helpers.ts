import path from "path";

import { expect } from "@playwright/test";
import type { Locator, Page, Response } from "@playwright/test";

/** Wait until React has hydrated the page (root.tsx sets `data-hydrated` on
 * <html>). Before that, server-rendered buttons have no event handlers and
 * clicks on them are silently lost. */
export async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

/** waitForHydrationAfter waits for hydration after a full page load, unless
 * the response isn't a page that hydrates (an error status or a non-HTML
 * resource). */
async function waitForHydrationAfter(page: Page, response: Response | null) {
  if (!response || !response.ok()) return;
  const contentType = response.headers()["content-type"] ?? "";
  if (!contentType.includes("text/html")) return;
  await waitForHydration(page);
}

/** page.goto that also waits for React to hydrate the page. Use it instead of
 * page.goto whenever the test interacts with the page afterwards. */
export async function goto(
  page: Page,
  url: string,
  options?: Parameters<Page["goto"]>[1],
) {
  const response = await page.goto(url, options);
  await waitForHydrationAfter(page, response);
  return response;
}

/** page.reload that also waits for React to hydrate the page. */
export async function reload(
  page: Page,
  options?: Parameters<Page["reload"]>[0],
) {
  const response = await page.reload(options);
  await waitForHydrationAfter(page, response);
  return response;
}

/** The board is shown and done filling in. The board table sets `aria-busy`
 * while it is hidden behind the round preview or animating (cells ignore
 * clicks then). A single long-form board renders no table, so this simply
 * passes there. */
export async function waitForBoardReady(page: Page) {
  await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0, {
    timeout: 15_000,
  });
}

/** Click "Start round" in the round preview dialog (on `page`, which must
 * have board control) and wait until the dialog is gone and the board is
 * ready. Pass `name` for another language ("Почати раунд"). Works for any
 * round's preview, and for a long-form round with no board table. */
export async function clickStartRound(
  page: Page,
  name: string | RegExp = /start round/i,
) {
  const startRound = page.getByRole("button", { name });
  // The button appears once the Join event gives this player board control,
  // and the dialog can re-render (replacing the button) right as it's
  // clicked, losing the click under load. Click again until the dialog
  // closes, like a person would; a repeated StartRound is ignored by the
  // engine. Starting is a server round trip (solo routes return the action),
  // so allow time for it. Wait for the button first — otherwise "hidden"
  // would pass before the Join has even produced it.
  await expect(startRound).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    if (await startRound.isVisible()) {
      await startRound.click({ timeout: 2_000 });
    }
    await expect(startRound).toBeHidden({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  // The dialog only unmounts after its close animation, and on unmount Radix
  // restores focus to the element focused before it opened. Wait for that so
  // it can't steal focus from whatever the test focuses next.
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
  await waitForBoardReady(page);
}

/** Navigate to a mock game route, join, start round 1, and wait for the board
 *  fill animation to complete. */
export async function startMockGame(
  page: Page,
  route = "/mock",
  {
    join = /join game/i,
    start = /start round/i,
  }: { join?: string | RegExp; start?: string | RegExp } = {},
) {
  await goto(page, route);
  await page.getByRole("button", { name: join }).click();
  await clickStartRound(page, start);
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
  await waitForBoardReady(page);
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

/** Click a clue on the board, retrying until its prompt opens (the "buzz in"
 * hint on desktops, the big BUZZ button on phones). */
export async function openClue(page: Page, clueButton: Locator) {
  await waitForBoardReady(page);
  const opened = page
    .getByText(/buzz in/i)
    .or(page.getByTestId("buzz-bar"))
    .filter({ visible: true })
    .first();
  // The board fill animation silently ignores clicks.
  await expect(async () => {
    await clueButton.click();
    await expect(opened).toBeVisible({ timeout: 1_000 });
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

/** React reports a hydration mismatch as "Hydration failed..." in development
 * and as minified errors #418 / #423 / #425 in production builds. */
const HYDRATION_ERROR = /hydrat|Minified React error #4(1[89]|2[0-5])\b/i;

/** Collect hydration errors reported on the page from now on. Call it before
 * navigating; assert the returned list stays empty. */
export function trackHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (HYDRATION_ERROR.test(error.message)) errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && HYDRATION_ERROR.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

/** logInAsAdmin opens an admin session (the e2e setup sets ADMIN_PASSWORD,
 * see scripts/with-local-supabase.sh) in the page's browser context. */
export async function logInAsAdmin(page: Page) {
  await goto(page, "/admin/login");
  await page
    .getByLabel("Admin password")
    .fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
