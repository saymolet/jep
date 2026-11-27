import { describe, expect, it } from "vitest";

import { MOCK_GAME } from "~/models/mock.server";

import type { Action } from "./engine";
import { ActionType, CANT_BUZZ_FLAG, gameEngine } from "./engine";
import { getScoreChanges } from "./standings";
import { GameState, type State, stateFromGame } from "./state";

/* Feature 27: the buzzers open and close on the server's signal (from the
 * room's opener device), and the host's ×0.5 / ×2. */

type TestAction = Omit<Action, "ts"> & { ts?: number };

const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };
const P3 = { userId: "3", name: "Player 3" };
const HOST = { userId: "h", name: "Host" };

function run(actions: TestAction[], state: State = stateFromGame(MOCK_GAME)) {
  return actions.reduce(
    (s, action, k) => gameEngine(s, { ts: k + 1, ...action }),
    state,
  );
}

const join = (p: { userId: string; name: string }): TestAction => ({
  type: ActionType.Join,
  payload: p,
});
const start = (userId = P1.userId): TestAction => ({
  type: ActionType.StartRound,
  payload: { round: 0, userId },
});
const choose = (i: number, j: number, userId = P1.userId): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId, i, j },
});
const buzz = (userId: string, deltaMs: number): TestAction => ({
  type: ActionType.Buzz,
  payload: { userId, i: 0, j: 0, deltaMs },
});
const control = (
  type: ActionType.OpenBuzzers | ActionType.CloseBuzzers,
  userId: string,
  extra: object = {},
): TestAction => ({
  type,
  payload: { userId, round: 0, i: 0, j: 0, ...extra },
});
const open = (userId = P1.userId, extra: object = {}) =>
  control(ActionType.OpenBuzzers, userId, extra);
const close = (userId = P1.userId, extra: object = {}) =>
  control(ActionType.CloseBuzzers, userId, extra);

const THREE_READING = [join(P1), join(P2), join(P3), start(), choose(0, 0)];

describe("opening the buzzers", () => {
  it("a player opens them; a stranger can't", () => {
    expect(run([...THREE_READING]).buzzersOpen).toBe(false);
    expect(run([...THREE_READING, open("stranger")]).buzzersOpen).toBe(false);
    expect(run([...THREE_READING, open()]).buzzersOpen).toBe(true);
  });

  it("in host mode only the host (tagged by the server) or the admin", () => {
    const hosted = [
      join(P1),
      join(P2),
      { type: ActionType.ClaimHost, payload: HOST },
      start(HOST.userId),
      choose(0, 0, HOST.userId),
    ];
    expect(run([...hosted, open(P1.userId)]).buzzersOpen).toBe(false);
    expect(run([...hosted, open(HOST.userId)]).buzzersOpen).toBe(false);
    expect(
      run([...hosted, open(HOST.userId, { host: true })]).buzzersOpen,
    ).toBe(true);
    expect(run([...hosted, open("admin", { admin: true })]).buzzersOpen).toBe(
      true,
    );
  });

  it("closes again for the re-read after a wrong answer", () => {
    const state = run([
      ...THREE_READING,
      open(),
      buzz(P1.userId, 100),
      buzz(P2.userId, 5001),
      buzz(P3.userId, 5001),
      {
        type: ActionType.Check,
        payload: { userId: P1.userId, i: 0, j: 0, correct: false },
      },
    ]);
    expect(state.type).toBe(GameState.ReadClue);
    expect(state.buzzes.get(P1.userId)).toBe(CANT_BUZZ_FLAG);
    expect(state.buzzersOpen).toBe(false);
  });
});

describe("closing the buzzers (the question's timer, not the people)", () => {
  it("whoever hasn't reported didn't buzz; the buzz winner answers", () => {
    const state = run([
      ...THREE_READING,
      open(),
      buzz(P2.userId, 300),
      close(),
    ]);
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
    expect(state.buzzes.get(P1.userId)).toBeGreaterThan(5000);
    expect(state.buzzes.get(P3.userId)).toBeGreaterThan(5000);
  });

  it("nobody buzzed: the answer is shown to everyone", () => {
    const state = run([...THREE_READING, open(), close()]);
    expect(state.type).toBe(GameState.RevealAnswerToAll);
    expect(state.isAnswered[0][0][0].isAnswered).toBe(true);
  });

  it("is ignored before the buzzers opened, or for another question", () => {
    expect(run([...THREE_READING, close()]).type).toBe(GameState.ReadClue);
    const other = run([
      ...THREE_READING,
      open(),
      {
        type: ActionType.CloseBuzzers,
        payload: { userId: P1.userId, round: 0, i: 1, j: 0 },
      },
    ]);
    expect(other.type).toBe(GameState.ReadClue);
  });
});

describe("the host's ×0.5 / ×2", () => {
  const answering = [
    join(P1),
    join(P2),
    { type: ActionType.ClaimHost, payload: HOST },
    start(HOST.userId),
    choose(0, 0, HOST.userId),
    open(HOST.userId, { host: true }),
    buzz(P1.userId, 100),
    buzz(P2.userId, 5001),
  ];
  const judge = (extra: object): TestAction => ({
    type: ActionType.Check,
    payload: {
      userId: P1.userId,
      i: 0,
      j: 0,
      correct: true,
      host: true,
      ...extra,
    },
  });
  const value = MOCK_GAME.boards[0].categories[0].clues[0].value;

  it("doubles or halves a right answer, and the score change shows it", () => {
    const doubled = run([...answering, judge({ multiplier: 2 })]);
    expect(doubled.players.get(P1.userId)?.score).toBe(value * 2);
    expect(getScoreChanges(doubled).get(P1.userId)).toBe(value * 2);
    const halved = run([...answering, judge({ multiplier: 0.5 })]);
    expect(halved.players.get(P1.userId)?.score).toBe(Math.round(value / 2));
  });

  it("is ignored on a player's own check", () => {
    const state = run([
      join(P1),
      join(P2),
      start(),
      choose(0, 0),
      open(),
      buzz(P1.userId, 100),
      buzz(P2.userId, 5001),
      {
        type: ActionType.Check,
        payload: {
          userId: P1.userId,
          i: 0,
          j: 0,
          correct: true,
          multiplier: 2,
        },
      },
    ]);
    expect(state.players.get(P1.userId)?.score).toBe(value);
  });
});

describe("answerMultiplier in the engine context (feature 29)", () => {
  it("is what the summary after the question uses", async () => {
    const { stateToGameEngine, ConnectionState } =
      await import("./use-game-engine");
    const state = run([
      join(P1),
      join(P2),
      { type: ActionType.ClaimHost, payload: HOST },
      start(HOST.userId),
      choose(0, 0, HOST.userId),
      open(HOST.userId, { host: true }),
      buzz(P1.userId, 100),
      buzz(P2.userId, 5001),
      {
        type: ActionType.Check,
        payload: {
          userId: P1.userId,
          i: 0,
          j: 0,
          correct: true,
          host: true,
          multiplier: 2,
        },
      },
    ]);
    const engine = stateToGameEngine(MOCK_GAME, state, () => undefined, {
      connectionState: ConnectionState.CONNECTED,
    });
    expect(engine.answerMultiplier(0, 0, P1.userId)).toBe(2);
    expect(engine.answerMultiplier(0, 0, P2.userId)).toBe(1);
  });
});
