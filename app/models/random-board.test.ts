import { describe, expect, it } from "vitest";

import { GameSchema } from "~/models/convert.server";

import {
  buildRandomGame,
  type CandidateCategory,
  type FinalCandidate,
  normalizeCategoryName,
  pickRandomBoard,
  randomBoardOptionsSchema,
  seededRng,
} from "./random-board";

function cat(
  id: number,
  name: string,
  gameId: string,
  clueCount = 5,
): CandidateCategory {
  return { id, name, gameId, gameTitle: `Game ${gameId}`, clueCount };
}

/** 12 categories with distinct names spread over 4 games. */
const POOL: CandidateCategory[] = Array.from({ length: 12 }, (_, k) =>
  cat(k + 1, `Category ${k + 1}`, `g${k % 4}`),
);

const FINALS: FinalCandidate[] = [
  { id: 101, categoryName: "Final A", gameId: "g0", gameTitle: "Game g0" },
  { id: 102, categoryName: "Final B", gameId: "g1", gameTitle: "Game g1" },
];

const OPTS = { categories: 5, rounds: 1, includeFinal: false };

function picked(result: ReturnType<typeof pickRandomBoard>) {
  if (!result.ok) throw new Error("expected a board");
  return result;
}

describe("seededRng", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(90);
  });
});

