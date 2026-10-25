import { describe, expect, it } from "vitest";

import game8x5 from "~/static/mock-8x5.jep.json";
import choiceGame from "~/static/mock-choice.jep.json";
import mediaGame from "~/static/mock-media.jep.json";
import secretGame from "~/static/mock-secret.jep.json";
import raggedGame from "~/static/mock-ragged.jep.json";
import mockGame from "~/static/mock.jep.json";

import { ClueSchema, GameSchema, MAX_CATEGORIES } from "./convert.server";

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

describe("ClueSchema choices", () => {
  const CHOICE = {
    clue: "The capital of Australia",
    answer: "Canberra",
    value: 200,
    choices: ["Sydney", "Canberra", "Perth"],
  };

  it("accepts a multiple choice clue", () => {
    expect(ClueSchema.parse(CHOICE)).toEqual(CHOICE);
  });

  it("leaves clues without choices unchanged", () => {
    expect(ClueSchema.parse(BASE)).not.toHaveProperty("choices");
  });

  it("trims options", () => {
    expect(
      ClueSchema.parse({ ...CHOICE, choices: [" Sydney ", "Canberra  "] })
        .choices,
    ).toEqual(["Sydney", "Canberra"]);
  });

  it("accepts choices on a wagerable clue", () => {
    expect(ClueSchema.safeParse({ ...CHOICE, wagerable: true }).success).toBe(
      true,
    );
  });

  it.each([
    [["Canberra"], "choices must have 2 to 6 options"],
    [["a", "b", "c", "d", "e", "Canberra", "g"], /2 to 6/],
    [["Canberra", "  "], "choices must not be empty"],
    [["Canberra", "Perth", "perth "], "choices must be unique"],
    [["Sydney", "Perth"], "answer must be one of the choices"],
  ])("rejects choices %j", (choices, message) => {
    const found = issues({ ...CHOICE, choices });
    expect(found.length).toBeGreaterThan(0);
    expect(found.join("\n")).toMatch(message);
  });

  it("rejects choices on a long-form clue", () => {
    expect(
      issues({ ...CHOICE, wagerable: true, longForm: true }).join("\n"),
    ).toMatch("long-form clues cannot have choices");
  });
});

describe("ClueSchema secret", () => {
  const SECRET = { ...BASE, secret: true };

  it("accepts a secret clue with an optional topic and value", () => {
    expect(ClueSchema.parse(SECRET)).toEqual(SECRET);
    const full = { ...SECRET, secretTopic: "Cats", secretValue: 500 };
    expect(ClueSchema.parse(full)).toEqual(full);
  });

  it("leaves clues without secret unchanged", () => {
    expect(ClueSchema.parse(BASE)).not.toHaveProperty("secret");
  });

  it("trims the secret topic", () => {
    expect(
      ClueSchema.parse({ ...SECRET, secretTopic: "  Cats " }).secretTopic,
    ).toBe("Cats");
  });

  it("accepts secret multiple choice and media clues", () => {
    expect(
      ClueSchema.safeParse({
        ...SECRET,
        answer: "Canberra",
        choices: ["Sydney", "Canberra"],
        media: [{ type: "image", src: "https://a.example/pic.png" }],
      }).success,
    ).toBe(true);
  });

  it.each([
    [{ wagerable: true }, "secret clues cannot be wagerable"],
    [
      { wagerable: true, longForm: true },
      "secret clues cannot be wagerable or long-form",
    ],
    [{ secretTopic: "  " }, "secretTopic must not be empty"],
    [{ secretValue: 0 }, "secretValue must be positive"],
    [{ secretValue: -100 }, "secretValue must be positive"],
  ])("rejects a secret clue with %j", (extra, message) => {
    const found = issues({ ...SECRET, ...extra });
    expect(found.length).toBeGreaterThan(0);
    expect(found.join("\n")).toMatch(message);
  });

  it.each([
    [{ secretTopic: "Cats" }],
    [{ secretValue: 500 }],
    [{ secret: false, secretValue: 500 }],
  ])("rejects secret fields without secret: true (%j)", (extra) => {
    expect(issues({ ...BASE, ...extra }).join("\n")).toMatch(
      "secretTopic and secretValue need secret: true",
    );
  });
});

function gameWithCategories(sizes: number[]) {
  const names = sizes.map((_, j) => `Category ${j + 1}`);
  return {
    title: "Wide",
    author: "Test",
    copyright: "",
    note: "",
    boards: [
      {
        categoryNames: names,
        categories: sizes.map((n, j) => ({
          name: names[j],
          clues: Array.from({ length: n }, (_, i) => ({
            ...BASE,
            value: 200 * (i + 1),
          })),
        })),
      },
    ],
  };
}

describe("BoardSchema size", () => {
  it.each([1, 5, 6, 8, 10, MAX_CATEGORIES])("accepts %i categories", (n) => {
    expect(
      GameSchema.safeParse(gameWithCategories(Array(n).fill(5))).success,
    ).toBe(true);
  });

  it("rejects more than 12 categories with a clear error", () => {
    const result = GameSchema.safeParse(
      gameWithCategories(Array(MAX_CATEGORIES + 1).fill(5)),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "a board can have at most 12 categories",
    );
  });

  it("accepts categories with different numbers of questions", () => {
    expect(GameSchema.safeParse(gameWithCategories([3, 5, 4])).success).toBe(
      true,
    );
  });

  it("still rejects a category without questions", () => {
    expect(GameSchema.safeParse(gameWithCategories([3, 0, 4])).success).toBe(
      false,
    );
  });
});

describe("sample games", () => {
  it("parses the 8-category sample game", () => {
    const game = GameSchema.parse(game8x5);
    expect(game.boards[0].categories).toHaveLength(8);
  });

  it("parses the uneven sample game", () => {
    const game = GameSchema.parse(raggedGame);
    expect(game.boards[0].categories.map((c) => c.clues.length)).toEqual([
      3, 5, 4,
    ]);
  });

  it("parses the secret question sample game", () => {
    const game = GameSchema.parse(secretGame);
    const clues = game.boards.flatMap((b) =>
      b.categories.flatMap((c) => c.clues),
    );
    expect(clues.some((c) => c.secret && c.choices)).toBe(true);
    expect(clues.some((c) => c.secret && c.media)).toBe(true);
    expect(clues.some((c) => c.secret && c.secretTopic)).toBe(true);
    expect(clues.some((c) => c.secret && !c.secretTopic)).toBe(true);
    expect(clues.some((c) => !c.secret)).toBe(true);
  });

  it("parses the multiple choice sample game", () => {
    const game = GameSchema.parse(choiceGame);
    const clues = game.boards.flatMap((b) =>
      b.categories.flatMap((c) => c.clues),
    );
    expect(clues.some((c) => c.choices && c.wagerable)).toBe(true);
    expect(clues.some((c) => c.choices && c.media)).toBe(true);
    expect(clues.some((c) => !c.choices)).toBe(true);
  });

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
