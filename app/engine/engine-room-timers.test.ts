import { describe, expect, it } from "vitest";

import { GameSchema } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import longFormData from "~/static/mock-long-form.jep.json";
import mockData from "~/static/mock.jep.json";

import type { Action } from "./engine";
import { ActionType, gameEngine, getWinningBuzzer } from "./engine";
import { applyRoomEventsToState } from "./room-event";
import {
  DEFAULT_ROOM_TIMERS,
  getBuzzWindowMs,
  getNoBuzzMs,
  isReadTimeSec,
} from "./room-timers";
import { GameState, type State, stateFromGame } from "./state";

type TestAction = Omit<Action, "ts"> & { ts?: number };

/** Round 0: (0, 0) a normal $200 question, (2, 1) a Double Down. */
const GAME = {
  ...GameSchema.parse(mockData),
  id: "m",
  visibility: "PUBLIC" as const,
};
/** A single Final question. */
const FINAL_GAME = {
  ...GameSchema.parse(longFormData),
  id: "f",
  visibility: "PUBLIC" as const,
};
const NORMAL: [number, number] = [0, 0];
const DOUBLE_DOWN: [number, number] = [2, 1];

const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };

const join = (p: typeof P1): TestAction => ({
  type: ActionType.Join,
  payload: p,
});
const start: TestAction = {
  type: ActionType.StartRound,
  payload: { round: 0, userId: P1.userId },
};
const BASE_SETTINGS = { answerTimeSec: 0, autoWrongOnTimeout: true };
/** A settings change by the site admin, as the settings route inserts it. */
const timers = (extra: Record<string, unknown>): TestAction => ({
  type: ActionType.SetSettings,
  payload: { userId: "admin", ...BASE_SETTINGS, ...extra, admin: true },
});
const choose = ([i, j]: [number, number], ts = 0): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId: P1.userId, i, j },
  ts,
});
const buzz = (
  userId: string,
  [i, j]: [number, number],
  deltaMs: number,
  ts = 0,
): TestAction => ({
  type: ActionType.Buzz,
  payload: { userId, i, j, deltaMs },
  ts,
});
const wager = (
  userId: string,
  [i, j]: [number, number],
  amount: number,
  ts = 0,
): TestAction => ({
  type: ActionType.SetClueWager,
  payload: { userId, i, j, wager: amount },
  ts,
});
const giveScore = (userId: string, score: number): TestAction => ({
  type: ActionType.AdjustScore,
  payload: { userId, score, admin: true },
});

function run(actions: TestAction[], state: State) {
  return actions.reduce(
    (s, action) => gameEngine(s, { ts: 0, ...action }),
    state,
  );
}

const LOBBY = [join(P1), join(P2)];

function roomTimers(state: State) {
  return {
    readTimeSec: state.readTimeSec,
    buzzWindowSec: state.buzzWindowSec,
    finalAnswerTimeSec: state.finalAnswerTimeSec,
    wagerTimeSec: state.wagerTimeSec,
  };
}

