import { test, expect } from "./fixtures";
import { uploadGame } from "./helpers";

test.describe("joining rooms", () => {
  // Both tests share one uploaded game and the room created in the first.
  test.describe.configure({ mode: "serial" });

  let gameId: string;
  let roomPath: string;

  test("joining before the realtime channel connects still joins", async ({
    authedPage: page,
  }) => {
    await page.goto("/profile");
    gameId = await uploadGame(page);

    // Never let the realtime websocket connect, so the channel can't reach
    // SUBSCRIBED: the join must converge without realtime delivery.
    await page.context().routeWebSocket(/\/realtime\//, () => {});

    await page.goto(`/game/${gameId}/play`);
    await expect(page).toHaveURL(/\/room\/\d+-\w+$/);
    roomPath = new URL(page.url()).pathname;

    // Tap "Join game" right away, without waiting for "Connected".
    const joinButton = page.getByRole("button", { name: /join game/i });
    await joinButton.click();

    await expect(joinButton).toBeHidden({ timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /start round/i }),
    ).toBeVisible();
    await expect(page.getByText(/^Connected/)).toBeHidden();
  });

  test("rooms in progress are listed and joinable without a link", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // The game page lists the room in progress.
    await page.goto(`/game/${gameId}`);
    await expect(
      page.getByRole("heading", { name: "Rooms in progress" }),
    ).toBeVisible();
    const roomName = roomPath.split("/").at(-1)!;
    const roomLink = page.getByRole("link", { name: new RegExp(roomName) });
    await expect(roomLink).toHaveAttribute("href", roomPath);
    await expect(roomLink).toContainText("1 player");

    // "Play with friends" offers the room in progress instead of silently
    // creating a new one.
    await page.goto(`/game/${gameId}/play`);
    await expect(page).toHaveURL(`/game/${gameId}/play`);
    await page.getByRole("link", { name: new RegExp(roomName) }).click();
    await expect(page).toHaveURL(roomPath);

    await page.getByRole("button", { name: /join game/i }).click();
    await expect(page.getByRole("button", { name: /join game/i })).toBeHidden({
      timeout: 10_000,
    });

    // Starting a new room is still one click away.
    await page.goto(`/game/${gameId}/play`);
    await page.getByRole("link", { name: /start a new room/i }).click();
    await expect(page).toHaveURL(/\/room\/\d+-\w+$/);
    expect(new URL(page.url()).pathname).not.toBe(roomPath);

    await context.close();
  });
});
