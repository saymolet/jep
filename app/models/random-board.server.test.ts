import { beforeEach, describe, expect, it, vi } from "vitest";

import { seededRng } from "./random-board";

type Row = Record<string, unknown>;

interface FakeDb {
  categories: Row[];
  finals: Row[];
  /** Category rows with their clues, by id. */
  contents: Map<number, Row>;
  clues: Map<number, Row>;
  getSupabase: ReturnType<typeof vi.fn>;
}

const db = vi.hoisted(() => {
  const state: FakeDb = {
    categories: [],
    finals: [],
    contents: new Map(),
    clues: new Map(),
    getSupabase: vi.fn(),
  };
  return state;
});

vi.mock("varlock/env", () => ({
  ENV: { SUPABASE_URL: "http://127.0.0.1:54321" },
}));
vi.mock("~/supabase/admin.server", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("~/supabase", () => ({ getSupabase: db.getSupabase }));

import {
  generateRandomGame,
  RandomBoardPoolError,
} from "./random-board.server";

/** A fake of the few Supabase client calls the generator makes. */
function fakeClient() {
  const ok = (data: unknown) => Promise.resolve({ data, error: null });
  return {
    rpc: (fn: string) =>
      ok(fn === "random_board_categories" ? db.categories : db.finals),
    from: (table: string) => ({
      select: () => {
        if (table === "categories") {
          return {
            in: (_column: string, ids: number[]) => {
              const rows = ids
                .map((id) => db.contents.get(id))
                .filter((row) => row !== undefined);
              return { order: () => ({ order: () => ok(rows) }) };
            },
          };
        }
        return {
          eq: (_column: string, id: number) =>
            ok(db.clues.has(id) ? [db.clues.get(id)] : []),
        };
      },
    }),
  };
}

function dbClue(id: number, categoryId: number, value: number, extra = {}) {
  return {
    id,
    category_id: categoryId,
    clue: `Q${id}`,
    answer: `A${id}`,
    value,
    wagerable: false,
    long_form: false,
    image_src: null,
    media: null,
    answer_media: null,
    choices: null,
    secret: null,
    secret_topic: null,
    secret_value: null,
    read_time_sec: null,
    ...extra,
  };
}

function addCategory(id: number, name: string, gameId: string, clues: Row[]) {
  db.categories.push({
    id,
    name,
    game_id: gameId,
    game_title: `Title ${gameId}`,
    clue_count: clues.filter((c) => !c.long_form).length,
  });
  db.contents.set(id, { id, name, clues });
}

const TEXT = {
  title: "Random board",
  author: "Jep! random",
  note: (sources: string[]) => `From: ${sources.join(", ")}`,
};

describe("generateRandomGame", () => {
  beforeEach(() => {
    db.categories = [];
    db.finals = [];
    db.contents.clear();
    db.clues.clear();
    db.getSupabase.mockReset().mockImplementation(fakeClient);
  });

  it("builds a board from public categories with the anonymous client", async () => {
    for (let k = 1; k <= 4; k++) {
      addCategory(k, `Cat ${k}`, `g${k}`, [
        dbClue(k * 10 + 1, k, 100),
        dbClue(k * 10 + 2, k, 200, { wagerable: true }),
        dbClue(k * 10 + 3, k, 300),
        dbClue(k * 10 + 4, k, 0, { wagerable: true, long_form: true }),
      ]);
    }
    db.finals = [
      {
        id: 900,
        category_name: "Final",
        game_id: "g9",
        game_title: "Title g9",
      },
    ];
    db.clues.set(900, dbClue(900, 99, 0, { wagerable: true, long_form: true }));

    const game = await generateRandomGame(
      { categories: 3, rounds: 1, includeFinal: true },
      TEXT,
      seededRng(1),
    );

    // RLS of the anonymous role: never called with a user's token.
    for (const call of db.getSupabase.mock.calls) expect(call).toEqual([]);
    expect(game.boards).toHaveLength(2);
    expect(game.boards[0].categories).toHaveLength(3);
    for (const category of game.boards[0].categories) {
      expect(category.clues.map((c) => c.value)).toEqual([100, 200, 300]);
    }
    expect(game.boards[1].categories[0]).toMatchObject({
      name: "Final",
      clues: [{ clue: "Q900", longForm: true, wagerable: true }],
    });
    expect(game.note).toMatch(/^From: /);
    expect(game.note).toContain("Title g9");
  });

  it("replaces categories whose questions are invalid", async () => {
    // Category 1's questions have empty answers (invalid); 2–4 are fine.
    addCategory(1, "Broken", "g1", [
      dbClue(11, 1, 100, { answer: "" }),
      dbClue(12, 1, 200, { answer: "" }),
      dbClue(13, 1, 300, { answer: "" }),
    ]);
    for (let k = 2; k <= 4; k++) {
      addCategory(k, `Cat ${k}`, `g${k}`, [
        dbClue(k * 10 + 1, k, 100),
        dbClue(k * 10 + 2, k, 200),
        dbClue(k * 10 + 3, k, 300),
      ]);
    }

    for (let seed = 0; seed < 5; seed++) {
      const game = await generateRandomGame(
        { categories: 3, rounds: 1, includeFinal: false },
        TEXT,
        seededRng(seed),
      );
      expect(game.boards[0].categoryNames.sort()).toEqual([
        "Cat 2",
        "Cat 3",
        "Cat 4",
      ]);
    }
  });

  it("throws a pool error when there are not enough categories", async () => {
    addCategory(1, "Only", "g1", [
      dbClue(11, 1, 100),
      dbClue(12, 1, 200),
      dbClue(13, 1, 300),
    ]);
    await expect(
      generateRandomGame(
        { categories: 3, rounds: 1, includeFinal: false },
        TEXT,
        seededRng(1),
      ),
    ).rejects.toEqual(new RandomBoardPoolError(3, 1));
  });
});
