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

describe("parseUserSettings language", () => {
  it("keeps a supported language", () => {
    expect(parseUserSettings({ language: "uk" })).toEqual({ language: "uk" });
  });

  it("drops an unknown language without losing the other settings", () => {
    expect(parseUserSettings({ language: "fr", wagerHints: "never" })).toEqual({
      language: undefined,
      wagerHints: "never",
    });
  });

  it("still parses settings saved before the language setting existed", () => {
    expect(parseUserSettings({ wagerHints: "show" })).toEqual({
      wagerHints: "show",
    });
  });
});

describe("parseUserSettings theme", () => {
  it("keeps a supported theme", () => {
    expect(parseUserSettings({ theme: "dark" })).toEqual({ theme: "dark" });
    expect(parseUserSettings({ theme: "system" })).toEqual({
      theme: "system",
    });
  });

  it("drops an unknown theme without losing the other settings", () => {
    expect(parseUserSettings({ theme: "neon", language: "uk" })).toEqual({
      theme: undefined,
      language: "uk",
    });
  });

  it("still parses settings saved before the theme setting existed", () => {
    expect(parseUserSettings({ language: "en" })).toEqual({ language: "en" });
  });
});
