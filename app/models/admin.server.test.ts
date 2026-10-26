import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("varlock/env", () => ({
  ENV: { SUPABASE_URL: "http://127.0.0.1:54321" },
}));

const MEDIA = "http://127.0.0.1:54321/storage/v1/object/public/game-media/";

const state = vi.hoisted(() => {
  const value: {
    clueRows: unknown[];
    deletedGames: string[];
    removed: string[][];
    calls: string[];
  } = { clueRows: [], deletedGames: [], removed: [], calls: [] };
  return value;
});

/** A tiny fake of the parts of the Supabase client deleteGameWithMedia and
 * scanOrphans use. Every query builder method returns the builder; awaiting
 * it gives the table's answer. */
function fakeClient() {
  return {
    from(table: string) {
      let op = "select";
      let id: unknown;
      const builder = {
        select: () => builder,
        or: () => builder,
        order: () => builder,
        range: () => builder,
        delete: () => {
          op = "delete";
          return builder;
        },
        eq: (_column: string, value: unknown) => {
          id = value;
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          state.calls.push(`${op} ${table}`);
          if (table === "clues") {
            resolve({ data: state.clueRows, error: null });
          } else if (table === "games" && op === "delete") {
            state.deletedGames.push(String(id));
            resolve({ data: [{ title: "Pack" }], error: null });
          } else {
            resolve({ data: [], error: null });
          }
        },
      };
      return builder;
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          state.calls.push("remove");
          state.removed.push(paths);
          return { data: [], error: null };
        },
      }),
    },
    rpc: async (name: string) => {
      if (name === "admin_media_objects") {
        return {
          data: [
            {
              name: "siq/g1/a.png",
              size: 10,
              created_at: "2026-01-01T00:00:00Z",
            },
            {
              name: "siq/old/x.png",
              size: 32,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: { message: "unexpected rpc" } };
    },
  };
}

vi.mock("~/supabase/admin.server", () => ({
  getSupabaseAdmin: () => fakeClient(),
}));

import { deleteGameWithMedia, scanOrphans, searchFilter } from "./admin.server";

function clue(gameId: string, ...files: string[]) {
  return {
    media: files.map((f) => ({ type: "image", src: MEDIA + f })),
    answer_media: null,
    image_src: null,
    categories: { game_id: gameId },
  };
}

beforeEach(() => {
  state.clueRows = [];
  state.deletedGames = [];
  state.removed = [];
  state.calls = [];
});

describe("deleteGameWithMedia", () => {
  it("deletes the game, then only the files no other game uses", async () => {
    state.clueRows = [
      clue("g1", "siq/g1/a.png", "siq/g1/b.png"),
      clue("g1", "siq/g1/c.mp3"),
      // A random board copied a question with b.png.
      clue("random", "siq/g1/b.png"),
    ];
    expect(await deleteGameWithMedia("g1")).toEqual({
      title: "Pack",
      removed: 2,
      kept: 1,
    });
    expect(state.deletedGames).toEqual(["g1"]);
    expect(state.removed).toEqual([["siq/g1/a.png", "siq/g1/c.mp3"]]);
    // The database row goes first: if removing files fails, they are only
    // orphans (found by the cleanup), never files of a game that still exists.
    expect(state.calls).toEqual(["select clues", "delete games", "remove"]);
  });

  it("removes nothing when every file is used elsewhere", async () => {
    state.clueRows = [clue("g1", "siq/x/a.png"), clue("g2", "siq/x/a.png")];
    expect(await deleteGameWithMedia("g1")).toEqual({
      title: "Pack",
      removed: 0,
      kept: 1,
    });
    expect(state.removed.flat()).toEqual([]);
  });
});

describe("scanOrphans", () => {
  it("finds files no question uses", async () => {
    state.clueRows = [clue("g1", "siq/g1/a.png")];
    const result = await scanOrphans(Date.parse("2026-06-01T00:00:00Z"));
    expect(result.objects).toBe(2);
    expect(result.orphans.map((o) => o.name)).toEqual(["siq/old/x.png"]);
    expect(result.bytes).toBe(32);
  });
});

describe("searchFilter", () => {
  it("matches every word in the title or every word in the author", () => {
    expect(searchFilter("Кіт  pack")).toBe(
      "and(title.ilike.*Кіт*,title.ilike.*pack*),and(author.ilike.*Кіт*,author.ilike.*pack*)",
    );
  });

  it("drops PostgREST syntax and empty searches", () => {
    expect(searchFilter("a,b)(*.c")).toBe(
      "and(title.ilike.*a*,title.ilike.*b*,title.ilike.*c*),and(author.ilike.*a*,author.ilike.*b*,author.ilike.*c*)",
    );
    expect(searchFilter("  ,.()  ")).toBeNull();
    expect(searchFilter(null)).toBeNull();
  });
});
