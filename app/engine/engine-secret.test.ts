import { describe, expect, it } from "vitest";

import { GameSchema } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import secretData from "~/static/mock-secret.jep.json";

import type { Action } from "./engine";
import { ActionType, CANT_BUZZ_FLAG, gameEngine } from "./engine";
import { applyRoomEventsToState } from "./room-event";
import {
  GameState,
  type State,
  getCheckCorrectionForPlayer,
  getClueValue,
  getSecretTopic,
  stateFromGame,
} from "./state";

type TestAction = Omit<Action, "ts"> & { ts?: number };

/** Board 0 of the sample game:
 * - (0, 0) "Animals" $200, a normal question
 * - (1, 0) "Animals" $400, secret, topic "Famous cats", worth $500
 * - (0, 1) "Science" $200, secret multiple choice Ir / Fe (correct, 1) / ...
 */
const SECRET_GAME = {
  ...GameSchema.parse(secretData),
  id: "s",
  visibility: "PUBLIC" as const,
};
const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };
const P3 = { userId: "3", name: "Player 3" };
const SECRET: [number, number] = [1, 0];
const SECRET_CHOICE: [number, number] = [0, 1];
const NORMAL: [number, number] = [0, 0];
const CORRECT = 1;
const WRONG = 0;

const initialState = stateFromGame(SECRET_GAME);

