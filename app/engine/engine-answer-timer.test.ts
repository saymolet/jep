import { describe, expect, it } from "vitest";

import { GameSchema } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import choiceData from "~/static/mock-choice.jep.json";
import secretData from "~/static/mock-secret.jep.json";

import { getAnswerTimerStatus, isAnswerTimeSec } from "./answer-timer";
import type { Action } from "./engine";
import { ActionType, CLUE_TIMEOUT_MS, gameEngine } from "./engine";
import { applyRoomEventsToState } from "./room-event";
import { GameState, type State, stateFromGame } from "./state";

type TestAction = Omit<Action, "ts"> & { ts?: number };

/** Board 0 of the multiple choice sample game:
 * - (0, 0) "Capitals" $200, choices Sydney / Canberra (correct, 1) / ...
 * - (0, 1) "Mixed Bag" $200, a normal question without choices
 */
const CHOICE_GAME = {
  ...GameSchema.parse(choiceData),
  id: "c",
  visibility: "PUBLIC" as const,
};
/** Board 0 of the secret sample game: (1, 0) is a secret question worth
 * $500. */
const SECRET_GAME = {
  ...GameSchema.parse(secretData),
  id: "s",
  visibility: "PUBLIC" as const,
};
const MC: [number, number] = [0, 0];
const NORMAL: [number, number] = [0, 1];
const SECRET: [number, number] = [1, 0];

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
const settings = (
  userId: string,
  answerTimeSec: unknown,
  autoWrongOnTimeout: unknown = true,
): TestAction => ({
  type: ActionType.SetSettings,
  payload: { userId, answerTimeSec, autoWrongOnTimeout },
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
const check = (
  userId: string,
  [i, j]: [number, number],
  extra: Record<string, unknown>,
  ts = 0,
): TestAction => ({
  type: ActionType.Check,
  payload: { userId, i, j, ...extra },
  ts,
});
const next = ([i, j]: [number, number]): TestAction => ({
  type: ActionType.NextClue,
  payload: { userId: P1.userId, i, j },
});
const pause: TestAction = { type: ActionType.TogglePause };

function run(actions: TestAction[], state: State) {
  return actions.reduce(
    (s, action) => gameEngine(s, { ts: 0, ...action }),
    state,
  );
}

const choiceState = stateFromGame(CHOICE_GAME);
const LOBBY = [join(P1), join(P2)];

function timer(state: State) {
  return {
    answerTimeSec: state.answerTimeSec,
    autoWrongOnTimeout: state.autoWrongOnTimeout,
  };
}

describe("SetSettings (answer timer)", () => {
  interface TestCase {
    name: string;
    actions: TestAction[];
    expected: ReturnType<typeof timer>;
  }

  const testCases: TestCase[] = [
    {
      name: "the timer is off by default, auto-mark on",
      actions: LOBBY,
      expected: { answerTimeSec: 0, autoWrongOnTimeout: true },
    },
    {
      name: "a player turns the timer on in the lobby",
      actions: [...LOBBY, settings(P2.userId, 10, true)],
      expected: { answerTimeSec: 10, autoWrongOnTimeout: true },
    },
    {
      name: "the last change wins",
      actions: [
        ...LOBBY,
        settings(P1.userId, 10, true),
        settings(P2.userId, 30, false),
      ],
      expected: { answerTimeSec: 30, autoWrongOnTimeout: false },
    },
    {
      name: "the timer can be turned off again",
      actions: [...LOBBY, settings(P1.userId, 60), settings(P1.userId, 0)],
      expected: { answerTimeSec: 0, autoWrongOnTimeout: true },
    },
    {
      name: "values that are not offered are ignored",
      actions: [
        ...LOBBY,
        settings(P1.userId, 20),
        settings(P1.userId, 7),
        settings(P1.userId, -10),
        settings(P1.userId, 10.5),
        settings(P1.userId, 3600),
      ],
      expected: { answerTimeSec: 20, autoWrongOnTimeout: true },
    },
    {
      name: "someone who is not playing can't change the settings",
      actions: [...LOBBY, settings("spectator", 10)],
      expected: { answerTimeSec: 0, autoWrongOnTimeout: true },
    },
    {
      name: "the settings can change on the board between questions",
      actions: [...LOBBY, start, settings(P2.userId, 15, false)],
      expected: { answerTimeSec: 15, autoWrongOnTimeout: false },
    },
    {
      name: "the settings can change while paused",
      actions: [...LOBBY, start, pause, settings(P2.userId, 15)],
      expected: { answerTimeSec: 15, autoWrongOnTimeout: true },
    },
    {
      name: "the settings can't change while a question is open",
      actions: [
        ...LOBBY,
        start,
        settings(P1.userId, 10),
        choose(NORMAL),
        settings(P2.userId, 60, false),
      ],
      expected: { answerTimeSec: 10, autoWrongOnTimeout: true },
    },
    {
      name: "the settings can change again once the question is over",
      actions: [
        ...LOBBY,
        start,
        choose(NORMAL),
        buzz(P1.userId, NORMAL, 100),
        buzz(P2.userId, NORMAL, CLUE_TIMEOUT_MS + 1),
        settings(P2.userId, 60),
        check(P1.userId, NORMAL, { correct: true }),
        settings(P2.userId, 60),
        next(NORMAL),
        settings(P2.userId, 30),
      ],
      expected: { answerTimeSec: 30, autoWrongOnTimeout: true },
    },
  ];

  for (const tc of testCases) {
    it(tc.name, () => {
      expect(timer(run(tc.actions, choiceState))).toEqual(tc.expected);
    });
  }

  it("rejects a malformed payload", () => {
    const state = run(LOBBY, choiceState);
    expect(() =>
      gameEngine(state, {
        type: ActionType.SetSettings,
        payload: { userId: P1.userId, answerTimeSec: "10" },
        ts: 0,
      }),
    ).toThrow();
  });

  it("replays the same from room events", () => {
    const events: DbRoomEvent[] = [
      [ActionType.Join, P1],
      [ActionType.Join, P2],
      [
        ActionType.SetSettings,
        { userId: P1.userId, answerTimeSec: 20, autoWrongOnTimeout: false },
      ],
      [
        ActionType.SetSettings,
        { userId: P2.userId, answerTimeSec: 99, autoWrongOnTimeout: true },
      ],
    ].map(([type, payload], k) => ({
      id: k + 1,
      room_id: 1,
      ts: `2026-10-26T10:00:0${k + 1}`,
      type: type as string,
      payload: payload as DbRoomEvent["payload"],
    }));
    const replayed = applyRoomEventsToState(stateFromGame(CHOICE_GAME), events);
    expect(timer(replayed)).toEqual({
      answerTimeSec: 20,
      autoWrongOnTimeout: false,
    });
  });
});

describe("answer turn start (answerStartedAt)", () => {
  const TIMED = [...LOBBY, settings(P1.userId, 10), start];

  it("is the time of the buzz that decided the winner", () => {
    const state = run(
      [
        ...TIMED,
        choose(NORMAL, 1000),
        buzz(P1.userId, NORMAL, 100, 5000),
        buzz(P2.userId, NORMAL, CLUE_TIMEOUT_MS + 1, 9000),
      ],
      choiceState,
    );
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
    expect(state.answerStartedAt).toBe(9000);
  });

  it("is reset when the player marks, and restarts for the next winner", () => {
    const afterWrong = run(
      [
        ...TIMED,
        choose(NORMAL),
        buzz(P1.userId, NORMAL, 100, 5000),
        buzz(P2.userId, NORMAL, 300, 5100),
        check(P1.userId, NORMAL, { correct: false }, 8000),
      ],
      choiceState,
    );
    expect(afterWrong.type).toBe(GameState.ReadClue);
    expect(afterWrong.answerStartedAt).toBeNull();

    const secondTurn = run([buzz(P2.userId, NORMAL, 200, 12_000)], afterWrong);
    expect(secondTurn.type).toBe(GameState.RevealAnswerToBuzzer);
    expect(secondTurn.answerStartedAt).toBe(12_000);
  });

  it("is when a secret question is passed to its receiver", () => {
    const state = run(
      [
        join(P1),
        join(P2),
        settings(P1.userId, 10),
        start,
        choose(SECRET, 1000),
        {
          type: ActionType.PassClue,
          payload: {
            userId: P1.userId,
            i: SECRET[0],
            j: SECRET[1],
            toUserId: P2.userId,
          },
          ts: 4000,
        },
      ],
      stateFromGame(SECRET_GAME),
    );
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
    expect(state.answerStartedAt).toBe(4000);
  });

  it("is when a solo player chooses a secret question", () => {
    const state = run(
      [join(P1), start, choose(SECRET, 2500)],
      stateFromGame(SECRET_GAME),
    );
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
    expect(state.answerStartedAt).toBe(2500);
  });
});

describe("multiple choice timeout", () => {
  const P1_WINS_MC = (answerTimeSec: number) => [
    ...LOBBY,
    settings(P1.userId, answerTimeSec),
    start,
    choose(MC),
    buzz(P1.userId, MC, 100),
    buzz(P2.userId, MC, 300),
  ];

  it("marks the answer wrong with no pick when the time ran out", () => {
    const state = run(
      [
        ...P1_WINS_MC(10),
        check(P1.userId, MC, { correct: false, timedOut: true }),
      ],
      choiceState,
    );
    expect(state.players.get(P1.userId)?.score).toBe(-200);
    // Not a pick: the option list shows nothing for P1.
    expect(state.choicePicks.get(`0,${MC[0]},${MC[1]}`)).toBeUndefined();
    // P2 can still buzz.
    expect(state.type).toBe(GameState.ReadClue);
  });

  it("is always wrong, even if the event claims correct", () => {
    const state = run(
      [
        ...P1_WINS_MC(10),
        check(P1.userId, MC, { correct: true, timedOut: true }),
      ],
      choiceState,
    );
    expect(state.players.get(P1.userId)?.score).toBe(-200);
  });

  it("is ignored when the timer is off", () => {
    const state = run(
      [
        ...P1_WINS_MC(0),
        check(P1.userId, MC, { correct: false, timedOut: true }),
      ],
      choiceState,
    );
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
    expect(state.players.get(P1.userId)?.score).toBe(0);
  });

  it("still needs a pick without the timeout flag", () => {
    const state = run(
      [...P1_WINS_MC(10), check(P1.userId, MC, { correct: false })],
      choiceState,
    );
    expect(state.type).toBe(GameState.RevealAnswerToBuzzer);
  });

  it("a pick sent with the flag is checked as a pick", () => {
    const state = run(
      [
        ...P1_WINS_MC(10),
        check(P1.userId, MC, { correct: false, choice: 1, timedOut: true }),
      ],
      choiceState,
    );
    expect(state.players.get(P1.userId)?.score).toBe(200);
  });
});

describe("getAnswerTimerStatus", () => {
  interface TestCase {
    name: string;
    now: number;
    expected: ReturnType<typeof getAnswerTimerStatus>;
  }
  const START = 100_000;
  const testCases: TestCase[] = [
    {
      name: "just started",
      now: START,
      expected: {
        deadline: START + 10_000,
        remainingMs: 10_000,
        secondsLeft: 10,
        fraction: 1,
        expired: false,
      },
    },
    {
      name: "rounds seconds up",
      now: START + 2_500,
      expected: {
        deadline: START + 10_000,
        remainingMs: 7_500,
        secondsLeft: 8,
        fraction: 0.75,
        expired: false,
      },
    },
    {
      name: "last moment",
      now: START + 9_999,
      expected: {
        deadline: START + 10_000,
        remainingMs: 1,
        secondsLeft: 1,
        fraction: 0.0001,
        expired: false,
      },
    },
    {
      name: "time's up at the deadline",
      now: START + 10_000,
      expected: {
        deadline: START + 10_000,
        remainingMs: 0,
        secondsLeft: 0,
        fraction: 0,
        expired: true,
      },
    },
    {
      name: "long past (late joiner, reload)",
      now: START + 60_000,
      expected: {
        deadline: START + 10_000,
        remainingMs: 0,
        secondsLeft: 0,
        fraction: 0,
        expired: true,
      },
    },
    {
      name: "a start slightly in the future shows a full timer",
      now: START - 1_500,
      expected: {
        deadline: START + 10_000,
        remainingMs: 10_000,
        secondsLeft: 10,
        fraction: 1,
        expired: false,
      },
    },
  ];
  for (const tc of testCases) {
    it(tc.name, () => {
      expect(
        getAnswerTimerStatus({
          startedAt: START,
          durationSec: 10,
          now: tc.now,
        }),
      ).toEqual(tc.expected);
    });
  }

  it("only offers the listed durations", () => {
    expect([0, 10, 15, 20, 30, 60].every(isAnswerTimeSec)).toBe(true);
    expect([5, 11, -10, "10", null, undefined].some(isAnswerTimeSec)).toBe(
      false,
    );
  });
});
