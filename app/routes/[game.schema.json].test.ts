import { describe, expect, it } from "vitest";

import { MAX_CATEGORIES } from "~/models/convert.server";

import { loader } from "./[game.schema.json]";

describe("game.schema.json", () => {
  it("bounds the number of categories like the game schema", async () => {
    const schema = await loader().json();
    const board = schema.properties.boards.items.properties;
    for (const key of ["categoryNames", "categories"]) {
      expect(board[key].minItems).toBe(1);
      expect(board[key].maxItems).toBe(MAX_CATEGORIES);
    }
  });
});