const join = (p: typeof P1): TestAction => ({
  type: ActionType.Join,
  payload: p,
});
const start: TestAction = {
  type: ActionType.StartRound,
  payload: { round: 0, userId: P1.userId },
};
const choose = ([i, j]: [number, number], userId = P1.userId): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId, i, j },
});
const pass = (
  userId: string,
  toUserId: string,
  [i, j]: [number, number] = SECRET,
): TestAction => ({
  type: ActionType.PassClue,
  payload: { userId, i, j, toUserId },
});
const check = (
  userId: string,
  correct: boolean,
  [i, j]: [number, number] = SECRET,
  choice?: number,
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
const buzz = (userId: string, [i, j]: [number, number] = SECRET) => ({
  type: ActionType.Buzz,
  payload: { userId, i, j, deltaMs: 100 },
});
const leave = (p: typeof P1): TestAction => ({
  type: ActionType.Leave,
  payload: p,
});
const correctCheck = (
  userId: string,
  correct: boolean,
  [i, j]: [number, number] = SECRET,
): TestAction => ({
  type: ActionType.CorrectCheck,
  payload: { round: 0, userId, i, j, correct },
});
const transfer = (oldUserId: string, newUserId: string): TestAction => ({
  type: ActionType.TransferPlayer,
  payload: { oldUserId, newUserId },
});

const TWO_PLAYERS: TestAction[] = [join(P1), join(P2), start];
const THREE_PLAYERS: TestAction[] = [join(P1), join(P2), join(P3), start];
/** P1 (board control) chooses the secret question and gives it to P2. */
const P2_HAS_SECRET: TestAction[] = [
  ...TWO_PLAYERS,
  choose(SECRET),
  pass(P1.userId, P2.userId),
];

function run(actions: TestAction[], state: State = initialState) {
  for (const action of actions) {
    state = gameEngine(state, { ts: 0, ...action });
  }
  return state;
}

function score(s: State, p: typeof P1) {
  return (s.players.get(p.userId) ?? s.leftPlayers.get(p.userId))?.score;
}

/** The player answering the secret question, if it has been given away. */
function receiver(s: State) {
  const valid = Array.from(s.buzzes.entries()).filter(
    ([, deltaMs]) => deltaMs !== CANT_BUZZ_FLAG,
  );
  return valid.length === 1 ? valid[0][0] : undefined;
}

describe("gameEngine secret questions", () => {
  const cases: {
    name: string;
    actions: TestAction[];
    expect: (s: State) => void;
  }[] = [
    {
      name: "choosing a secret question asks the chooser to pass it on",
      actions: [...TWO_PLAYERS, choose(SECRET)],
      expect: (s) => {
        expect(s.type).toBe(GameState.PassClue);
        expect(s.activeClue).toStrictEqual(SECRET);
        expect(s.boardControl).toBe(P1.userId);
        expect(s.buzzes.size).toBe(0);
      },
    },
    {
      name: "passing gives the question to the chosen player only",
      actions: P2_HAS_SECRET,
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(s.buzzes).toStrictEqual(
          new Map([
            [P1.userId, CANT_BUZZ_FLAG],
            [P2.userId, 0],
          ]),
        );
        expect(receiver(s)).toBe(P2.userId);
      },
    },
    {
      name: "a correct answer scores the secret value and takes board control",
      actions: [...P2_HAS_SECRET, check(P2.userId, true)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(score(s, P2)).toBe(500);
        expect(score(s, P1)).toBe(0);
        expect(s.boardControl).toBe(P2.userId);
        expect(s.numAnswered).toBe(1);
        expect(s.isAnswered[0][1][0]).toMatchObject({
          isAnswered: true,
          answeredBy: new Map([[P2.userId, true]]),
        });
      },
    },
    {
      name: "a wrong answer loses the secret value; the chooser keeps control",
      actions: [...P2_HAS_SECRET, check(P2.userId, false)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(score(s, P2)).toBe(-500);
        expect(score(s, P1)).toBe(0);
        expect(s.boardControl).toBe(P1.userId);
        expect(s.numAnswered).toBe(1);
        expect(s.isAnswered[0][1][0]).toMatchObject({
          isAnswered: true,
          answeredBy: new Map([[P2.userId, false]]),
        });
      },
    },
    {
      name: "after the answer the board-control player moves on to the board",
      actions: [
        ...P2_HAS_SECRET,
        check(P2.userId, true),
        {
          type: ActionType.NextClue,
          payload: { userId: P2.userId, i: 1, j: 0 },
        },
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.ShowBoard);
        expect(s.activeClue).toBeNull();
        expect(s.buzzes.size).toBe(0);
      },
    },
    {
      name: "with three players the chooser can pick anyone else",
      actions: [
        ...THREE_PLAYERS,
        choose(SECRET),
        pass(P1.userId, P3.userId),
        check(P3.userId, false),
      ],
      expect: (s) => {
        expect(score(s, P3)).toBe(-500);
        expect(score(s, P2)).toBe(0);
        expect(s.boardControl).toBe(P1.userId);
        expect(s.type).toBe(GameState.RevealAnswerToAll);
      },
    },
    {
      name: "alone, the chooser gets the question automatically",
      actions: [join(P1), start, choose(SECRET)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(s.buzzes).toStrictEqual(new Map([[P1.userId, 0]]));
      },
    },
    {
      name: "alone, the chooser answers and scores the secret value",
      actions: [join(P1), start, choose(SECRET), check(P1.userId, true)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(score(s, P1)).toBe(500);
        expect(s.boardControl).toBe(P1.userId);
      },
    },
    {
      name: "only the board-control player can pass",
      actions: [...THREE_PLAYERS, choose(SECRET), pass(P2.userId, P3.userId)],
      expect: (s) => {
        expect(s.type).toBe(GameState.PassClue);
        expect(s.buzzes.size).toBe(0);
      },
    },
    {
      name: "the chooser can't keep the question when others are playing",
      actions: [...TWO_PLAYERS, choose(SECRET), pass(P1.userId, P1.userId)],
      expect: (s) => {
        expect(s.type).toBe(GameState.PassClue);
      },
    },
    {
      name: "passing to someone who is not playing is ignored",
      actions: [
        join(P1),
        join(P2),
        join(P3),
        leave(P3),
        start,
        choose(SECRET),
        pass(P1.userId, P3.userId),
        pass(P1.userId, "nobody"),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.PassClue);
        expect(s.buzzes.size).toBe(0);
      },
    },
    {
      name: "passing a different question is ignored",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET),
        pass(P1.userId, P2.userId, NORMAL),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.PassClue);
      },
    },
    {
      name: "a normal question can't be passed",
      actions: [...TWO_PLAYERS, choose(NORMAL), pass(P1.userId, P2.userId)],
      expect: (s) => {
        expect(s.type).toBe(GameState.ReadClue);
        expect(s.buzzes.size).toBe(0);
      },
    },
    {
      name: "a second pass after the hand-over is ignored",
      actions: [
        ...THREE_PLAYERS,
        choose(SECRET),
        pass(P1.userId, P2.userId),
        pass(P1.userId, P3.userId),
      ],
      expect: (s) => {
        expect(receiver(s)).toBe(P2.userId);
      },
    },
    {
      name: "nobody can buzz or check while the question is being passed",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET),
        buzz(P2.userId),
        check(P1.userId, true),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.PassClue);
        expect(score(s, P1)).toBe(0);
        expect(s.buzzes.size).toBe(0);
      },
    },
    {
      name: "only the receiver can answer",
      actions: [...P2_HAS_SECRET, buzz(P1.userId), check(P1.userId, true)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(score(s, P1)).toBe(0);
        expect(receiver(s)).toBe(P2.userId);
      },
    },
    {
      name: "the game can't be paused during the secret question",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET),
        { type: ActionType.TogglePause },
        pass(P1.userId, P2.userId),
        { type: ActionType.TogglePause },
      ],
      expect: (s) => {
        expect(s.isPaused).toBe(false);
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
      },
    },
    {
      name: "the chooser can't leave while passing (the game goes on)",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET),
        leave(P1),
        pass(P1.userId, P2.userId),
        check(P2.userId, true),
      ],
      expect: (s) => {
        expect(s.players.has(P1.userId)).toBe(true);
        expect(score(s, P2)).toBe(500);
        expect(s.type).toBe(GameState.RevealAnswerToAll);
      },
    },
    {
      name: "the receiver can't leave before answering (the game goes on)",
      actions: [...P2_HAS_SECRET, leave(P2), check(P2.userId, false)],
      expect: (s) => {
        expect(s.players.has(P2.userId)).toBe(true);
        expect(score(s, P2)).toBe(-500);
        expect(s.type).toBe(GameState.RevealAnswerToAll);
      },
    },
    {
      name: "players can't be kicked during the secret question",
      actions: [
        ...P2_HAS_SECRET,
        { type: ActionType.Kick, payload: P2 },
        check(P2.userId, true),
      ],
      expect: (s) => {
        expect(score(s, P2)).toBe(500);
      },
    },
    {
      name: "the chooser can pass after signing in mid-question",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET),
        transfer(P1.userId, "9"),
        pass("9", P2.userId),
      ],
      expect: (s) => {
        expect(s.boardControl).toBe("9");
        expect(receiver(s)).toBe(P2.userId);
      },
    },
    {
      name: "the receiver can answer after signing in mid-question",
      actions: [...P2_HAS_SECRET, transfer(P2.userId, "9"), check("9", true)],
      expect: (s) => {
        expect(s.players.get("9")?.score).toBe(500);
        expect(s.boardControl).toBe("9");
      },
    },
    {
      name: "a retired guest receiver hands the question to their account",
      actions: [
        ...THREE_PLAYERS,
        choose(SECRET),
        pass(P1.userId, P2.userId),
        // P2 signs in as P3's account in another tab: P2's guest entry is
        // retired, and the same person answers as P3.
        transfer(P2.userId, P3.userId),
        check(P3.userId, true),
      ],
      expect: (s) => {
        expect(s.players.has(P2.userId)).toBe(false);
        expect(score(s, P3)).toBe(500);
        expect(s.type).toBe(GameState.RevealAnswerToAll);
      },
    },
    {
      name: "if only the chooser is left while passing, they get the question",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET),
        // P1's guest entry is retired into P2's account: one player left.
        transfer(P1.userId, P2.userId),
      ],
      expect: (s) => {
        expect(s.players.size).toBe(1);
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(receiver(s)).toBe(P2.userId);
      },
    },
    {
      name: "a player joining mid-question can't buzz after a wrong answer",
      actions: [...P2_HAS_SECRET, join(P3), check(P2.userId, false)],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.boardControl).toBe(P1.userId);
      },
    },
    {
      name: "a self-checked secret answer can be corrected to right",
      actions: [
        ...P2_HAS_SECRET,
        check(P2.userId, false),
        correctCheck(P2.userId, true),
      ],
      expect: (s) => {
        expect(score(s, P2)).toBe(500);
        expect(s.boardControl).toBe(P2.userId);
      },
    },
    {
      name: "correcting a secret answer to wrong returns control to the chooser",
      actions: [
        ...P2_HAS_SECRET,
        check(P2.userId, true),
        correctCheck(P2.userId, false),
      ],
      expect: (s) => {
        expect(score(s, P2)).toBe(-500);
        expect(s.boardControl).toBe(P1.userId);
        expect(getCheckCorrectionForPlayer(s, P2.userId)).toMatchObject({
          correct: false,
          value: 500,
        });
      },
    },
    {
      name: "a secret multiple choice pick is checked against the answer",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET_CHOICE),
        pass(P1.userId, P2.userId, SECRET_CHOICE),
        check(P2.userId, true, SECRET_CHOICE, WRONG),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        // No secretValue: the cell value counts.
        expect(score(s, P2)).toBe(-200);
        expect(s.boardControl).toBe(P1.userId);
        expect(s.choicePicks.get("0,0,1")).toStrictEqual(
          new Map([[P2.userId, WRONG]]),
        );
        expect(getCheckCorrectionForPlayer(s, P2.userId)).toBeUndefined();
      },
    },
    {
      name: "a right secret pick scores and takes board control (final)",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET_CHOICE),
        pass(P1.userId, P2.userId, SECRET_CHOICE),
        check(P2.userId, false, SECRET_CHOICE, CORRECT),
        correctCheck(P2.userId, false, SECRET_CHOICE),
      ],
      expect: (s) => {
        expect(score(s, P2)).toBe(200);
        expect(s.boardControl).toBe(P2.userId);
      },
    },
    {
      name: "a secret multiple choice check without a pick is ignored",
      actions: [
        ...TWO_PLAYERS,
        choose(SECRET_CHOICE),
        pass(P1.userId, P2.userId, SECRET_CHOICE),
        check(P2.userId, true, SECRET_CHOICE),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToBuzzer);
        expect(score(s, P2)).toBe(0);
      },
    },
  ];

  it.each(cases)("$name", ({ actions, expect: check }) => {
    check(run(actions));
    // The initial state is not mutated.
    expect(initialState).toStrictEqual(stateFromGame(SECRET_GAME));
  });

  it("values a secret question at its secret value", () => {
    const s = run([...TWO_PLAYERS, choose(SECRET)]);
    expect(getClueValue(s, SECRET, P2.userId)).toBe(500);
    expect(getClueValue(s, SECRET_CHOICE, P2.userId)).toBe(200);
    expect(getClueValue(s, NORMAL, P2.userId)).toBe(200);
  });

  it("shows the secret topic, or the category name by default", () => {
    expect(getSecretTopic(SECRET_GAME.boards[0], SECRET)).toBe("Famous cats");
    expect(getSecretTopic(SECRET_GAME.boards[0], SECRET_CHOICE)).toBe(
      "Science",
    );
  });
});

describe("replaying secret question room events", () => {
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
        payload: JSON.parse(JSON.stringify(a.payload ?? null)),
      };
    });
  }

  it("rebuilds the same state from stored events", () => {
    const actions = [
      ...THREE_PLAYERS,
      choose(SECRET),
      pass(P2.userId, P3.userId), // ignored: P2 doesn't have board control
      pass(P1.userId, P3.userId),
      check(P3.userId, true),
      {
        type: ActionType.NextClue,
        payload: { userId: P3.userId, i: 1, j: 0 },
      },
      choose(SECRET_CHOICE, P3.userId),
      pass(P3.userId, P1.userId, SECRET_CHOICE),
      check(P1.userId, true, SECRET_CHOICE, WRONG),
    ];
    const replayed = applyRoomEventsToState(
      stateFromGame(SECRET_GAME),
      toEvents(actions),
    );
    expect(replayed.type).toBe(GameState.RevealAnswerToAll);
    expect(score(replayed, P3)).toBe(500);
    expect(score(replayed, P1)).toBe(-200);
    expect(replayed.boardControl).toBe(P3.userId);
    expect(replayed.numAnswered).toBe(2);
  });
});
