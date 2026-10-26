import { randomUUID } from "crypto";

import { expect, type Page, test } from "@playwright/test";

import { buildSiq, fixtureContentXml } from "../app/test-fixtures/siq/build";
import { goto } from "./helpers";

/** Set for the test server by scripts/with-local-supabase.sh. */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

const STORAGE_PATH = "/storage/v1/object/public/game-media/";

/** Each test comes from its own (fake) address, as nginx would report it, so
 * the login lockout of one test never affects another. */
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({
    "X-Real-IP": `10.${octet()}.${octet()}.${octet()}`,
  });
});

async function logIn(page: Page) {
  await goto(page, "/admin/login");
  await page.getByLabel("Admin password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** importPack uploads a small SIGame pack as a guest and returns its id and
 * the storage URL of its first picture. */
async function importPack(page: Page, title: string) {
  const siq = buildSiq("v5", {
    "content.xml": fixtureContentXml("v5").replace(
      'name="Test pack v5"',
      `name="${title}"`,
    ),
  });
  await goto(page, "/");
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("#upload-button").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "admin-pack.siq",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(siq),
  });
  await page.getByRole("button", { name: /upload publicly/i }).click();
  await expect(page.getByText(/created new public game/i)).toBeVisible({
    timeout: 30_000,
  });

  await goto(page, `/?q=${encodeURIComponent(title)}`);
  const href = await page
    .locator('a[href^="/game/"][href$="/play"]', { hasText: title })
    .getAttribute("href");
  const gameId = href?.match(/\/game\/([^/]+)\/play/)?.[1];
  expect(gameId).toBeTruthy();

  const exported = await (
    await page.request.get(`/game/${gameId}/json`)
  ).json();
  const src: string = exported.boards[0].categories[0].clues[0].media[0].src;
  expect(src).toContain(STORAGE_PATH);
  return { gameId: gameId!, mediaUrl: src };
}

test.describe("admin panel", () => {
  test.skip(!ADMIN_PASSWORD, "ADMIN_PASSWORD is not set for the test server");

  test("asks for the password and is never indexed", async ({ page }) => {
    const response = await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin$/);
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    // No admin navigation before logging in.
    await expect(page.getByRole("link", { name: "Games" })).toHaveCount(0);

    // Other admin pages too.
    await page.goto("/admin/games");
    await expect(page).toHaveURL(
      /\/admin\/login\?redirectTo=%2Fadmin%2Fgames$/,
    );
  });

  test("speaks Ukrainian", async ({ page, baseURL }) => {
    await page
      .context()
      .addCookies([{ name: "lang", value: "uk", url: baseURL }]);
    await goto(page, "/admin/login");
    await expect(
      page.getByRole("heading", { name: "Вхід для адміністратора" }),
    ).toBeVisible();
    await page.getByLabel("Пароль адміністратора").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Увійти" }).click();
    await expect(page.getByRole("link", { name: "Огляд" })).toBeVisible();
    await expect(
      page.getByRole("meter", { name: "Сховище медіа" }),
    ).toBeVisible();
  });

  test("rejects a wrong password", async ({ page }) => {
    await goto(page, "/admin/login");
    await page.getByLabel("Admin password").fill("not the password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toContainText("Could not log in");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("logs in, shows the dashboard and logs out", async ({ page }) => {
    await logIn(page);
    await expect(page.getByTestId("stat-games")).toHaveText(/^\d+$/);
    await expect(
      page.getByRole("meter", { name: "Media storage" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("changes a game's visibility, then deletes it with its media", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const title = `E2E Admin ${randomUUID().slice(0, 8)}`;
    const { gameId, mediaUrl } = await importPack(page, title);
    expect((await page.request.get(mediaUrl)).status()).toBe(200);

    await logIn(page);
    await goto(page, `/admin/games?q=${encodeURIComponent(title)}`);
    const row = page.getByTestId("admin-game").filter({ hasText: title });
    await expect(row).toHaveCount(1);
    await row.getByLabel("Visibility").selectOption("PRIVATE");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(`“${title}” is now Private.`)).toBeVisible();
    await expect(row.getByLabel("Visibility")).toHaveValue("PRIVATE");
    // Private now: the public game page is gone for a guest.
    const guest = await page.context().browser()!.newContext();
    const guestPage = await guest.newPage();
    const preview = await guestPage.goto(`/game/${gameId}`);
    expect(preview?.status()).toBe(404);
    await guest.close();

    await row.getByRole("link", { name: "Manage" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/games/${gameId}$`));
    await expect(page.getByTestId("media-remove")).toContainText(
      "5 files will be deleted",
    );
    await page.getByRole("link", { name: "Delete game…" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Delete this game?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete for good" }).click();
    await expect(page).toHaveURL(/\/admin\/games$/);
    await expect(
      page.getByText(`Deleted “${title}”. Media files deleted: 5;`),
    ).toBeVisible();

    expect((await page.request.get(`/game/${gameId}/json`)).status()).toBe(404);
    await expect
      .poll(async () => (await page.request.get(mediaUrl)).status())
      .not.toBe(200);
  });
});