describe("SetSettings (room timers)", () => {
  interface TestCase {
    name: string;
    actions: TestAction[];
    expected: ReturnType<typeof roomTimers>;
  }

  const testCases: TestCase[] = [
    {
      name: "defaults: Auto reading, 5 s buzz window, 30 s Final, no wager limit",
      actions: LOBBY,
      expected: {
        readTimeSec: null,
        buzzWindowSec: 5,
        finalAnswerTimeSec: 30,
        wagerTimeSec: 0,
      },
    },
    {
      name: "the admin sets every timer",
      actions: [
        ...LOBBY,
        timers({
          readTimeSec: 0,
          buzzWindowSec: 3,
          finalAnswerTimeSec: 60,
          wagerTimeSec: 15,
        }),
      ],
      expected: {
        readTimeSec: 0,
        buzzWindowSec: 3,
        finalAnswerTimeSec: 60,
        wagerTimeSec: 15,
      },
    },
    {
      name: "the admin may set them before anyone joined (room creation)",
      actions: [timers({ buzzWindowSec: 10 }), ...LOBBY],
      expected: { ...DEFAULT_ROOM_TIMERS, buzzWindowSec: 10 },
    },
    {
      name: "a fixed reading time of any whole number of seconds up to 60",
      actions: [...LOBBY, timers({ readTimeSec: 7 })],
      expected: { ...DEFAULT_ROOM_TIMERS, readTimeSec: 7 },
    },
    {
      name: "reading time back to Auto (null)",
      actions: [
        ...LOBBY,
        timers({ readTimeSec: 7 }),
        timers({ readTimeSec: null }),
      ],
      expected: DEFAULT_ROOM_TIMERS,
    },
    {
      name: "fields left out keep their value (events from before the timers)",
      actions: [
        ...LOBBY,
        timers({ buzzWindowSec: 7, wagerTimeSec: 30 }),
        timers({ answerTimeSec: 10 }),
      ],
      expected: { ...DEFAULT_ROOM_TIMERS, buzzWindowSec: 7, wagerTimeSec: 30 },
    },
    ...[
      { readTimeSec: 61 },
      { readTimeSec: -1 },
      { readTimeSec: 1.5 },
      { buzzWindowSec: 4 },
      { buzzWindowSec: 0 },
      { finalAnswerTimeSec: 10 },
      { wagerTimeSec: 20 },
      { buzzWindowSec: 3, wagerTimeSec: 5 },
    ].map((bad) => ({
      name: `an invalid value ignores the whole change: ${JSON.stringify(bad)}`,
      actions: [...LOBBY, timers(bad)],
      expected: DEFAULT_ROOM_TIMERS,
    })),
    {
      name: "a non-player without the admin flag can't change them",
      actions: [
        ...LOBBY,
        {
          type: ActionType.SetSettings,
          payload: { userId: "x", ...BASE_SETTINGS, buzzWindowSec: 3 },
        },
      ],
      expected: DEFAULT_ROOM_TIMERS,
    },
    {
      name: "a player's change (solo play, old events) is accepted",
      actions: [
        ...LOBBY,
        {
          type: ActionType.SetSettings,
          payload: { userId: P1.userId, ...BASE_SETTINGS, buzzWindowSec: 3 },
        },
      ],
      expected: { ...DEFAULT_ROOM_TIMERS, buzzWindowSec: 3 },
    },
    {
      name: "ignored while a question is open, accepted again after it",
      actions: [...LOBBY, start, choose(NORMAL), timers({ buzzWindowSec: 3 })],
      expected: DEFAULT_ROOM_TIMERS,
    },
  ];

  it.each(testCases)("$name", ({ actions, expected }) => {
    expect(roomTimers(run(actions, stateFromGame(GAME)))).toEqual(expected);
  });

  it("isReadTimeSec", () => {
    expect([null, 0, 30, 60].every(isReadTimeSec)).toBe(true);
    expect([undefined, -1, 61, 2.5, "5"].some(isReadTimeSec)).toBe(false);
  });
});

describe("buzz window", () => {
  it("a buzz within the room's window wins; the default is 5 s", () => {
    const buzzes = new Map([["1", 4000]]);
    expect(getWinningBuzzer(buzzes, "t")?.userId).toBe("1");
    expect(getWinningBuzzer(buzzes, "t", 3000)).toBeUndefined();
    expect(getWinningBuzzer(new Map([["1", 3000]]), "t", 3000)?.userId).toBe(
      "1",
    );
  });

  it("getBuzzWindowMs / getNoBuzzMs follow the state", () => {
    expect(getBuzzWindowMs(stateFromGame(GAME))).toBe(5000);
    expect(getNoBuzzMs(stateFromGame(GAME))).toBe(5001);
    expect(getBuzzWindowMs({ buzzWindowSec: 3 })).toBe(3000);
    expect(getNoBuzzMs({ buzzWindowSec: 20 })).toBe(20001);
    // Old saved states without the field.
    expect(getBuzzWindowMs({})).toBe(5000);
  });

  interface BuzzCase {
    name: string;
    settings: TestAction[];
    deltaMs: number;
    expectedType: GameState;
  }
  const cases: BuzzCase[] = [
    {
      name: "4 s counts with the default 5 s window",
      settings: [],
      deltaMs: 4000,
      expectedType: GameState.RevealAnswerToBuzzer,
    },
    {
      name: "4 s is too late with a 3 s window",
      settings: [timers({ buzzWindowSec: 3 })],
      deltaMs: 4000,
      expectedType: GameState.RevealAnswerToAll,
    },
    {
      name: "the old 5 s timeout (5001) is a valid buzz with a 10 s window",
      settings: [timers({ buzzWindowSec: 10 })],
      deltaMs: 5001,
      expectedType: GameState.RevealAnswerToBuzzer,
    },
    {
      name: "a 20 s window's timeout (20001) is no buzz",
      settings: [timers({ buzzWindowSec: 20 })],
      deltaMs: 20001,
      expectedType: GameState.RevealAnswerToAll,
    },
  ];

  it.each(cases)("$name", ({ settings, deltaMs, expectedType }) => {
    const state = run(
      [
        ...LOBBY,
        ...settings,
        start,
        choose(NORMAL),
        buzz(P1.userId, NORMAL, deltaMs),
        buzz(P2.userId, NORMAL, 999_999),
      ],
      stateFromGame(GAME),
    );
    expect(state.type).toBe(expectedType);
  });

  it("the window applies to checking the buzz winner too", () => {
    const state = run(
      [
        ...LOBBY,
        timers({ buzzWindowSec: 10 }),
        start,
        choose(NORMAL),
        buzz(P1.userId, NORMAL, 8000),
        buzz(P2.userId, NORMAL, 10_001),
        {
          type: ActionType.Check,
          payload: { userId: P1.userId, i: 0, j: 0, correct: true },
        },
      ],
      stateFromGame(GAME),
    );
    expect(state.type).toBe(GameState.RevealAnswerToAll);
    expect(state.players.get(P1.userId)?.score).toBe(200);
  });

  it("replaying room events is deterministic (window from the settings event)", () => {
    const events: DbRoomEvent[] = [
      ...LOBBY,
      timers({ buzzWindowSec: 3 }),
      start,
      choose(NORMAL),
      buzz(P1.userId, NORMAL, 4000),
      buzz(P2.userId, NORMAL, 3001),
    ].map((a, id) => ({
      id,
      room_id: 1,
      ts: new Date(1_000 * (id + 1)).toISOString(),
      type: a.type,
      payload: a.payload as DbRoomEvent["payload"],
    }));
    const a = applyRoomEventsToState(stateFromGame(GAME), events);
    const b = applyRoomEventsToState(stateFromGame(GAME), events);
    expect(a.type).toBe(GameState.RevealAnswerToAll);
    expect(roomTimers(a)).toEqual(roomTimers(b));
    expect(a.buzzWindowSec).toBe(3);
  });

  it("replaying old events (no timers) keeps today's behaviour", () => {
    const events: DbRoomEvent[] = [
      ...LOBBY,
      {
        type: ActionType.SetSettings,
        payload: {
          userId: P1.userId,
          answerTimeSec: 10,
          autoWrongOnTimeout: true,
        },
      },
      start,
      choose(NORMAL),
      buzz(P1.userId, NORMAL, 4900),
      buzz(P2.userId, NORMAL, 5001),
    ].map((a, id) => ({
      id,
      room_id: 1,
      ts: new Date(1_000 * (id + 1)).toISOString(),
      type: a.type,
      payload: a.payload as DbRoomEvent["payload"],
    }));
    const state = applyRoomEventsToState(stateFromGame(GAME), events);
    expect(roomTimers(state)).toEqual(DEFAULT_ROOM_TIMERS);
    expect(state.answerTimeSec).toBe(10);
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
  });
});

