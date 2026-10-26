import { describe, expect, it } from "vitest";

import {
  clueMediaPaths,
  findOrphans,
  mediaObjectPath,
  ORPHAN_MIN_AGE_MS,
  planGameMediaDeletion,
  referencedPaths,
} from "./media-refs";

const BASE = "http://127.0.0.1:54321/storage/v1/object/public/game-media/";
const url = (path: string) => BASE + path;

describe("mediaObjectPath", () => {
  it.each([
    [url("siq/abc/pic.png"), "siq/abc/pic.png"],
    [url("siq/abc/My%20song.mp3"), "siq/abc/My song.mp3"],
    [url("siq/abc/%D0%BA%D1%96%D1%82.jpg"), "siq/abc/кіт.jpg"],
    [
      "https://x.supabase.co/storage/v1/object/public/game-media/siq/a/b.png",
      "siq/a/b.png",
    ],
  ])("reads %s", (src, path) => {
    expect(mediaObjectPath(src)).toBe(path);
  });

  it.each([
    "https://example.com/pic.png",
    "https://youtu.be/abc",
    "http://127.0.0.1:54321/storage/v1/object/public/other-bucket/a.png",
    BASE,
    "not a url",
    url("bad%E0%A4%A"),
    null,
    42,
  ])("ignores %s", (src) => {
    expect(mediaObjectPath(src)).toBeNull();
  });
});

describe("clueMediaPaths", () => {
  it("collects media, answer media and image_src, once each", () => {
    expect(
      clueMediaPaths({
        media: [
          { type: "image", src: url("siq/a/1.png") },
          { type: "video", src: "https://youtu.be/x" },
        ],
        answer_media: [
          { type: "audio", src: url("siq/a/2.mp3") },
          { type: "image", src: url("siq/a/1.png") },
        ],
        image_src: url("siq/a/3.png"),
      }).sort(),
    ).toEqual(["siq/a/1.png", "siq/a/2.mp3", "siq/a/3.png"]);
  });

  it("tolerates malformed jsonb", () => {
    expect(
      clueMediaPaths({
        media: { src: url("siq/a/1.png") },
        answer_media: [null, "x", { type: "image" }],
        image_src: null,
      }),
    ).toEqual([]);
  });
});

describe("planGameMediaDeletion", () => {
  const rows = [
    {
      game_id: "g1",
      media: [{ type: "image", src: url("siq/g1/a.png") }],
      answer_media: [{ type: "image", src: url("siq/g1/b.png") }],
      image_src: null,
    },
    {
      game_id: "g1",
      media: [{ type: "image", src: url("siq/g1/c.png") }],
      answer_media: null,
      image_src: null,
    },
    // A random board copied one of g1's clues by value.
    {
      game_id: "random",
      media: [{ type: "image", src: url("siq/g1/b.png") }],
      answer_media: null,
      image_src: null,
    },
    // g1 uses a file of another pack: it must stay.
    {
      game_id: "g1",
      media: null,
      answer_media: null,
      image_src: url("siq/g2/x.png"),
    },
    {
      game_id: "g2",
      media: [{ type: "image", src: url("siq/g2/x.png") }],
      answer_media: null,
      image_src: null,
    },
  ];

  it("removes only files no other game references", () => {
    expect(planGameMediaDeletion("g1", rows)).toEqual({
      remove: ["siq/g1/a.png", "siq/g1/c.png"],
      keep: ["siq/g1/b.png", "siq/g2/x.png"],
    });
  });

  it("removes nothing for a game without media", () => {
    expect(planGameMediaDeletion("none", rows)).toEqual({
      remove: [],
      keep: [],
    });
  });
});

describe("findOrphans", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");
  const old = new Date(now - ORPHAN_MIN_AGE_MS - 1).toISOString();
  const fresh = new Date(now - 60_000).toISOString();

  it("lists old unreferenced files and sums their size", () => {
    const referenced = referencedPaths([
      {
        media: [{ type: "image", src: url("siq/a/used.png") }],
        answer_media: null,
        image_src: null,
      },
    ]);
    const result = findOrphans(
      [
        { name: "siq/a/used.png", size: 100, created_at: old },
        { name: "siq/a/unused.png", size: 200, created_at: old },
        { name: "siq/b/gone.mp3", size: 50, created_at: old },
        // Uploaded a minute ago: an import may still be running.
        { name: "siq/c/new.png", size: 999, created_at: fresh },
        { name: "siq/d/.emptyFolderPlaceholder", size: 0, created_at: old },
        { name: "siq/e/bad-date.png", size: 7, created_at: "nope" },
      ],
      referenced,
      { now },
    );
    expect(result.orphans.map((o) => o.name)).toEqual([
      "siq/a/unused.png",
      "siq/b/gone.mp3",
    ]);
    expect(result.bytes).toBe(250);
  });
});
