import { describe, expect, it } from "vitest";

import mediaGame from "~/static/mock-media.jep.json";
import mockGame from "~/static/mock.jep.json";

import { ClueSchema, GameSchema } from "./convert.server";

const BASE = { clue: "Some clue", answer: "Some answer", value: 200 };

function issues(input: unknown): string[] {
  const result = ClueSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("ClueSchema media", () => {
  it("still accepts a plain text clue (backwards compatible)", () => {
    expect(ClueSchema.parse(BASE)).toEqual(BASE);
  });

  it("still accepts a legacy imageSrc from any host", () => {
    for (const imageSrc of [
      "https://www.j-archive.com/media/a.jpg",
      "http://www.j-archive.com/media/a.jpg",
      "https://my-files.example.net/pic.png",
    ]) {
      expect(ClueSchema.parse({ ...BASE, imageSrc }).imageSrc).toBe(imageSrc);
    }
    expect(issues({ ...BASE, imageSrc: "ftp://x.example/a.png" })).toEqual([
      "imageSrc must be a valid HTTP(S) URL",
    ]);
  });

  it("accepts image, audio, video and YouTube media blocks", () => {
    const clue = {
      ...BASE,
      media: [
        { type: "image", src: "https://a.example/pic.png", alt: "A picture" },
        { type: "audio", src: "https://a.example/song.mp3" },
        { type: "video", src: "https://a.example/clip.mp4" },
        { type: "video", src: "https://youtu.be/aqz-KE-bpKQ?t=30" },
      ],
      answerMedia: [{ type: "image", src: "https://a.example/answer.png" }],
    };
    expect(ClueSchema.parse(clue)).toEqual(clue);
  });

  it("trims media sources", () => {
    const parsed = ClueSchema.parse({
      ...BASE,
      media: [{ type: "image", src: "  https://a.example/pic.png " }],
    });
    expect(parsed.media?.[0].src).toBe("https://a.example/pic.png");
  });

  it("allows an empty clue text when media carries the question", () => {
    expect(
      ClueSchema.safeParse({
        ...BASE,
        clue: "",
        media: [{ type: "audio", src: "https://a.example/song.mp3" }],
      }).success,
    ).toBe(true);
    expect(
      ClueSchema.safeParse({
        ...BASE,
        clue: "",
        imageSrc: "https://a.example/pic.png",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty clue text without media", () => {
    expect(issues({ ...BASE, clue: "  " })).toEqual([
      "clue must not be empty (unless the clue has media)",
    ]);
    // Answer media alone does not carry the question.
    expect(
      issues({
        ...BASE,
        clue: "",
        media: [],
        answerMedia: [{ type: "image", src: "https://a.example/a.png" }],
      }),
    ).toEqual(["clue must not be empty (unless the clue has media)"]);
  });

  it.each([
    [{ type: "image", src: "http://a.example/pic.png" }, /https/],
    [{ type: "audio", src: "javascript:alert(1)" }, /https/],
    [{ type: "audio", src: "" }, /must not be empty/],
    [{ type: "gif", src: "https://a.example/pic.gif" }, /./],
    [{ src: "https://a.example/pic.png" }, /./],
    [{ type: "audio", src: "https://youtu.be/aqz-KE-bpKQ" }, /type "video"/],
    [{ type: "video", src: "https://www.youtube.com/@someone" }, /YouTube/],
  ])("rejects media block %j", (block, message) => {
    const found = issues({ ...BASE, media: [block] });
    expect(found.length).toBeGreaterThan(0);
    expect(found.join("\n")).toMatch(message);
    expect(issues({ ...BASE, answerMedia: [block] }).length).toBeGreaterThan(0);
  });

  it("caps the number of media blocks", () => {
    const block = { type: "image", src: "https://a.example/pic.png" };
    expect(
      issues({ ...BASE, media: Array.from({ length: 11 }, () => block) }),
    ).toEqual(["at most 10 media blocks per clue"]);
  });
});

describe("sample games", () => {
  it("parses the existing sample game with imageSrc", () => {
    expect(() => GameSchema.parse(mockGame)).not.toThrow();
  });

  it("parses the media sample game", () => {
    const game = GameSchema.parse(mediaGame);
    const clues = game.boards.flatMap((b) =>
      b.categories.flatMap((c) => c.clues),
    );
    const types = new Set(
      clues.flatMap((c) => c.media ?? []).map((m) => m.type),
    );
    expect(types).toEqual(new Set(["image", "audio", "video"]));
    expect(clues.some((c) => (c.answerMedia ?? []).length > 0)).toBe(true);
  });
});
