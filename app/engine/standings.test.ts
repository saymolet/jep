import { describe, expect, it } from "vitest";

import {
  ANN,
  BOB,
  play,
  playUntil,
  STEPS,
} from "~/components/watch/fixtures.test-helpers";

import { ActionType, CLUE_TIMEOUT_MS } from "./engine";
import {
  getLastScoredClue,
  getScoreChanges,
  getStandings,
  rankByScore,
  scoreChangesKey,
} from "./standings";
import type { Player, State } from "./state";

const changesOf = (state: State) => Object.fromEntries(getScoreChanges(state));

describe("getScoreChanges", () => {
  it("is empty before any question was scored", () => {
    expect(changesOf(playUntil("start"))).toEqual({});
    expect(changesOf(playUntil("buzzFirst"))).toEqual({});
    expect(getLastScoredClue(playUntil("buzzFirst"))).toBeNull();
  });

  it("is the last question's points for whoever was checked", () => {
    expect(changesOf(playUntil("checkFirst"))).toEqual({ [ANN]: 200 });
    // Still the same question once back on the board.
    const onBoard = playUntil("nextFirst");
    expect(changesOf(onBoard)).toEqual({ [ANN]: 200 });
    expect(getLastScoredClue(onBoard)).toEqual({ round: 0, i: 0, j: 0 });
  });

  it("uses the wager on wagerable questions and the secret value", () => {
    expect(changesOf(playUntil("finishWager"))).toEqual({ [ANN]: 150 });
    expect(changesOf(playUntil("finishSecret"))).toEqual({ [BOB]: 500 });
  });

  it("is about the open question once someone was checked on it", () => {
    const wrong = play(STEPS.join, STEPS.start, STEPS.chooseFirst, [
      {
        type: ActionType.Buzz,
        payload: { userId: ANN, i: 0, j: 0, deltaMs: 100 },
      },
      {
        type: ActionType.Buzz,
        payload: { userId: BOB, i: 0, j: 0, deltaMs: CLUE_TIMEOUT_MS + 1 },
      },
      {
        type: ActionType.Check,
        payload: { userId: ANN, i: 0, j: 0, correct: false },
      },
    ]);
    expect(changesOf(wrong)).toEqual({ [ANN]: -200 });
    expect(wrong.players.get(ANN)?.score).toBe(-200);

    const thenRight = play(
      STEPS.join,
      STEPS.start,
      STEPS.chooseFirst,
      [
        {
          type: ActionType.Buzz,
          payload: { userId: ANN, i: 0, j: 0, deltaMs: 100 },
        },
        {
          type: ActionType.Buzz,
          payload: { userId: BOB, i: 0, j: 0, deltaMs: CLUE_TIMEOUT_MS + 1 },
        },
        {
          type: ActionType.Check,
          payload: { userId: ANN, i: 0, j: 0, correct: false },
        },
      ],
      [
        {
          type: ActionType.Buzz,
          payload: { userId: BOB, i: 0, j: 0, deltaMs: 50 },
        },
        {
          type: ActionType.Check,
          payload: { userId: BOB, i: 0, j: 0, correct: true },
        },
      ],
    );
    expect(changesOf(thenRight)).toEqual({ [ANN]: -200, [BOB]: 200 });
  });

  it("shows the previous question while a new one is open but unscored", () => {
    // Choosing the next question doesn't reset the changes.
    expect(changesOf(playUntil("chooseWager"))).toEqual({ [ANN]: 200 });
  });

  it("follows a check correction", () => {
    const corrected = play(
      STEPS.join,
      STEPS.start,
      STEPS.chooseFirst,
      STEPS.buzzFirst,
      STEPS.checkFirst,
      [
        {
          type: ActionType.CorrectCheck,
          payload: { round: 0, userId: ANN, i: 0, j: 0, correct: false },
        },
      ],
    );
    expect(corrected.players.get(ANN)?.score).toBe(-200);
    expect(changesOf(corrected)).toEqual({ [ANN]: -200 });
  });

  it("covers Final: each player's wager, gained or lost", () => {
    const final = playUntil("checkFinal");
    expect(changesOf(final)).toEqual({ [ANN]: 100, [BOB]: 0 });
    // The change explains the score: score before = score - change.
    for (const p of final.players.values()) {
      const change = getScoreChanges(final).get(p.userId) ?? 0;
      expect(p.score - change).toBe(
        playUntil("finishChoice").players.get(p.userId)!.score,
      );
    }
  });

  it("has a key that changes with each scored question", () => {
    const a = playUntil("checkFirst");
    const b = playUntil("finishWager");
    expect(
      scoreChangesKey(playUntil("start"), getScoreChanges(playUntil("start"))),
    ).toBe("");
    expect(scoreChangesKey(a, getScoreChanges(a))).not.toBe(
      scoreChangesKey(b, getScoreChanges(b)),
    );
    const aBoard = playUntil("nextFirst");
    expect(scoreChangesKey(aBoard, getScoreChanges(aBoard))).toBe(
      scoreChangesKey(a, getScoreChanges(a)),
    );
  });
});

