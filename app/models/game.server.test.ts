import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabase, getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("~/supabase", () => ({
  getSupabase,
}));

vi.mock("~/supabase/admin.server", () => ({
  getSupabaseAdmin,
}));

import type { Clue } from "./convert.server";
import type { Database } from "./database.types";
import {
  clueToDbClue,
  dbClueToClue,
  getGame,
  getPublicGameSitemapEntries,
} from "./game.server";

type DbClue = Database["public"]["Tables"]["clues"]["Row"];

/** insertedRow simulates what Postgres returns for an inserted clue. */
function insertedRow(clue: Clue): DbClue {
  const insert = clueToDbClue(clue, 7);
  return {
    id: 1,
    category_id: insert.category_id,
    answer: insert.answer,
    clue: insert.clue,
    value: insert.value,
    wagerable: insert.wagerable ?? false,
    long_form: insert.long_form ?? false,
    image_src: insert.image_src ?? null,
    // jsonb round-trips through JSON serialization.
    media: JSON.parse(JSON.stringify(insert.media ?? null)),
    answer_media: JSON.parse(JSON.stringify(insert.answer_media ?? null)),
    choices: JSON.parse(JSON.stringify(insert.choices ?? null)),
    secret: insert.secret ?? null,
    secret_topic: insert.secret_topic ?? null,
    secret_value: insert.secret_value ?? null,
    read_time_sec: insert.read_time_sec ?? null,
  };
}

/** pickClueFields drops DB-only columns that leak through the row spread. */
function pickClueFields(clue: Clue) {
  const { clue: text, answer, value, imageSrc, media, answerMedia } = clue;
  return { clue: text, answer, value, imageSrc, media, answerMedia };
}

describe("clue media DB mapping", () => {
  it("round-trips media and answer media", () => {
    const clue: Clue = {
      clue: "",
      answer: "Big Buck Bunny",
      value: 400,
      media: [
        { type: "audio", src: "https://a.example/theme.mp3", alt: "Theme" },
        { type: "video", src: "https://youtu.be/aqz-KE-bpKQ?t=60" },
      ],
      answerMedia: [{ type: "image", src: "https://a.example/poster.png" }],
    };
    const insert = clueToDbClue(clue, 7);
    expect(insert.media).toEqual(clue.media);
    expect(insert.answer_media).toEqual(clue.answerMedia);
    expect(pickClueFields(dbClueToClue(insertedRow(clue)))).toEqual({
      ...clue,
      imageSrc: undefined,
    });
  });

  it("stores no media as null and reads null back as undefined", () => {
    const clue: Clue = {
      clue: "Text",
      answer: "Answer",
      value: 200,
      imageSrc: "https://www.j-archive.com/a.jpg",
      media: [],
    };
    const insert = clueToDbClue(clue, 7);
    expect(insert.media).toBeNull();
    expect(insert.answer_media).toBeNull();
    const back = dbClueToClue(insertedRow(clue));
    expect(back.media).toBeUndefined();
    expect(back.answerMedia).toBeUndefined();
    expect(back.imageSrc).toBe(clue.imageSrc);
  });

  it("ignores malformed media in old or hand-edited rows", () => {
    const row = insertedRow({ clue: "Text", answer: "Answer", value: 200 });
    const back = dbClueToClue({
      ...row,
      media: [{ type: "image", src: "javascript:alert(1)" }],
      answer_media: "nonsense",
    });
    expect(back.media).toBeUndefined();
    expect(back.answerMedia).toBeUndefined();
  });
});

describe("clue choices DB mapping", () => {
  const clue: Clue = {
    clue: "The capital of Australia",
    answer: "Canberra",
    value: 200,
    choices: ["Sydney", "Canberra", "Perth"],
  };

  it("round-trips choices", () => {
    expect(clueToDbClue(clue, 7).choices).toEqual(clue.choices);
    expect(dbClueToClue(insertedRow(clue)).choices).toEqual(clue.choices);
  });

  it("stores no choices as null and reads null back as undefined", () => {
    const plain: Clue = { clue: "Text", answer: "Answer", value: 200 };
    expect(clueToDbClue(plain, 7).choices).toBeNull();
    expect(dbClueToClue(insertedRow(plain)).choices).toBeUndefined();
  });

  it("ignores malformed choices in old or hand-edited rows", () => {
    const row = insertedRow(clue);
    for (const choices of [
      "nonsense",
      [1, 2],
      ["Sydney", "Perth"],
      ["Canberra"],
    ]) {
      expect(dbClueToClue({ ...row, choices }).choices).toBeUndefined();
    }
  });
});

