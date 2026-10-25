import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALLOWED_CONTENT_TYPES, mediaFileType } from "./media-types";

describe("mediaFileType", () => {
  it.each([
    ["Images/a.JPG", "image", "image/jpeg"],
    ["Images/a%20b.png", "image", "image/png"],
    ["Audio/x.mp3", "audio", "audio/mpeg"],
    ["Audio/x.wav", "audio", "audio/wav"],
    ["Video/x.mp4", "video", "video/mp4"],
    ["Video/x.webm", "video", "video/webm"],
  ])("%s", (name, type, contentType) => {
    expect(mediaFileType(name)).toEqual({ type, contentType });
  });

  it.each([
    "Images/a.svg",
    "Html/a.html",
    "a.exe",
    "Images/noext",
    "Images/.png",
  ])("rejects %s", (name) => {
    expect(mediaFileType(name)).toBeUndefined();
  });
});

describe("game-media bucket migration", () => {
  it("allows exactly the content types the importer uploads", () => {
    const dir = path.resolve("supabase/migrations");
    const file = readdirSync(dir).find((f) =>
      f.endsWith("_game_media_bucket.sql"),
    );
    expect(file).toBeDefined();
    const sql = readFileSync(path.join(dir, file!), "utf-8");
    const listed = [...sql.matchAll(/'((?:image|audio|video)\/[^']+)'/g)].map(
      (m) => m[1],
    );
    expect(listed.sort()).toEqual(ALLOWED_CONTENT_TYPES);
  });
});
