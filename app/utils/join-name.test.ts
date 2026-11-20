import { afterEach, describe, expect, it } from "vitest";

import { loadStoredName, storeName } from "./join-name";

afterEach(() => localStorage.clear());

describe("join name storage", () => {
  it("remembers the trimmed name; an empty name forgets it", () => {
    expect(loadStoredName()).toBeUndefined();
    storeName("  Ann  ");
    expect(loadStoredName()).toBe("Ann");
    storeName("   ");
    expect(loadStoredName()).toBeUndefined();
  });
});