describe("pickRandomBoard", () => {
  it("picks the requested number of categories for one round", () => {
    const result = picked(pickRandomBoard(POOL, [], OPTS, seededRng(1)));
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toHaveLength(5);
    expect(result.final).toBeNull();
  });

  it("picks different categories for two rounds", () => {
    const result = picked(
      pickRandomBoard(POOL, [], { ...OPTS, rounds: 2 }, seededRng(2)),
    );
    expect(result.rounds.map((r) => r.length)).toEqual([5, 5]);
    const ids = result.rounds.flat().map((c) => c.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("is deterministic for a seed and varies between seeds", () => {
    const ids = (seed: number) =>
      picked(pickRandomBoard(POOL, [], OPTS, seededRng(seed))).rounds[0].map(
        (c) => c.id,
      );
    expect(ids(7)).toEqual(ids(7));
    const variants = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ids(s).join(",")),
    );
    expect(variants.size).toBeGreaterThan(1);
  });

  it("never uses the same name twice (case and spacing ignored)", () => {
    const pool = [
      cat(1, "History", "g1"),
      cat(2, "history ", "g2"),
      cat(3, "HISTORY", "g3"),
      cat(4, "Science", "g1"),
      cat(5, "Art", "g2"),
      cat(6, "Music", "g3"),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const result = picked(
        pickRandomBoard(pool, [], { ...OPTS, categories: 4 }, seededRng(seed)),
      );
      const names = result.rounds[0].map((c) => normalizeCategoryName(c.name));
      expect(new Set(names).size).toBe(4);
    }
  });

  it("never takes the same source category twice", () => {
    const pool = [...POOL.slice(0, 3), ...POOL.slice(0, 3)];
    expect(
      pickRandomBoard(pool, [], { ...OPTS, categories: 4 }, seededRng(3)),
    ).toEqual({ ok: false, needed: 4, available: 3 });
  });

  it("skips categories with fewer than 3 questions", () => {
    const pool = [
      cat(1, "A", "g1", 2),
      cat(2, "B", "g1", 3),
      cat(3, "C", "g2", 0),
      cat(4, "D", "g2", 4),
      cat(5, "E", "g3", 7),
    ];
    const result = picked(
      pickRandomBoard(pool, [], { ...OPTS, categories: 3 }, seededRng(4)),
    );
    expect(result.rounds[0].map((c) => c.id).sort()).toEqual([2, 4, 5]);
  });

  it("prefers categories from different games", () => {
    // 4 games, 4 categories each round: one category per game.
    for (let seed = 0; seed < 20; seed++) {
      const result = picked(
        pickRandomBoard(POOL, [], { ...OPTS, categories: 4 }, seededRng(seed)),
      );
      const games = result.rounds[0].map((c) => c.gameId);
      expect(new Set(games).size).toBe(4);
    }
  });

  it("still fills the board from few games", () => {
    const pool = [1, 2, 3, 4, 5].map((k) => cat(k, `C${k}`, "only"));
    const result = picked(pickRandomBoard(pool, [], OPTS, seededRng(5)));
    expect(result.rounds[0]).toHaveLength(5);
  });

  it("reports an insufficient pool", () => {
    expect(
      pickRandomBoard(
        POOL.slice(0, 7),
        [],
        { ...OPTS, rounds: 2 },
        seededRng(6),
      ),
    ).toEqual({ ok: false, needed: 10, available: 7 });
    expect(pickRandomBoard([], [], OPTS, seededRng(6))).toEqual({
      ok: false,
      needed: 5,
      available: 0,
    });
  });

  it("picks a final question when asked and one exists", () => {
    const result = picked(
      pickRandomBoard(
        POOL,
        FINALS,
        { ...OPTS, includeFinal: true },
        seededRng(8),
      ),
    );
    expect(FINALS).toContainEqual(result.final);
  });

  it("has no final when not asked or when there is none", () => {
    expect(
      picked(pickRandomBoard(POOL, FINALS, OPTS, seededRng(9))).final,
    ).toBeNull();
    expect(
      picked(
        pickRandomBoard(
          POOL,
          [],
          { ...OPTS, includeFinal: true },
          seededRng(9),
        ),
      ).final,
    ).toBeNull();
  });
});

describe("randomBoardOptionsSchema", () => {
  it("parses form values with defaults", () => {
    expect(randomBoardOptionsSchema.parse({})).toEqual({
      categories: 5,
      rounds: 1,
      includeFinal: false,
    });
    expect(
      randomBoardOptionsSchema.parse({
        categories: "8",
        rounds: "2",
        includeFinal: "on",
      }),
    ).toEqual({ categories: 8, rounds: 2, includeFinal: true });
  });

  it.each([
    { categories: "2" },
    { categories: "9" },
    { categories: "4.5" },
    { rounds: "0" },
    { rounds: "3" },
  ])("rejects %o", (input) => {
    expect(randomBoardOptionsSchema.safeParse(input).success).toBe(false);
  });
});

describe("buildRandomGame", () => {
  const clue = (value: number, extra = {}) => ({
    clue: `Q${value}`,
    answer: `A${value}`,
    value,
    ...extra,
  });

  it("builds a valid game, keeping clues and dropping long-form ones", () => {
    const game = buildRandomGame({
      title: "Random board",
      author: "Jep! random",
      note: "From: X, Y",
      rounds: [
        [
          {
            name: "Cats",
            clues: [
              clue(100, { secret: true, secretTopic: "Pets" }),
              clue(200, { choices: ["A200", "B"] }),
              clue(300, { wagerable: true }),
              clue(400, { wagerable: true, longForm: true }),
            ],
          },
          {
            name: "Dogs",
            clues: [
              clue(100, {
                media: [{ type: "image", src: "https://x.test/a.png" }],
              }),
              clue(200),
              clue(300),
            ],
          },
        ],
      ],
      final: {
        categoryName: "Final A",
        clue: clue(0, { wagerable: true, longForm: true }),
      },
    });

    expect(GameSchema.safeParse(game).success).toBe(true);
    expect(game.boards).toHaveLength(2);
    expect(game.boards[0].categoryNames).toEqual(["Cats", "Dogs"]);
    expect(game.boards[0].categories[0].clues).toHaveLength(3);
    expect(game.boards[0].categories[0].clues[0]).toMatchObject({
      secret: true,
      secretTopic: "Pets",
    });
    expect(game.boards[0].categories[0].clues[1].choices).toEqual([
      "A200",
      "B",
    ]);
    expect(game.boards[0].categories[0].clues[2].wagerable).toBe(true);
    expect(game.boards[0].categories[1].clues[0].media).toHaveLength(1);
    expect(game.boards[1]).toEqual({
      categoryNames: ["Final A"],
      categories: [
        {
          name: "Final A",
          clues: [clue(0, { wagerable: true, longForm: true })],
        },
      ],
    });
  });

  it("has only the board rounds without a final", () => {
    const game = buildRandomGame({
      title: "T",
      author: "A",
      note: "",
      rounds: [
        [{ name: "A", clues: [clue(1), clue(2), clue(3)] }],
        [{ name: "B", clues: [clue(1), clue(2), clue(3)] }],
      ],
      final: null,
    });
    expect(game.boards.map((b) => b.categoryNames)).toEqual([["A"], ["B"]]);
  });
});
