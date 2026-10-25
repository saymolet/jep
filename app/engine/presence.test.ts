import { describe, expect, it } from "vitest";

import { countWatchers } from "./presence";

describe("countWatchers", () => {
  it("is 0 for an empty channel", () => {
    expect(countWatchers({})).toBe(0);
  });

  it("counts spectators only (not players or presenter screens)", () => {
    expect(
      countWatchers({
        a: [{ role: "spectator" }],
        b: [{ role: "player" }],
        c: [{ role: "presenter" }],
        d: [{ role: "spectator" }],
        e: [{}],
      }),
    ).toBe(2);
  });

  it("uses the latest role of a key", () => {
    expect(
      countWatchers({ a: [{ role: "spectator" }, { role: "player" }] }),
    ).toBe(0);
    expect(
      countWatchers({ a: [{ role: "player" }, { role: "spectator" }] }),
    ).toBe(1);
  });
});
