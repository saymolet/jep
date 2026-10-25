import { describe, expect, it } from "vitest";

import {
  choiceLabel,
  choicesError,
  getCorrectChoiceIndex,
  isChoiceIndex,
  isCorrectChoice,
} from "./choices";

describe("choiceLabel", () => {
  it("labels options A, B, C...", () => {
    expect([0, 1, 2, 3, 4, 5].map(choiceLabel)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);
  });
});

describe("choicesError", () => {
  const cases: [string, string[], string, string | null][] = [
    ["valid", ["Paris", "Rome", "Berlin"], "Paris", null],
    ["answer matches ignoring case", ["Paris", "Rome"], "paris", null],
    ["too few", ["Paris"], "Paris", "choices must have 2 to 6 options"],
    [
      "too many",
      ["a", "b", "c", "d", "e", "f", "g"],
      "a",
      "choices must have 2 to 6 options",
    ],
    ["empty option", ["Paris", ""], "Paris", "choices must not be empty"],
    [
      "duplicates",
      ["Paris", "Rome", "paris"],
      "Rome",
      "choices must be unique",
    ],
    [
      "answer missing",
      ["Paris", "Rome"],
      "Berlin",
      "answer must be one of the choices",
    ],
  ];
  it.each(cases)("%s", (_, choices, answer, expected) => {
    expect(choicesError(choices, answer)).toBe(expected);
  });
});

describe("correctness", () => {
  const clue = { answer: "Rome", choices: ["Paris", "Rome", "Berlin"] };

  it("finds the correct option", () => {
    expect(getCorrectChoiceIndex(clue)).toBe(1);
    expect(getCorrectChoiceIndex({ answer: "x" })).toBe(-1);
  });

  it("checks picks against the answer", () => {
    expect(isCorrectChoice(clue, 1)).toBe(true);
    expect(isCorrectChoice(clue, 0)).toBe(false);
    expect(isCorrectChoice(clue, 7)).toBe(false);
  });

  it("validates option indexes", () => {
    expect(isChoiceIndex(clue, 0)).toBe(true);
    expect(isChoiceIndex(clue, 2)).toBe(true);
    expect(isChoiceIndex(clue, 3)).toBe(false);
    expect(isChoiceIndex(clue, -1)).toBe(false);
    expect(isChoiceIndex(clue, 1.5)).toBe(false);
    expect(isChoiceIndex({ answer: "x" }, 0)).toBe(false);
  });
});
