import { describe, expect, test } from "vitest";

import { parseTimestamp } from "./local-date";

describe("parseTimestamp", () => {
  test.each([
    ["2026-10-25T05:00:00.123456", "2026-10-25T05:00:00.123Z"],
    ["2026-10-25T05:00:00", "2026-10-25T05:00:00.000Z"],
    ["2026-10-25T05:00:00Z", "2026-10-25T05:00:00.000Z"],
    ["2026-10-25T05:00:00+00:00", "2026-10-25T05:00:00.000Z"],
    ["2026-10-25T05:00:00.5+02:00", "2026-10-25T03:00:00.500Z"],
  ])("%s is %s", (input, expected) => {
    expect(parseTimestamp(input).toISOString()).toBe(expected);
  });
});
