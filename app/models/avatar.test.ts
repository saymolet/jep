import { describe, expect, it } from "vitest";

import {
  AVATAR_EMOJI,
  AvatarInput,
  isValidAvatar,
  MAX_AVATAR_LENGTH,
  normalizeAvatar,
  parseAvatar,
} from "./avatar";

/** A 1×1 transparent PNG. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function dataUrlOfLength(mime: string, length: number) {
  // The base64 body must be a multiple of 4 characters long.
  const prefix = `data:${mime};base64,`;
  return prefix + "A".repeat(Math.floor((length - prefix.length) / 4) * 4);
}

describe("isValidAvatar", () => {
  it.each([
    ["emoji", "emoji:🦊"],
    ["compound emoji", "emoji:👨‍👩‍👧‍👦"],
    ["flag", "emoji:🇺🇦"],
    ["png data URL", TINY_PNG],
    ["webp data URL", "data:image/webp;base64,UklGRg=="],
    ["jpeg data URL", "data:image/jpeg;base64,/9j/4AAQ"],
    [
      "data URL at the size cap",
      dataUrlOfLength("image/webp", MAX_AVATAR_LENGTH),
    ],
  ])("accepts %s", (_, value) => {
    expect(isValidAvatar(value)).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["no prefix", "🦊"],
    ["empty emoji", "emoji:"],
    ["plain text", "emoji:hello"],
    ["too long emoji", "emoji:" + "🦊".repeat(17)],
    ["svg data URL", "data:image/svg+xml;base64,PHN2Zz4="],
    ["gif data URL", "data:image/gif;base64,R0lGODlh"],
    ["non-base64 data URL", "data:image/png,hello"],
    ["invalid base64 body", "data:image/png;base64,abc$def="],
    ["bad base64 padding", "data:image/png;base64,abcde"],
    ["empty base64 body", "data:image/png;base64,"],
    ["http URL", "https://example.com/a.png"],
    ["javascript URL", "javascript:alert(1)"],
    [
      "data URL over the size cap",
      dataUrlOfLength("image/webp", MAX_AVATAR_LENGTH + 4),
    ],
    ["a number", 42],
    ["null", null],
  ])("rejects %s", (_, value) => {
    expect(isValidAvatar(value)).toBe(false);
  });

  it("accepts every preset emoji", () => {
    expect(AVATAR_EMOJI.length).toBeGreaterThanOrEqual(24);
    for (const emoji of AVATAR_EMOJI) {
      expect(isValidAvatar(`emoji:${emoji}`)).toBe(true);
    }
  });
});

describe("normalizeAvatar", () => {
  it("keeps valid avatars and drops invalid ones", () => {
    expect(normalizeAvatar("emoji:🦊")).toBe("emoji:🦊");
    expect(normalizeAvatar(TINY_PNG)).toBe(TINY_PNG);
    expect(normalizeAvatar("data:image/svg+xml;base64,PHN2Zz4=")).toBe(
      undefined,
    );
    expect(normalizeAvatar(undefined)).toBe(undefined);
  });
});

describe("parseAvatar", () => {
  it("parses emoji and image avatars", () => {
    expect(parseAvatar("emoji:🦊")).toEqual({ kind: "emoji", emoji: "🦊" });
    expect(parseAvatar(TINY_PNG)).toEqual({ kind: "image", src: TINY_PNG });
    expect(parseAvatar(undefined)).toBe(undefined);
    expect(parseAvatar("nope")).toBe(undefined);
  });
});

describe("AvatarInput", () => {
  it("accepts a valid avatar or the empty string (remove)", () => {
    expect(AvatarInput.safeParse("emoji:🦊").success).toBe(true);
    expect(AvatarInput.safeParse(TINY_PNG).success).toBe(true);
    expect(AvatarInput.safeParse("").success).toBe(true);
  });

  it("rejects invalid avatars", () => {
    expect(AvatarInput.safeParse("emoji:hello").success).toBe(false);
    expect(
      AvatarInput.safeParse(
        dataUrlOfLength("image/png", MAX_AVATAR_LENGTH + 4),
      ).success,
    ).toBe(false);
  });
});
