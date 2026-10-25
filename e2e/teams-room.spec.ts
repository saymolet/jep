import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { goto, playOneClue, uploadGame, waitForConnected } from "./helpers";

/** Pick a team in the join dialog and join. */
async function joinTeam(page: Page, team: RegExp) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: team }).click();
  await expect(dialog.getByRole("radio", { name: team })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("button", { name: /join game/i }).click();
  await expect(page.getByRole("button", { name: /join game/i })).toBeHidden({
    timeout: 10_000,
  });
}

test.describe("team mode in a room", () => {
  test("two players on different teams: totals on both clients, the TV and the summary", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host);
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    const roomPath = new URL(roomUrl).pathname;
    await waitForConnected(host);
    await joinTeam(host, /^Red team/);

    // A second, anonymous player joins the blue team.
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await goto(guest, roomUrl);
    await waitForConnected(guest);
    // The join dialog shows who is on which team already.
    await expect(
      guest.getByRole("dialog").getByRole("radio", { name: /^Red team/ }),
    ).toContainText("1 player");
    await joinTeam(guest, /^Blue team/);

    // The TV screen.
    const tvContext = await browser.newContext();
    const tv = await tvContext.newPage();
    await goto(tv, `${roomPath}/present`);
    await waitForConnected(tv);
    const tvTeams = tv.getByTestId("presenter-teams");
    await expect(tvTeams).toContainText("Red team");
    await expect(tvTeams).toContainText("Blue team", { timeout: 10_000 });

    // The host renames their team from their own tile (in the round
    // preview); everyone sees the new name.
    await host.getByTestId("team-button").click();
    const teamDialog = host.getByRole("dialog", { name: "Choose your team" });
    await teamDialog.getByLabel("Team name").fill("Foxes");
    await teamDialog.getByRole("button", { name: "Save" }).click();
    await expect(tvTeams).toContainText("Foxes", { timeout: 10_000 });
    await expect(guest.getByTestId("team-red")).toContainText("Foxes", {
      timeout: 10_000,
    });
    await host.keyboard.press("Escape");
    await expect(teamDialog).toBeHidden();

    // The host scores; the team totals update everywhere.
    await expect(async () => {
      const start = host.getByRole("button", { name: /start round/i });
      if (await start.isVisible()) await start.click({ timeout: 2_000 });
      await expect(start).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await playOneClue(host);

    // The only question was played, so the game is over: players go to the
    // summary, which names the winning team; the TV says it too.
    await expect(tv.getByTestId("presenter-winning-team")).toContainText(
      "Winning team: Foxes",
      { timeout: 15_000 },
    );
    await expect(tvTeams).toContainText("Foxes$200");
    await expect(tvTeams).toContainText("Blue team$0");

    for (const page of [host, guest]) {
      await expect(page).toHaveURL(/\/summary$/, { timeout: 15_000 });
      await expect(page.getByTestId("winning-team")).toContainText(
        "Winning team: Foxes",
      );
      const standings = page.getByTestId("team-standings");
      await expect(standings.getByRole("listitem").first()).toContainText(
        "$200",
      );
    }

    await guestContext.close();
    await tvContext.close();
  });

  test("team totals update on the other player's scoreboard between questions", async ({
    authedPage: host,
    browser,
  }) => {
    test.setTimeout(120_000);
    await goto(host, "/profile");
    const gameId = await uploadGame(host, "app/static/mock-3x3.jep.json");
    await goto(host, `/game/${gameId}/play`);
    await expect(host).toHaveURL(/\/room\/\d+-\w+$/);
    const roomUrl = host.url();
    await waitForConnected(host);
    await joinTeam(host, /^Green team/);

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await goto(guest, roomUrl);
    await waitForConnected(guest);
    await joinTeam(guest, /^Yellow team/);

    await expect(async () => {
      const start = host.getByRole("button", { name: /start round/i });
      if (await start.isVisible()) await start.click({ timeout: 2_000 });
      await expect(start).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
    await playOneClue(host);

    // Back on the board: teams are grouped, the leading team first.
    for (const page of [host, guest]) {
      const green = page.getByTestId("team-green");
      await expect(green).toContainText("$200", { timeout: 10_000 });
      await expect(page.getByTestId("team-yellow")).toContainText("$0");
      const order = await page
        .locator('section[data-testid^="team-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
      expect(order).toEqual(["team-green", "team-yellow"]);
    }

    // Between questions the guest switches teams; the totals follow.
    await guest.getByTestId("team-button").click();
    await guest
      .getByRole("dialog", { name: "Choose your team" })
      .getByRole("radio", { name: /^Green team/ })
      .click();
    await guest.keyboard.press("Escape");
    for (const page of [host, guest]) {
      await expect(page.getByTestId("team-yellow")).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(
        page.getByTestId("team-green").locator('[data-team="green"]'),
      ).toHaveCount(2, { timeout: 10_000 });
    }

    await guestContext.close();
  });
});
