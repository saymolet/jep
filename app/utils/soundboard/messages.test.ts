import { describe, expect, it } from "vitest";

import {
  MAX_SENDER_NAME_LENGTH,
  parseSoundboardMessage,
  SOUND_IDS,
  SOUNDS,
} from "./messages";

describe("SOUNDS", () => {
  it("has a unique id, an emoji and a label key for every sound", () => {
    expect(SOUND_IDS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SOUND_IDS).size).toBe(SOUND_IDS.length);
    for (const sound of SOUNDS) {
      expect(sound.emoji.length).toBeGreaterThan(0);
      expect(sound.labelKey).toBe(`soundboard.sound.${sound.id}`);
    }
  });
});

describe("parseSoundboardMessage", () => {
  const valid = { sound: "applause", userId: "u1", name: "Ann" };

  it("accepts a well-formed message", () => {
    expect(parseSoundboardMessage(valid)).toEqual(valid);
  });

  it("trims and shortens the name", () => {
    expect(
      parseSoundboardMessage({ ...valid, name: `  ${"x".repeat(200)}  ` })
        ?.name,
    ).toBe("x".repeat(MAX_SENDER_NAME_LENGTH));
  });

  it("drops extra fields", () => {
    expect(parseSoundboardMessage({ ...valid, volume: 100 })).toEqual(valid);
  });

  const invalid: [string, unknown][] = [
    ["null", null],
    ["a string", "applause"],
    ["an array", [valid]],
    ["an unknown sound id", { ...valid, sound: "explosion" }],
    ["a prototype key as sound id", { ...valid, sound: "toString" }],
    ["a non-string sound", { ...valid, sound: 1 }],
    ["a missing userId", { sound: "ding", name: "Ann" }],
    ["an empty userId", { ...valid, userId: "" }],
    ["a huge userId", { ...valid, userId: "u".repeat(500) }],
    ["a non-string name", { ...valid, name: 42 }],
  ];
  it.each(invalid)("rejects %s", (_name, payload) => {
    expect(parseSoundboardMessage(payload)).toBeNull();
  });

  it("allows an empty name (shown from the room's player list)", () => {
    expect(parseSoundboardMessage({ ...valid, name: " " })?.name).toBe("");
  });
});
