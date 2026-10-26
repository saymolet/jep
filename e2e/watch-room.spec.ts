import { qrSvg } from "../app/utils/qr";
import { expect, test } from "./fixtures";
import {
  clickStartRound,
  goto,
  trackHydrationErrors,
  uploadGame,
  waitForConnected,
} from "./helpers";

test.describe("spectators and the TV screen", () => {
  test("a spectator watches without joining and can't buzz", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    await waitForConnected(host);
    await host.getByRole("button", { name: /join game/i }).click();
    await expect(host.getByRole("button", { name: /join game/i })).toBeHidden({
      timeout: 10_000,
    });

    // A visitor opens the room and chooses to watch.
    const context = await browser.newContext();
    const spectator = await context.newPage();
    const joinRequests: string[] = [];
    spectator.on("request", (request) => {
      if (request.method() === "POST") joinRequests.push(request.url());
    });
    await goto(spectator, roomUrl);
    await waitForConnected(spectator);
    await spectator.getByRole("button", { name: "Just watch" }).click();
    await expect(spectator.getByRole("dialog")).toHaveCount(0);
    const bar = spectator.getByTestId("spectator-bar");
    await expect(bar).toContainText("Watching");
    await expect(bar.getByRole("button", { name: "Join game" })).toBeVisible();

    // Presence: the players see that someone is watching.
    await expect(host.getByTestId("watcher-count")).toHaveText(/1 watching/, {
      timeout: 15_000,
    });

    // The player opens the question: the spectator sees it, read-only.
    await clickStartRound(host);
    const clueButton = host.getByRole("button", { name: "$ 200" }).first();
    await expect(async () => {
      await clueButton.click();
      await expect(host.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });

    await expect(spectator.getByText("only clue")).toBeVisible({
      timeout: 10_000,
    });
    await expect(spectator.getByTestId("viewer-status")).toHaveText(
      /Get ready to buzz|Buzzers open!/,
    );
    // No buzzer: no buzz hint, the question isn't a button that works, and
    // Enter sends nothing.
    await expect(spectator.getByText(/buzz in/i)).toHaveCount(0);
    for (const button of await spectator.getByRole("button").all()) {
      if (await button.isEnabled()) {
        await expect(button).not.toHaveText(/buzz|reveal|correct/i);
      }
    }
    await spectator.keyboard.press("Enter");
    await spectator.waitForTimeout(500);

    // The player answers; the spectator follows along.
    await expect(async () => {
      await host.keyboard.press("Enter");
      await expect(
        host.getByRole("button", { name: /reveal answer/i }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(spectator.getByTestId("viewer-status")).toHaveText(
      /is answering/,
    );

    // The spectator never sent a room action (no Join, no buzz).
    expect(joinRequests.filter((url) => /\/room\/\d+\//.test(url))).toEqual([]);
    await context.close();
  });

  test("the TV screen shows a QR code to join and follows the game", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(90_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomPath = new URL(host.url()).pathname;
    await waitForConnected(host);

    const context = await browser.newContext();
    const tv = await context.newPage();
    const hydrationErrors = trackHydrationErrors(tv);
    await goto(tv, `${roomPath}/present`);
    await waitForConnected(tv);

    // The QR code encodes the room's join URL.
    const qr = tv.getByRole("img", { name: "QR code to join the game" });
    await expect(qr).toBeVisible();
    const joinUrl = await qr.getAttribute("data-value");
    expect(joinUrl).toMatch(new RegExp(`^https?://[^/]+${roomPath}$`));
    expect(await qr.locator("path").getAttribute("d")).toBe(
      qrSvg(joinUrl!).path,
    );
    await expect(tv.getByText("Scan to join")).toBeVisible();
    await expect(tv.getByTestId("viewer-status")).toHaveText(
      "Waiting for players to join...",
    );
    // No site header, no join dialog, no controls.
    await expect(tv.getByRole("dialog")).toHaveCount(0);
    await expect(tv.getByRole("navigation")).toHaveCount(0);

    // The player joins and plays; the TV follows live.
    await host.getByRole("button", { name: /join game/i }).click();
    await expect(tv.getByTestId("presenter-players")).toBeVisible({
      timeout: 10_000,
    });
    await expect(tv.getByTestId("viewer-status")).toHaveText(
      /Round 1 is about to start/,
    );
    await clickStartRound(host);
    await expect(tv.getByTestId("viewer-status")).toHaveText(
      /is choosing a question/,
      { timeout: 10_000 },
    );
    // During play the QR code stays, small.
    await expect(qr).toBeVisible();

    // "Show on TV" in the game menu links to the presenter view (the menu is
    // reachable once the round has started).
    await host.getByRole("button", { name: "Customise options" }).click();
    await expect(
      host.getByRole("menuitem", { name: "Show on TV" }),
    ).toHaveAttribute("href", `${roomPath}/present`);
    await host.keyboard.press("Escape");

    const clueButton = host.getByRole("button", { name: "$ 200" }).first();
    await expect(async () => {
      await clueButton.click();
      await expect(host.getByText(/buzz in/i)).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(tv.getByTestId("presenter-prompt")).toContainText(
      "only clue",
      { timeout: 10_000 },
    );

    await expect(async () => {
      await host.keyboard.press("Enter");
      await expect(
        host.getByRole("button", { name: /reveal answer/i }),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(tv.getByTestId("viewer-status")).toHaveText(/is answering/);
    await host.getByRole("button", { name: /reveal answer/i }).click();
    await host.getByRole("button", { name: /correct!/i }).click();
    await expect(tv.getByTestId("viewer-status")).toHaveText(/got it!/);
    await expect(tv.getByTestId("presenter-prompt")).toContainText(
      "only answer",
    );

    // The last question ends the game: the TV shows the winner.
    await host.getByRole("button", { name: /back to board/i }).click();
    await expect(tv.getByTestId("presenter-winner")).toHaveText(/wins!/, {
      timeout: 10_000,
    });
    await expect(tv).toHaveURL(new RegExp(`${roomPath}/present$`));
    expect(hydrationErrors).toEqual([]);
    await context.close();
  });

  test("spectator and TV screens in Ukrainian", async ({
    authedPage: host,
    browser,
  }) => {
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomPath = new URL(host.url()).pathname;

    const context = await browser.newContext();
    await context.addCookies([
      { name: "lang", value: "uk", url: "http://localhost" },
    ]);
    const page = await context.newPage();

    await goto(page, `${roomPath}/present`);
    await expect(page.getByText("Скануй, щоб приєднатися")).toBeVisible();
    await expect(
      page.getByRole("img", { name: "QR-код для приєднання до гри" }),
    ).toBeVisible();
    await expect(page.getByTestId("viewer-status")).toHaveText(
      "Чекаємо на гравців...",
    );

    await goto(page, roomPath);
    await page.getByRole("button", { name: "Просто дивитися" }).click();
    await expect(page.getByTestId("spectator-bar")).toContainText("Глядач");
    await expect(
      page.getByTestId("spectator-bar").getByRole("button", {
        name: "Приєднатися",
      }),
    ).toBeVisible();
    await context.close();
  });
});
