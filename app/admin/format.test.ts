import { describe, expect, it } from "vitest";

import { createT } from "~/i18n";

import { formatBytes, pageCount, parsePage, usagePercent } from "./format";

describe("formatBytes", () => {
  const en = createT("en");
  const uk = createT("uk");

  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [24_840, "24.3 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
    [1024 ** 3, "1.0 GB"],
    [-5, "0 B"],
  ])("%d → %s", (bytes, text) => {
    expect(formatBytes(bytes, en)).toBe(text);
  });

  it("uses Ukrainian units", () => {
    expect(formatBytes(3 * 1024 * 1024, uk)).toBe("3.0 МБ");
  });
});

describe("usagePercent", () => {
  it("rounds to a tenth of a percent", () => {
    expect(usagePercent(1, 3)).toBe(33.3);
    expect(usagePercent(0, 0)).toBe(0);
  });
});

describe("pages", () => {
  it("counts pages", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });

  it.each([
    [null, 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["abc", 1],
  ])("parsePage(%s) = %d", (value, page) => {
    expect(parsePage(value)).toBe(page);
  });
});