describe("wager and Final answer turn starts", () => {
  it("records when the Double Down wager starts and clears it after", () => {
    const wagering = run(
      [...LOBBY, start, choose(DOUBLE_DOWN, 1234)],
      stateFromGame(GAME),
    );
    expect(wagering.type).toBe(GameState.WagerClue);
    expect(wagering.wagerStartedAt).toBe(1234);

    const reading = gameEngine(wagering, {
      type: ActionType.SetClueWager,
      payload: { userId: P1.userId, i: 2, j: 1, wager: 5 },
      ts: 2000,
    });
    expect(reading.type).toBe(GameState.ReadWagerableClue);
    expect(reading.wagerStartedAt).toBeNull();
  });

  it("records when the Final answers start (after the last wager)", () => {
    const state = run(
      [
        ...LOBBY,
        giveScore(P1.userId, 500),
        giveScore(P2.userId, 300),
        start,
        choose([0, 0], 1000),
      ],
      stateFromGame(FINAL_GAME),
    );
    expect(state.type).toBe(GameState.WagerClue);
    expect(state.wagerStartedAt).toBe(1000);
    expect(state.longFormStartedAt).toBeNull();

    const one = gameEngine(state, {
      type: ActionType.SetClueWager,
      payload: { userId: P1.userId, i: 0, j: 0, wager: 0 },
      ts: 2000,
    });
    expect(one.longFormStartedAt).toBeNull();
    expect(one.wagerStartedAt).toBe(1000);
    const all = run([wager(P2.userId, [0, 0], 0, 3000)], one);
    expect(all.type).toBe(GameState.ReadLongFormClue);
    expect(all.longFormStartedAt).toBe(3000);
    expect(all.wagerStartedAt).toBeNull();
  });

  it("the minimum wager (the timeout's) is accepted: $0 Final, $5 Double Down", () => {
    const final = run(
      [
        ...LOBBY,
        giveScore(P1.userId, 500),
        start,
        choose([0, 0]),
        wager(P1.userId, [0, 0], 0),
      ],
      stateFromGame(FINAL_GAME),
    );
    expect(final.type).toBe(GameState.ReadLongFormClue);

    const dd = run(
      [...LOBBY, start, choose(DOUBLE_DOWN), wager(P1.userId, DOUBLE_DOWN, 5)],
      stateFromGame(GAME),
    );
    expect(dd.type).toBe(GameState.ReadWagerableClue);
    expect(dd.wagers.get("0,2,1")?.get(P1.userId)).toBe(5);
  });

  it("a Final nobody can wager on starts its answer time at once", () => {
    const state = run(
      [...LOBBY, start, choose([0, 0], 4321)],
      stateFromGame(FINAL_GAME),
    );
    expect(state.type).toBe(GameState.ReadLongFormClue);
    expect(state.longFormStartedAt).toBe(4321);
  });
});
