import { describe, expect, it } from "vitest";

import type { SiqImportSummary } from "./import.server";
import { formatSiqSummary } from "./summary";

const BASE: SiqImportSummary = {
  title: "Pack",
  boards: 2,
  categories: 7,
  questions: 31,
  droppedQuestions: 0,
  mediaFiles: 12,
  warnings: [],
};

describe("formatSiqSummary", () => {
  it("counts what was imported", () => {
    expect(formatSiqSummary(BASE)).toEqual({
      message:
        'Imported SIGame pack "Pack": 2 rounds, 7 categories, 31 questions, 12 media files.',
      details: [],
    });
  });

  it("uses singulars", () => {
    expect(
      formatSiqSummary({
        ...BASE,
        boards: 1,
        categories: 1,
        questions: 1,
        mediaFiles: 1,
        droppedQuestions: 1,
        warnings: ["w"],
      }).message,
    ).toBe(
      'Imported SIGame pack "Pack": 1 round, 1 category, 1 question, 1 media file. 1 question skipped. 1 warning.',
    );
  });

  it("lists a few warnings and counts the rest", () => {
    const warnings = Array.from({ length: 20 }, (_, i) => `warning ${i}`);
    const { message, details } = formatSiqSummary({
      ...BASE,
      droppedQuestions: 3,
      warnings,
    });
    expect(message).toContain("3 questions skipped. 20 warnings.");
    expect(details).toEqual([
      ...warnings.slice(0, 8),
      "…and 12 more warnings.",
    ]);
  });

  it("stays small enough for the session cookie", () => {
    const long = "Кот в мешке ".repeat(100);
    const { message, details } = formatSiqSummary({
      ...BASE,
      title: long,
      warnings: Array.from({ length: 50 }, () => long),
    });
    const bytes = new TextEncoder().encode(
      JSON.stringify({ success: true, message, details }),
    ).length;
    expect(bytes).toBeLessThan(2000);
    expect(details.at(-1)).toMatch(/^…and \d+ more warnings\.$/);
  });
});
