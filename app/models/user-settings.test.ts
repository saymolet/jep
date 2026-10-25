import { describe, expect, it } from "vitest";

import { parseUserSettings } from "./user-settings";

describe("parseUserSettings gameDefaults.playerAvatar", () => {
  it("keeps a valid avatar", () => {
    expect(
      parseUserSettings({ gameDefaults: { playerAvatar: "emoji:🦊" } }),
    ).toEqual({ gameDefaults: { playerAvatar: "emoji:🦊" } });
  });

  it("drops an invalid avatar without losing the other settings", () => {
    expect(
      parseUserSettings({
        wagerHints: "never",
        gameDefaults: { playerName: "Ann", playerAvatar: "emoji:nope" },
      }),
    ).toEqual({
      wagerHints: "never",
      gameDefaults: { playerName: "Ann", playerAvatar: undefined },
    });
  });

  it("still parses settings without an avatar", () => {
    expect(
      parseUserSettings({ gameDefaults: { playerColor: "#7a8ae0" } }),
    ).toEqual({ gameDefaults: { playerColor: "#7a8ae0" } });
  });
});
