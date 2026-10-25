import { describe, expect, it } from "vitest";

import { MAX_AVATAR_LENGTH } from "~/models/avatar";
import { parseFormData } from "~/utils/http.server";

import { PlayerFormPayload } from "./actions";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function parse(fields: Record<string, string>) {
  return parseFormData(form(fields), PlayerFormPayload);
}

function statusOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof Response) return e.status;
    throw e;
  }
  return 200;
}

describe("PlayerFormPayload", () => {
  it("accepts a player without an avatar", () => {
    expect(parse({ userId: "u", name: "Ann" })).toEqual({
      userId: "u",
      name: "Ann",
    });
  });

  it.each([
    ["an emoji avatar", "emoji:🦊"],
    ["a photo avatar", TINY_PNG],
    [
      "a 40 KB (192×192) photo avatar",
      "data:image/webp;base64," + "A".repeat(40 * 1024),
    ],
    ["an empty avatar (remove)", ""],
  ])("accepts %s", (_, avatar) => {
    expect(parse({ userId: "u", name: "Ann", avatar }).avatar).toBe(avatar);
  });

  it.each([
    ["a non-emoji", "emoji:hello"],
    ["an SVG", "data:image/svg+xml;base64,PHN2Zz4="],
    ["a remote URL", "https://example.com/a.png"],
    [
      "an oversized photo",
      "data:image/webp;base64," + "A".repeat(MAX_AVATAR_LENGTH),
    ],
  ])("rejects %s with a 400", (_, avatar) => {
    expect(statusOf(() => parse({ userId: "u", name: "Ann", avatar }))).toBe(
      400,
    );
  });
});