describe("clue secret DB mapping", () => {
  const clue: Clue = {
    clue: "The author of The Cat in the Hat",
    answer: "Dr. Seuss",
    value: 400,
    secret: true,
    secretTopic: "Famous cats",
    secretValue: 500,
  };

  it("round-trips a secret clue", () => {
    const insert = clueToDbClue(clue, 7);
    expect(insert).toMatchObject({
      secret: true,
      secret_topic: "Famous cats",
      secret_value: 500,
    });
    expect(dbClueToClue(insertedRow(clue))).toMatchObject({
      secret: true,
      secretTopic: "Famous cats",
      secretValue: 500,
    });
  });

  it("stores a normal clue as nulls and reads them back as undefined", () => {
    const plain: Clue = { clue: "Text", answer: "Answer", value: 200 };
    expect(clueToDbClue(plain, 7)).toMatchObject({
      secret: null,
      secret_topic: null,
      secret_value: null,
    });
    const back = dbClueToClue(insertedRow(plain));
    expect(back.secret).toBeUndefined();
    expect(back.secretTopic).toBeUndefined();
    expect(back.secretValue).toBeUndefined();
  });

  it("drops the topic and value of a secret clue without secret", () => {
    const back = dbClueToClue({
      ...insertedRow(clue),
      secret: false,
    });
    expect(back.secret).toBeUndefined();
    expect(back.secretTopic).toBeUndefined();
    expect(back.secretValue).toBeUndefined();
  });

  it("ignores secret on wagerable rows (not allowed by the schema)", () => {
    const back = dbClueToClue({ ...insertedRow(clue), wagerable: true });
    expect(back.secret).toBeUndefined();
    expect(back.secretValue).toBeUndefined();
  });

  it("ignores an invalid secret value", () => {
    const back = dbClueToClue({ ...insertedRow(clue), secret_value: -5 });
    expect(back.secret).toBe(true);
    expect(back.secretValue).toBeUndefined();
  });
});

describe("clue reading time DB mapping", () => {
  it("round-trips the reading time hint", () => {
    const clue: Clue = {
      clue: "Look",
      answer: "A",
      value: 200,
      readTimeSec: 8,
    };
    expect(clueToDbClue(clue, 7)).toMatchObject({ read_time_sec: 8 });
    expect(dbClueToClue(insertedRow(clue)).readTimeSec).toBe(8);
  });

  it("stores no hint as null and reads it back as undefined", () => {
    const clue: Clue = { clue: "Look", answer: "A", value: 200 };
    expect(clueToDbClue(clue, 7)).toMatchObject({ read_time_sec: null });
    expect(dbClueToClue(insertedRow(clue)).readTimeSec).toBeUndefined();
  });

  it.each([-1, 61, 2.5])("ignores an invalid stored value %s", (value) => {
    const clue: Clue = { clue: "Look", answer: "A", value: 200 };
    const back = dbClueToClue({ ...insertedRow(clue), read_time_sec: value });
    expect(back.readTimeSec).toBeUndefined();
  });
});

describe("getPublicGameSitemapEntries", () => {
  beforeEach(() => {
    getSupabase.mockReset();
  });

  it("fetches public games until the database returns a short page", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `game-${index}`,
    }));
    const secondPage = [{ id: "game-1000" }, { id: "game-1001" }];
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    getSupabase.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    await expect(getPublicGameSitemapEntries()).resolves.toEqual([
      ...firstPage,
      ...secondPage,
    ]);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe("getGame", () => {
  /** A query builder whose calls are recorded and which resolves to data. */
  function query(data: unknown) {
    const calls: unknown[][] = [];
    const q = {
      calls,
      then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
      select: (...args: unknown[]) => record("select", args),
      eq: (...args: unknown[]) => record("eq", args),
      order: (...args: unknown[]) => record("order", args),
    };
    function record(method: string, args: unknown[]) {
      calls.push([method, ...args]);
      return q;
    }
    return q;
  }

  function row(categoryId: number, id: number, value: number): DbClue {
    return {
      ...insertedRow({ clue: `q${id}`, answer: `a${id}`, value }),
      id,
      category_id: categoryId,
    };
  }

  it("builds a board with uneven categories in a stable order", async () => {
    const games = query([
      { id: "g", title: "T", author: "A", visibility: "PUBLIC" },
    ]);
    const categories = query([
      { id: 1, name: "Short", round: 0, note: null, clues: [row(1, 1, 200)] },
      {
        id: 2,
        name: "Long",
        round: 0,
        note: null,
        clues: [row(2, 2, 200), row(2, 3, 400), row(2, 4, 400)],
      },
    ]);
    getSupabaseAdmin.mockReturnValue({
      from: (table: string) => (table === "games" ? games : categories),
    });

    const game = await getGame("g");

    expect(game?.boards[0].categoryNames).toEqual(["Short", "Long"]);
    expect(game?.boards[0].categories.map((c) => c.clues.length)).toEqual([
      1, 3,
    ]);
    // Rows inserted in one statement share created_at and clues may share a
    // value, so ids break ties: every player must see the same grid.
    expect(categories.calls.filter(([m]) => m === "order")).toEqual([
      ["order", "created_at"],
      ["order", "id"],
      ["order", "value", { foreignTable: "clues" }],
      ["order", "id", { foreignTable: "clues" }],
    ]);
  });
});
