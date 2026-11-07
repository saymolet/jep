import { describe, expect, it } from "vitest";

import { fitScale } from "./fit-to-box";

describe("fitScale", () => {
  it("shrinks content taller than the box, never grows it", () => {
    expect(fitScale(720, 900)).toBeCloseTo(0.8);
    expect(fitScale(1080, 900)).toBe(1);
    expect(fitScale(0, 900)).toBe(1);
    expect(fitScale(720, 0)).toBe(1);
  });
});
