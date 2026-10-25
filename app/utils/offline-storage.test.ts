import { describe, expect, it } from "vitest";

import { GameState, type Player, stateFromGame } from "~/engine/state";
import { MOCK_GAME, getMockGame } from "~/models/mock.server";

import { deserializeState, serializeState } from "./offline-storage";

describe("serializeState / deserializeState", () => {
  it("round-trips initial empty state", () => {
    const state = stateFromGame(MOCK_GAME);
    const serialized = serializeState(state);
    const result = deserializeState(serialized, MOCK_GAME);

    expect(result.type).toBe(GameState.PreviewRound);
    expect(result.round).toBe(0);
    expect(result.numAnswered).toBe(0);
    expect(result.players.size).toBe(0);
    expect(result.answers.size).toBe(0);
    expect(result.wagers.size).toBe(0);
    expect(result.buzzes.size).toBe(0);
    expect(result.activeClue).toBeNull();
    expect(result.game).toBe(MOCK_GAME);
  });

  it("round-trips state with players, answers, wagers, and buzzes", () => {
    const state = stateFromGame(MOCK_GAME);

    const player: Player = { userId: "user1", name: "🎮", score: 1000 };
    state.players.set("user1", player);
    state.answers.set("0,0,0", new Map([["user1", "What is b?"]]));
    state.wagers.set("0,0,0", new Map([["user1", 500]]));
    state.buzzes.set("user1", 12345);

    const result = deserializeState(serializeState(state), MOCK_GAME);

    expect(result.players.get("user1")).toEqual(player);
    expect(result.answers.get("0,0,0")?.get("user1")).toBe("What is b?");
    expect(result.wagers.get("0,0,0")?.get("user1")).toBe(500);
    expect(result.buzzes.get("user1")).toBe(12345);
  });

  it("round-trips multiple choice picks", () => {
    const state = stateFromGame(MOCK_GAME);
    state.choicePicks.set("0,0,0", new Map([["user1", 2]]));
    const result = deserializeState(serializeState(state), MOCK_GAME);
    expect(result.choicePicks.get("0,0,0")?.get("user1")).toBe(2);
  });

  it("restores saves from before multiple choice without picks", () => {
    const old = serializeState(stateFromGame(MOCK_GAME));
    delete old.choicePicks;
    const result = deserializeState(old, MOCK_GAME);
    expect(result.choicePicks).toStrictEqual(new Map());
  });

  it("preserves nested Maps with multiple entries", () => {
    const state = stateFromGame(MOCK_GAME);
    state.answers.set(
      "0,0,0",
      new Map([
        ["user1", "answer A"],
        ["user2", "answer B"],
      ]),
    );
    state.answers.set("0,0,1", new Map([["user1", "answer C"]]));

    const result = deserializeState(serializeState(state), MOCK_GAME);

    expect(result.answers.size).toBe(2);
    expect(result.answers.get("0,0,0")?.size).toBe(2);
    expect(result.answers.get("0,0,0")?.get("user2")).toBe("answer B");
    expect(result.answers.get("0,0,1")?.get("user1")).toBe("answer C");
  });

  it("preserves ClueAnswer.answeredBy Map", () => {
    const state = stateFromGame(MOCK_GAME);
    state.isAnswered[0][0][0] = {
      isAnswered: true,
      answeredBy: new Map([
        ["user1", true],
        ["user2", false],
      ]),
      answerOrder: 1,
    };

    const result = deserializeState(serializeState(state), MOCK_GAME);

    const cell = result.isAnswered[0][0][0];
    expect(cell.isAnswered).toBe(true);
    expect(cell.answerOrder).toBe(1);
    expect(cell.answeredBy).toBeInstanceOf(Map);
    expect(cell.answeredBy.get("user1")).toBe(true);
    expect(cell.answeredBy.get("user2")).toBe(false);
  });

  it("resets clock and paused state on deserialization", () => {
    const state = stateFromGame(MOCK_GAME);
    Object.assign(state, {
      clockRunning: true,
      clockAccumulatedMs: 5000,
      clockLastResumedAt: Date.now(),
      isPaused: true,
    });

    const serialized = serializeState(state);
    expect(serialized.clockRunning).toBe(true);
    expect(serialized.isPaused).toBe(true);

    const result = deserializeState(serialized, MOCK_GAME);
    expect(result.clockRunning).toBe(false);
    expect(result.clockLastResumedAt).toBeNull();
    expect(result.clockAccumulatedMs).toBe(5000);
    // Never restore into a paused state — resume fresh on reload.
    expect(result.isPaused).toBe(false);
  });

  it("preserves check-correction metadata", () => {
    const state = stateFromGame(MOCK_GAME);
    Object.assign(state, {
      checkCorrection: {
        round: 0,
        i: 0,
        j: 0,
        boardControlBefore: "user1",
        checks: new Map([
          ["user1", false],
          ["user2", true],
        ]),
      },
    });

    const result = deserializeState(serializeState(state), MOCK_GAME);

    expect(result.checkCorrection).toEqual({
      round: 0,
      i: 0,
      j: 0,
      boardControlBefore: "user1",
      checks: new Map([
        ["user1", false],
        ["user2", true],
      ]),
    });
  });

  it("preserves activeClue tuple", () => {
    const state = stateFromGame(MOCK_GAME);
    Object.assign(state, { activeClue: [1, 0] });

    const result = deserializeState(serializeState(state), MOCK_GAME);
    expect(result.activeClue).toEqual([1, 0]);
  });

  it("uses game parameter for game reference", () => {
    const state = stateFromGame(MOCK_GAME);
    const otherGame = { ...MOCK_GAME, title: "Other" };

    const serialized = serializeState(state);
    const result = deserializeState(serialized, otherGame);

    expect(result.game).toBe(otherGame);
    expect(result.game.title).toBe("Other");
  });

  it("fills out a grid saved before uneven boards were supported", async () => {
    // Short (3) / Full (5) / Middle (4): old saves sized the grid from the
    // first category, so rows 3 and 4 were missing.
    const game = await getMockGame("ragged");
    const state = stateFromGame(game);
    state.isAnswered[0][2][0].isAnswered = true;
    state.isAnswered[0][2][0].answerOrder = 1;
    const old = serializeState(state);
    old.isAnswered[0] = old.isAnswered[0].slice(0, 3);

    const result = deserializeState(old, game);

    expect(result.isAnswered[0]).toHaveLength(5);
    expect(result.isAnswered[0][4][1].isAnswered).toBe(false);
    expect(result.isAnswered[0][2][0].isAnswered).toBe(true);
    expect(result.isAnswered[0][2][0].answerOrder).toBe(1);
    expect(result.isAnswered[1]).toHaveLength(2);
  });
});
