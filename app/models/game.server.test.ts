import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabase } = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}));

vi.mock("~/supabase", () => ({
  getSupabase,
}));

vi.mock("~/supabase/admin.server", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import type { Clue } from "./convert.server";
import type { Database } from "./database.types";
import {
  clueToDbClue,
  dbClueToClue,
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
