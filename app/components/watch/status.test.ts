import { describe, expect, it } from "vitest";

import { ActionType, CLUE_TIMEOUT_MS, GameState } from "~/engine";

import {
  ANN,
  BOB,
  engineFor,
  play,
  playUntil,
  STEPS,
} from "./fixtures.test-helpers";
import { getViewerStatus, getWinners, sortByScore } from "./status";

function statusAfter(
  step: keyof typeof STEPS | null,
  options?: Parameters<typeof getViewerStatus>[1],
) {
  const state = step ? playUntil(step) : play();
  return getViewerStatus(engineFor(state), options);
}

describe("getViewerStatus", () => {
  it.each<[keyof typeof STEPS | null, GameState, unknown]>([
    [null, GameState.PreviewRound, { kind: "waitingForPlayers" }],
    [
      "join",
      GameState.PreviewRound,
      { kind: "roundStarting", round: 1, name: "Ann" },
    ],
    ["start", GameState.ShowBoard, { kind: "choosing", name: "Ann" }],
    ["chooseFirst", GameState.ReadClue, { kind: "reading" }],
    [
      "buzzFirst",
      GameState.RevealAnswerToBuzzer,
      { kind: "answering", name: "Ann" },
    ],
    ["checkFirst", GameState.RevealAnswerToAll, { kind: "gotIt", name: "Ann" }],
    ["chooseWager", GameState.WagerClue, { kind: "wagering", name: "Ann" }],
    ["wager", GameState.ReadWagerableClue, { kind: "answering", name: "Ann" }],
    ["chooseSecret", GameState.PassClue, { kind: "passing", name: "Ann" }],
    [
      "passSecret",
      GameState.RevealAnswerToBuzzer,
      { kind: "secretAnswering", name: "Bob" },
    ],
    ["finishSecret", GameState.ShowBoard, { kind: "choosing", name: "Bob" }],
    [
      "buzzChoice",
      GameState.RevealAnswerToBuzzer,
      { kind: "picking", name: "Ann" },
    ],
    [
      "finishChoice",
      GameState.PreviewRound,
      // The final has no "chooses first".
      { kind: "roundStarting", round: 2, name: undefined },
    ],
    ["startFinal", GameState.ShowBoard, { kind: "final" }],
    [
      "chooseFinal",
      GameState.WagerClue,
      { kind: "finalWagers", done: 0, total: 2 },
    ],
    [
      "wagerAnnFinal",
      GameState.WagerClue,
      { kind: "finalWagers", done: 1, total: 2 },
    ],
    ["wagerBobFinal", GameState.ReadLongFormClue, { kind: "writing" }],
    ["answerFinal", GameState.RevealAnswerLongForm, { kind: "checking" }],
    ["checkFinal", GameState.RevealAnswerToAll, { kind: "answer" }],
    ["finishFinal", GameState.GameOver, { kind: "gameOver", winners: ["Ann"] }],
  ])("after %s (%s)", (step, type, expected) => {
    const state = step ? playUntil(step) : play();
    expect(state.type).toBe(type);
    expect(getViewerStatus(engineFor(state))).toEqual(expected);
  });

  it("opens the buzzers once the question has been read", () => {
    expect(statusAfter("chooseFirst", { buzzersOpen: true })).toEqual({
      kind: "buzzersOpen",
    });
  });

  it("says no one got it when nobody buzzed", () => {
    const timeout = (userId: string) => ({
      type: ActionType.Buzz,
      payload: { userId, i: 0, j: 0, deltaMs: CLUE_TIMEOUT_MS + 1 },
    });
    const state = play(STEPS.join, STEPS.start, STEPS.chooseFirst, [
      timeout(ANN),
      timeout(BOB),
    ]);
    expect(state.type).toBe(GameState.RevealAnswerToAll);
    expect(getViewerStatus(engineFor(state))).toEqual({
      kind: "noOneAnswered",
    });
  });

  it("shows the pause over everything but game over", () => {
    const state = play(STEPS.join, STEPS.start, STEPS.pause);
    expect(state.isPaused).toBe(true);
    expect(getViewerStatus(engineFor(state))).toEqual({ kind: "paused" });
  });
});

describe("getWinners / sortByScore", () => {
  const players = new Map([
    ["a", { userId: "a", name: "A", score: 100 }],
    ["b", { userId: "b", name: "B", score: 300 }],
    ["c", { userId: "c", name: "C", score: 300 }],
  ]);

  it("returns every player with the top score", () => {
    expect(getWinners(players).map((p) => p.name)).toEqual(["B", "C"]);
    expect(getWinners(new Map())).toEqual([]);
  });

  it("sorts from the highest score, keeping ties in join order", () => {
    expect(sortByScore(players).map((p) => p.name)).toEqual(["B", "C", "A"]);
  });
});
