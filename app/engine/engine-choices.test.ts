import { describe, expect, it } from "vitest";

import { GameSchema } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import choiceData from "~/static/mock-choice.jep.json";

import type { Action } from "./engine";
import {
  ActionType,
  CANT_BUZZ_FLAG,
  CLUE_TIMEOUT_MS,
  gameEngine,
} from "./engine";
import { applyRoomEventsToState } from "./room-event";
import {
  GameState,
  type State,
  getCheckCorrectionForPlayer,
  stateFromGame,
} from "./state";

type TestAction = Omit<Action, "ts"> & { ts?: number };

/** Board 0 of the sample game:
 * - (0, 0) "Capitals" $200, choices Sydney / Canberra (correct, 1) / ...
 * - (0, 1) "Mixed Bag" $200, a normal question without choices
 * - (2, 1) "Mixed Bag" $600, wagerable, choices Ag / Au (correct, 1) / ...
 */
const CHOICE_GAME = {
  ...GameSchema.parse(choiceData),
  id: "c",
  visibility: "PUBLIC" as const,
};
const P1 = { userId: "1", name: "Player 1", score: 0 };
const P2 = { userId: "2", name: "Player 2", score: 0 };
const CORRECT = 1;
const WRONG = 0;

const initialState = stateFromGame(CHOICE_GAME);

const join = (p: typeof P1): TestAction => ({
  type: ActionType.Join,
  payload: { userId: p.userId, name: p.name },
});

const TWO_PLAYERS: TestAction[] = [
  join(P1),
  join(P2),
  { type: ActionType.StartRound, payload: { round: 0, userId: P1.userId } },
];

const choose = (i: number, j: number): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId: P1.userId, i, j },
});
const buzz = (
  userId: string,
  i: number,
  j: number,
  deltaMs = 100,
): TestAction => ({
  type: ActionType.Buzz,
  payload: { userId, i, j, deltaMs },
});
const pick = (
  userId: string,
  i: number,
  j: number,
  choice: number | undefined,
  correct: boolean,
): TestAction => ({
  type: ActionType.Check,
  payload: {
    userId,
    i,
    j,
    correct,
    ...(choice === undefined ? {} : { choice }),
  },
});