describe("rankByScore", () => {
  it("gives ties the same rank and skips the next ranks", () => {
    const ranked = rankByScore(
      [
        { id: "a", s: 100 },
        { id: "b", s: 300 },
        { id: "c", s: 100 },
        { id: "d", s: -50 },
        { id: "e", s: 300 },
        { id: "f", s: 0 },
      ],
      (x) => x.s,
    );
    expect(ranked.map(({ item, rank }) => `${rank}${item.id}`)).toEqual([
      "1b",
      "1e",
      "3a",
      "3c",
      "5f",
      "6d",
    ]);
  });

  it("handles no items and all-negative scores", () => {
    expect(rankByScore([], () => 0)).toEqual([]);
    expect(
      rankByScore([-400, -200, -200], (x) => x).map((r) => r.rank),
    ).toEqual([1, 1, 3]);
  });
});

function player(userId: string, score: number, team?: Player["team"]): Player {
  return {
    userId,
    name: userId.toUpperCase(),
    score,
    ...(team ? { team } : {}),
  };
}

describe("getStandings", () => {
  it("ranks players with their change and board control", () => {
    const standings = getStandings({
      players: new Map([
        ["a", player("a", 200)],
        ["b", player("b", 600)],
        ["c", player("c", 200)],
      ]),
      leftPlayers: new Map(),
      teamNames: new Map(),
      boardControl: "c",
      scoreChanges: new Map([
        ["b", 400],
        ["a", -200],
      ]),
    });
    expect(standings.teams).toBeNull();
    expect(
      standings.players.map((s) => [
        s.player.userId,
        s.rank,
        s.change,
        s.hasBoardControl,
      ]),
    ).toEqual([
      ["b", 1, 400, false],
      ["a", 2, -200, false],
      ["c", 2, 0, true],
    ]);
  });

  it("ranks teams with totals and changes; leavers count for their team only", () => {
    const standings = getStandings({
      players: new Map([
        ["a", player("a", 200, "red")],
        ["b", player("b", 500, "blue")],
        ["c", player("c", -100, "red")],
        ["d", player("d", 50)],
      ]),
      leftPlayers: new Map([["l", player("l", 400, "red")]]),
      teamNames: new Map([["red", "Foxes"]]),
      boardControl: null,
      scoreChanges: new Map([
        ["a", 200],
        ["l", -100],
        ["b", 300],
      ]),
    });
    // The leaver isn't listed as a player...
    expect(standings.players.map((s) => s.player.userId)).toEqual([
      "b",
      "a",
      "d",
      "c",
    ]);
    // ...but their score and change count for their team.
    expect(standings.teams).toEqual([
      {
        team: "red",
        name: "Foxes",
        rank: 1,
        score: 500,
        change: 100,
        members: [
          expect.objectContaining({ userId: "a" }),
          expect.objectContaining({ userId: "c" }),
        ],
      },
      {
        team: "blue",
        rank: 1,
        score: 500,
        change: 300,
        members: [expect.objectContaining({ userId: "b" })],
      },
    ]);
  });
});