/** P1 wins the buzz on (0, 0); P2 times out. */
const P1_WINS_BUZZ: TestAction[] = [
  ...TWO_PLAYERS,
  choose(0, 0),
  buzz(P1.userId, 0, 0, 100),
  buzz(P2.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
];

function run(actions: TestAction[], state: State = initialState) {
  for (const action of actions) {
    state = gameEngine(state, { ts: 0, ...action });
  }
  return state;
}

describe("gameEngine multiple choice", () => {
  const cases: {
    name: string;
    actions: TestAction[];
    expect: (s: State) => void;
  }[] = [
    {
      name: "a correct pick is checked automatically (the client flag is ignored)",
      actions: [...P1_WINS_BUZZ, pick(P1.userId, 0, 0, CORRECT, false)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(200);
        expect(s.boardControl).toBe(P1.userId);
        expect(s.numAnswered).toBe(1);
        expect(s.isAnswered[0][0][0].answeredBy).toStrictEqual(
          new Map([[P1.userId, true]]),
        );
        expect(s.choicePicks.get("0,0,0")).toStrictEqual(
          new Map([[P1.userId, CORRECT]]),
        );
      },
    },
    {
      name: "a wrong pick deducts the value and locks the player out",
      actions: [...P1_WINS_BUZZ, pick(P1.userId, 0, 0, WRONG, true)],
      expect: (s) => {
        expect(s.type).toBe(GameState.ReadClue);
        expect(s.players.get(P1.userId)?.score).toBe(-200);
        expect(s.buzzes).toStrictEqual(new Map([[P1.userId, CANT_BUZZ_FLAG]]));
        expect(s.isAnswered[0][0][0].answeredBy).toStrictEqual(
          new Map([[P1.userId, false]]),
        );
        expect(s.choicePicks.get("0,0,0")).toStrictEqual(
          new Map([[P1.userId, WRONG]]),
        );
      },
    },
    {
      name: "after a wrong pick another player can buzz and pick",
      actions: [
        ...P1_WINS_BUZZ,
        pick(P1.userId, 0, 0, WRONG, false),
        buzz(P2.userId, 0, 0, 100),
        pick(P2.userId, 0, 0, CORRECT, false),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(-200);
        expect(s.players.get(P2.userId)?.score).toBe(200);
        expect(s.boardControl).toBe(P2.userId);
        expect(s.choicePicks.get("0,0,0")).toStrictEqual(
          new Map([
            [P1.userId, WRONG],
            [P2.userId, CORRECT],
          ]),
        );
      },
    },
    {
      name: "when everyone picked wrong the answer is revealed to all",
      actions: [
        ...P1_WINS_BUZZ,
        pick(P1.userId, 0, 0, WRONG, false),
        buzz(P2.userId, 0, 0, 100),
        pick(P2.userId, 0, 0, 2, false),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P2.userId)?.score).toBe(-200);
        expect(s.numAnswered).toBe(1);
        expect(s.choicePicks.get("0,0,0")).toStrictEqual(
          new Map([
            [P1.userId, WRONG],
            [P2.userId, 2],
          ]),
        );
      },
    },
    {
      name: "a check without a pick is ignored on a multiple choice question",
      actions: [...P1_WINS_BUZZ, pick(P1.userId, 0, 0, undefined, true)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(s.players.get(P1.userId)?.score).toBe(0);
        expect(s.choicePicks.size).toBe(0);
      },
    },
    {
      name: "a pick that is not one of the options is ignored",
      actions: [
        ...P1_WINS_BUZZ,
        pick(P1.userId, 0, 0, 4, true),
        pick(P1.userId, 0, 0, -1, true),
        pick(P1.userId, 0, 0, 0.5, true),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(s.players.get(P1.userId)?.score).toBe(0);
        expect(s.choicePicks.size).toBe(0);
      },
    },
    {
      name: "only the winning buzzer can pick",
      actions: [...P1_WINS_BUZZ, pick(P2.userId, 0, 0, CORRECT, true)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(s.players.get(P2.userId)?.score).toBe(0);
        expect(s.choicePicks.size).toBe(0);
      },
    },
    {
      name: "a normal question ignores a pick and uses the self-check",
      actions: [
        ...TWO_PLAYERS,
        choose(0, 1),
        buzz(P1.userId, 0, 1, 100),
        buzz(P2.userId, 0, 1, CLUE_TIMEOUT_MS + 1),
        pick(P1.userId, 0, 1, 0, true),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(200);
        expect(s.choicePicks.size).toBe(0);
      },
    },
    {
      name: "a wagerable question: the board-control player picks right",
      actions: [
        ...TWO_PLAYERS,
        choose(2, 1),
        {
          type: ActionType.SetClueWager,
          payload: { userId: P1.userId, i: 2, j: 1, wager: 500 },
        },
        buzz(P1.userId, 2, 1, 100),
        pick(P1.userId, 2, 1, CORRECT, false),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(500);
        expect(s.choicePicks.get("0,2,1")).toStrictEqual(
          new Map([[P1.userId, CORRECT]]),
        );
      },
    },
    {
      name: "a wagerable question: a wrong pick loses the wager",
      actions: [
        ...TWO_PLAYERS,
        choose(2, 1),
        {
          type: ActionType.SetClueWager,
          payload: { userId: P1.userId, i: 2, j: 1, wager: 500 },
        },
        buzz(P1.userId, 2, 1, 100),
        pick(P1.userId, 2, 1, WRONG, true),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(-500);
        expect(s.players.get(P2.userId)?.score).toBe(0);
        expect(s.numAnswered).toBe(1);
      },
    },
    {
      name: "auto-checked results cannot be corrected",
      actions: [
        ...P1_WINS_BUZZ,
        pick(P1.userId, 0, 0, WRONG, false),
        buzz(P2.userId, 0, 0, 100),
        pick(P2.userId, 0, 0, 2, false),
        {
          type: ActionType.CorrectCheck,
          payload: { round: 0, userId: P1.userId, i: 0, j: 0, correct: true },
        },
      ],
      expect: (s) => {
        expect(s.players.get(P1.userId)?.score).toBe(-200);
        expect(getCheckCorrectionForPlayer(s, P1.userId)).toBeUndefined();
      },
    },
    {
      name: "picks follow a player who signs in mid-game",
      actions: [
        ...P1_WINS_BUZZ,
        pick(P1.userId, 0, 0, WRONG, false),
        {
          type: ActionType.TransferPlayer,
          payload: { oldUserId: P1.userId, newUserId: "9" },
        },
      ],
      expect: (s) => {
        expect(s.choicePicks.get("0,0,0")).toStrictEqual(
          new Map([["9", WRONG]]),
        );
      },
    },
  ];

  it.each(cases)("$name", ({ actions, expect: check }) => {
    const before = initialState;
    check(run(actions));
    // The initial state is not mutated.
    expect(before).toStrictEqual(stateFromGame(CHOICE_GAME));
  });

  it("starts with no picks", () => {
    expect(run(TWO_PLAYERS).choicePicks.size).toBe(0);
  });
});

describe("replaying multiple choice room events", () => {
  let id = 0;
  function toEvents(actions: TestAction[]): DbRoomEvent[] {
    return actions.map((a) => {
      id += 1;
      return {
        id,
        room_id: 1,
        ts: `2026-10-25T10:00:${String(id).padStart(2, "0")}`,
        type: a.type,
        // Payloads round-trip through jsonb.
        payload: JSON.parse(JSON.stringify(a.payload)),
      };
    });
  }

  it("rebuilds picks from Check events carrying a choice", () => {
    const actions = [
      ...P1_WINS_BUZZ,
      pick(P1.userId, 0, 0, WRONG, false),
      buzz(P2.userId, 0, 0, 100),
      pick(P2.userId, 0, 0, CORRECT, true),
    ];
    const state = applyRoomEventsToState(
      stateFromGame(CHOICE_GAME),
      toEvents(actions),
    );
    expect(state.type).toBe(GameState.RevealAnswerToAll);
    expect(state.players.get(P2.userId)?.score).toBe(200);
    expect(state.choicePicks.get("0,0,0")).toStrictEqual(
      new Map([
        [P1.userId, WRONG],
        [P2.userId, CORRECT],
      ]),
    );
  });

  it("replays old Check events without a choice on normal questions", () => {
    const actions = [
      ...TWO_PLAYERS,
      choose(0, 1),
      buzz(P1.userId, 0, 1, 100),
      buzz(P2.userId, 0, 1, CLUE_TIMEOUT_MS + 1),
      pick(P1.userId, 0, 1, undefined, false),
    ];
    const state = applyRoomEventsToState(
      stateFromGame(CHOICE_GAME),
      toEvents(actions),
    );
    expect(state.type).toBe(GameState.ReadClue);
    expect(state.players.get(P1.userId)?.score).toBe(-200);
    expect(state.choicePicks.size).toBe(0);
  });
});
