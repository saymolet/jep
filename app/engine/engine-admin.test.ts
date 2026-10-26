import { describe, expect, it } from "vitest";

import { GameSchema } from "~/models/convert.server";
import { MOCK_GAME } from "~/models/mock.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import choiceData from "~/static/mock-choice.jep.json";
import secretData from "~/static/mock-secret.jep.json";

import {
  type AdminStep,
  canSkipClue,
  canSkipOpenClue,
  getAdminStep,
} from "./admin";
import type { Action } from "./engine";
import {
  ActionType,
  CANT_BUZZ_FLAG,
  CLUE_TIMEOUT_MS,
  gameEngine,
} from "./engine";
import { applyRoomEventsToState } from "./room-event";
import { getScoreChanges, getStandings } from "./standings";
import { GameState, type State, stateFromGame } from "./state";

/* Admin interventions (feature 20): the site admin skips a question, does a
 * stuck player's step for them (the player's own action tagged
 * `admin: true`), or changes a score. Only the server inserts such events. */

type TestAction = Omit<Action, "ts"> & { ts?: number };

const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };
const P3 = { userId: "3", name: "Player 3" };

const SECRET_GAME = {
  ...GameSchema.parse(secretData),
  id: "s",
  visibility: "PUBLIC" as const,
};
const CHOICE_GAME = {
  ...GameSchema.parse(choiceData),
  id: "c",
  visibility: "PUBLIC" as const,
};

const join = (p: typeof P1, team?: string): TestAction => ({
  type: ActionType.Join,
  payload: { ...p, ...(team ? { team } : {}) },
});
const start = (userId = P1.userId, round = 0): TestAction => ({
  type: ActionType.StartRound,
  payload: { round, userId },
});
const choose = (i: number, j: number, userId = P1.userId): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId, i, j },
});
const buzz = (userId: string, i: number, j: number, deltaMs: number) => ({
  type: ActionType.Buzz,
  payload: { userId, i, j, deltaMs },
});
const check = (
  userId: string,
  i: number,
  j: number,
  correct: boolean,
  extra: object = {},
): TestAction => ({
  type: ActionType.Check,
  payload: { userId, i, j, correct, ...extra },
});
const next = (userId: string, i: number, j: number): TestAction => ({
  type: ActionType.NextClue,
  payload: { userId, i, j },
});
const wager = (
  userId: string,
  i: number,
  j: number,
  amount: number,
): TestAction => ({
  type: ActionType.SetClueWager,
  payload: { userId, i, j, wager: amount },
});
const answer = (userId: string, i: number, j: number, text: string) => ({
  type: ActionType.Answer,
  payload: { userId, i, j, answer: text },
});
const pass = (
  userId: string,
  toUserId: string,
  i: number,
  j: number,
): TestAction => ({
  type: ActionType.PassClue,
  payload: { userId, i, j, toUserId },
});
/** The admin skips question (i, j), as the admin route inserts it. */
const skip = (i: number, j: number, admin: unknown = true): TestAction => ({
  type: ActionType.SkipClue,
  payload: { i, j, admin },
});
/** The admin changes a score, as the admin route inserts it. */
const adjust = (payload: Record<string, unknown>): TestAction => ({
  type: ActionType.AdjustScore,
  payload: { admin: true, ...payload },
});
/** The same action done by the admin for the player. */
const asAdmin = (action: TestAction): TestAction => ({
  ...action,
  payload: Object.assign({}, action.payload, { admin: true }),
});

function run(actions: TestAction[], state: State = stateFromGame(MOCK_GAME)) {
  return actions.reduce(
    (s, action, k) => gameEngine(s, { ts: k + 1, ...action }),
    state,
  );
}

const scores = (state: State) =>
  Object.fromEntries(
    [...state.players.values(), ...state.leftPlayers.values()].map((p) => [
      p.userId,
      p.score,
    ]),
  );

const TWO_ON_BOARD: TestAction[] = [join(P1), join(P2), start()];
/** Round 1 of MOCK_GAME has two $200 questions: (0, 0) and (0, 1). */
const READING: TestAction[] = [...TWO_ON_BOARD, choose(0, 0)];
/** P2 won the buzz on (0, 0) and must mark their answer. */
const P2_ANSWERING: TestAction[] = [
  ...READING,
  buzz(P2.userId, 0, 0, 100),
  buzz(P1.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
];
/** Round 2 of MOCK_GAME: (0, 0) wagerable $400, (0, 1) Final (long form). Both
 * players get $1000 from the admin first, so both may wager on the Final. */
const start2 = start(P1.userId, 1);
const ROUND_2: TestAction[] = [
  ...TWO_ON_BOARD,
  skip(0, 0),
  skip(0, 1),
  adjust({ userId: P1.userId, delta: 1000 }),
  adjust({ userId: P2.userId, delta: 1000 }),
];

describe("SkipClue (admin)", () => {
  interface Case {
    name: string;
    game?: typeof MOCK_GAME;
    actions: TestAction[];
    expected: {
      type: GameState;
      scores: Record<string, number>;
      boardControl?: string | null;
      round?: number;
      numAnswered?: number;
    };
    /** The question that must now be marked as played and skipped. */
    skipped?: [number, number, number];
  }
  const cases: Case[] = [
    {
      name: "while the question is read: answer to everyone, no points",
      actions: [...READING, skip(0, 0)],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 0, 2: 0 },
        boardControl: P1.userId,
        numAnswered: 1,
      },
      skipped: [0, 0, 0],
    },
    {
      name: "while the buzz winner answers: their turn ends without points",
      actions: [...P2_ANSWERING, skip(0, 0)],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 0, 2: 0 },
        boardControl: P1.userId,
        numAnswered: 1,
      },
      skipped: [0, 0, 0],
    },
    {
      name: "after a wrong answer: that answer still counts",
      actions: [...P2_ANSWERING, check(P2.userId, 0, 0, false), skip(0, 0)],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 0, 2: -200 },
        boardControl: P1.userId,
      },
      skipped: [0, 0, 0],
    },
    {
      name: "back to the board as after any question (board control kept)",
      actions: [...P2_ANSWERING, skip(0, 0), next(P1.userId, 0, 0)],
      expected: {
        type: GameState.ShowBoard,
        scores: { 1: 0, 2: 0 },
        boardControl: P1.userId,
        numAnswered: 1,
      },
    },
    {
      name: "the last question of a round leads to the next round",
      actions: [
        ...TWO_ON_BOARD,
        skip(0, 0),
        choose(0, 1),
        skip(0, 1),
        next(P1.userId, 0, 1),
      ],
      expected: {
        type: GameState.PreviewRound,
        scores: { 1: 0, 2: 0 },
        round: 1,
        numAnswered: 0,
      },
    },
    {
      name: "from the board: the question is played without opening it",
      actions: [...TWO_ON_BOARD, skip(0, 1)],
      expected: {
        type: GameState.ShowBoard,
        scores: { 1: 0, 2: 0 },
        boardControl: P1.userId,
        numAnswered: 1,
      },
      skipped: [0, 0, 1],
    },
    {
      name: "from the board: the round's last question ends the round",
      actions: [...TWO_ON_BOARD, skip(0, 1), skip(0, 0)],
      expected: {
        type: GameState.PreviewRound,
        scores: { 1: 0, 2: 0 },
        round: 1,
        numAnswered: 0,
      },
      skipped: [0, 0, 0],
    },
    {
      name: "from the board: the game's last question ends the game",
      actions: [...ROUND_2, start2, skip(0, 0), skip(0, 1)],
      expected: {
        type: GameState.GameOver,
        scores: { 1: 1000, 2: 1000 },
        boardControl: null,
      },
      skipped: [1, 0, 1],
    },
    {
      name: "a Double Down while wagering",
      actions: [...ROUND_2, start2, choose(0, 0), skip(0, 0)],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 1000, 2: 1000 },
      },
      skipped: [1, 0, 0],
    },
    {
      name: "a Double Down after the wager (nothing is lost)",
      actions: [
        ...ROUND_2,
        start2,
        choose(0, 0),
        wager(P1.userId, 0, 0, 500),
        skip(0, 0),
      ],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 1000, 2: 1000 },
      },
      skipped: [1, 0, 0],
    },
    {
      name: "the Final while players wager",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P1.userId, 0, 1, 300),
        skip(0, 1),
      ],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 1000, 2: 1000 },
      },
      skipped: [1, 0, 1],
    },
    {
      name: "the Final while players write their answers",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P1.userId, 0, 1, 300),
        wager(P2.userId, 0, 1, 400),
        answer(P1.userId, 0, 1, "x"),
        skip(0, 1),
      ],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 1000, 2: 1000 },
      },
      skipped: [1, 0, 1],
    },
    {
      name: "the Final while answers are checked: checks so far count",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P1.userId, 0, 1, 300),
        wager(P2.userId, 0, 1, 400),
        answer(P1.userId, 0, 1, "x"),
        answer(P2.userId, 0, 1, "y"),
        check(P1.userId, 0, 1, true),
        skip(0, 1),
      ],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 1300, 2: 1000 },
      },
      skipped: [1, 0, 1],
    },
    {
      name: "then the game ends as after a normal Final",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        skip(0, 1),
        next(P2.userId, 0, 1),
      ],
      expected: {
        type: GameState.GameOver,
        scores: { 1: 1000, 2: 1000 },
        boardControl: null,
      },
    },
    {
      name: "a cat in the bag being handed over",
      game: SECRET_GAME,
      actions: [...TWO_ON_BOARD, choose(1, 0), skip(1, 0)],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 0, 2: 0 },
        boardControl: P1.userId,
      },
      skipped: [0, 1, 0],
    },
    {
      name: "a cat in the bag being answered",
      game: SECRET_GAME,
      actions: [
        ...TWO_ON_BOARD,
        choose(1, 0),
        pass(P1.userId, P2.userId, 1, 0),
        skip(1, 0),
      ],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 0, 2: 0 },
        boardControl: P1.userId,
      },
      skipped: [0, 1, 0],
    },
    // Ignored skips.
    {
      name: "ignored without the admin flag",
      actions: [...READING, skip(0, 0, false)],
      expected: { type: GameState.ReadClue, scores: { 1: 0, 2: 0 } },
    },
    {
      name: "ignored with a malformed admin flag",
      actions: [...READING, skip(0, 0, "yes")],
      expected: { type: GameState.ReadClue, scores: { 1: 0, 2: 0 } },
    },
    {
      name: "ignored for another question than the open one",
      actions: [...READING, skip(0, 1)],
      expected: { type: GameState.ReadClue, scores: { 1: 0, 2: 0 } },
    },
    {
      name: "ignored for a question that was played",
      actions: [...TWO_ON_BOARD, skip(0, 0), skip(0, 0)],
      expected: {
        type: GameState.ShowBoard,
        scores: { 1: 0, 2: 0 },
        numAnswered: 1,
      },
    },
    {
      name: "ignored once the answer is shown to everyone",
      actions: [...READING, skip(0, 0), skip(0, 0)],
      expected: {
        type: GameState.RevealAnswerToAll,
        scores: { 1: 0, 2: 0 },
        numAnswered: 1,
      },
    },
    {
      name: "ignored on the round preview",
      actions: [join(P1), join(P2), skip(0, 0)],
      expected: {
        type: GameState.PreviewRound,
        scores: { 1: 0, 2: 0 },
        numAnswered: 0,
      },
    },
    {
      name: "ignored for a cell outside the board",
      actions: [...TWO_ON_BOARD, skip(5, 0), skip(0, 7), skip(-1, 0)],
      expected: {
        type: GameState.ShowBoard,
        scores: { 1: 0, 2: 0 },
        numAnswered: 0,
      },
    },
    {
      name: "ignored after game over",
      actions: [...ROUND_2, start2, skip(0, 0), skip(0, 1), skip(0, 1)],
      expected: { type: GameState.GameOver, scores: { 1: 1000, 2: 1000 } },
    },
  ];

  it.each(cases)("$name", ({ game, actions, expected, skipped }) => {
    const state = run(actions, stateFromGame(game ?? MOCK_GAME));
    expect(state.type).toBe(expected.type);
    expect(scores(state)).toEqual(expected.scores);
    if (expected.boardControl !== undefined) {
      expect(state.boardControl).toBe(expected.boardControl);
    }
    if (expected.round !== undefined) {
      expect(state.round).toBe(expected.round);
    }
    if (expected.numAnswered !== undefined) {
      expect(state.numAnswered).toBe(expected.numAnswered);
    }
    if (skipped) {
      const [round, i, j] = skipped;
      const cell = state.isAnswered[round][i][j];
      expect(cell.isAnswered).toBe(true);
      expect(cell.skipped).toBe(true);
      expect(cell.answerOrder).toBeGreaterThan(0);
    }
  });

  it("ignores a malformed payload instead of failing the room", () => {
    const before = run(READING);
    for (const payload of [
      null,
      { i: "0", j: 0, admin: true },
      { i: 0, admin: true },
    ]) {
      expect(
        gameEngine(before, { type: ActionType.SkipClue, payload, ts: 9 }),
      ).toBe(before);
    }
  });

  it("clears the answer turn and its timer", () => {
    const state = run([...P2_ANSWERING, skip(0, 0)]);
    expect(state.answerStartedAt).toBeNull();
    expect(state.answerTimedOut).toBeNull();
    expect(state.activeClue).toEqual([0, 0]);
  });

  it("replays from room events", () => {
    const actions = [...P2_ANSWERING, skip(0, 0), next(P1.userId, 0, 0)];
    const events: DbRoomEvent[] = actions.map((a, k) => ({
      id: k + 1,
      room_id: 1,
      ts: `2026-10-26T10:00:${String(k + 1).padStart(2, "0")}`,
      type: a.type,
      payload: JSON.parse(JSON.stringify(a.payload ?? null)),
    }));
    const replayed = applyRoomEventsToState(stateFromGame(MOCK_GAME), events);
    expect(replayed.type).toBe(GameState.ShowBoard);
    expect(replayed.isAnswered[0][0][0]).toMatchObject({
      isAnswered: true,
      skipped: true,
    });
    expect(scores(replayed)).toEqual({ 1: 0, 2: 0 });
  });

  it("keeps an earlier wrong answer correctable after the skip", () => {
    const state = run([
      ...P2_ANSWERING,
      check(P2.userId, 0, 0, false),
      skip(0, 0),
      {
        type: ActionType.CorrectCheck,
        payload: { round: 0, userId: P2.userId, i: 0, j: 0, correct: true },
      },
    ]);
    expect(scores(state)).toEqual({ 1: 0, 2: 200 });
    expect(state.boardControl).toBe(P2.userId);
  });
});

describe("AdjustScore (admin)", () => {
  interface Case {
    name: string;
    actions: TestAction[];
    scores: Record<string, number>;
    type?: GameState;
    adjustments?: { userId: string; delta: number }[];
  }
  const cases: Case[] = [
    {
      name: "adds points",
      actions: [...TWO_ON_BOARD, adjust({ userId: P1.userId, delta: 500 })],
      scores: { 1: 500, 2: 0 },
      adjustments: [{ userId: P1.userId, delta: 500 }],
    },
    {
      name: "takes points away",
      actions: [...TWO_ON_BOARD, adjust({ userId: P2.userId, delta: -300 })],
      scores: { 1: 0, 2: -300 },
      adjustments: [{ userId: P2.userId, delta: -300 }],
    },
    {
      name: "sets an exact score (recorded as the difference)",
      actions: [
        ...TWO_ON_BOARD,
        adjust({ userId: P1.userId, delta: 500 }),
        adjust({ userId: P1.userId, score: 200 }),
      ],
      scores: { 1: 200, 2: 0 },
      adjustments: [
        { userId: P1.userId, delta: 500 },
        { userId: P1.userId, delta: -300 },
      ],
    },
    {
      name: "works on the round preview",
      actions: [join(P1), join(P2), adjust({ userId: P2.userId, delta: 100 })],
      scores: { 1: 0, 2: 100 },
      type: GameState.PreviewRound,
    },
    {
      name: "works during a question without changing its flow",
      actions: [...P2_ANSWERING, adjust({ userId: P1.userId, delta: 100 })],
      scores: { 1: 100, 2: 0 },
      type: GameState.RevealAnswerToBuzzer,
    },
    {
      name: "the question's points still add up afterwards",
      actions: [
        ...P2_ANSWERING,
        adjust({ userId: P2.userId, delta: 100 }),
        check(P2.userId, 0, 0, true),
      ],
      scores: { 1: 0, 2: 300 },
      type: GameState.RevealAnswerToAll,
    },
    {
      name: "works for a player who left (their points still count)",
      actions: [
        join(P1),
        join(P2),
        join(P3),
        start(),
        skip(0, 0),
        { type: ActionType.Leave, payload: P3 },
        adjust({ userId: P3.userId, delta: 50 }),
      ],
      scores: { 1: 0, 2: 0, 3: 50 },
    },
    // Ignored changes.
    {
      name: "ignored without the admin flag",
      actions: [
        ...TWO_ON_BOARD,
        {
          type: ActionType.AdjustScore,
          payload: { userId: P1.userId, delta: 500 },
        },
      ],
      scores: { 1: 0, 2: 0 },
      adjustments: [],
    },
    {
      name: "ignored for someone who isn't in the game",
      actions: [...TWO_ON_BOARD, adjust({ userId: "nobody", delta: 500 })],
      scores: { 1: 0, 2: 0 },
      adjustments: [],
    },
    {
      name: "ignored with both a change and a score, or neither",
      actions: [
        ...TWO_ON_BOARD,
        adjust({ userId: P1.userId, delta: 5, score: 10 }),
        adjust({ userId: P1.userId }),
      ],
      scores: { 1: 0, 2: 0 },
      adjustments: [],
    },
    {
      name: "ignored for amounts that aren't whole or are too large",
      actions: [
        ...TWO_ON_BOARD,
        adjust({ userId: P1.userId, delta: 1.5 }),
        adjust({ userId: P1.userId, delta: "100" }),
        adjust({ userId: P1.userId, score: 1e12 }),
        adjust({ userId: P1.userId, delta: Number.NaN }),
      ],
      scores: { 1: 0, 2: 0 },
      adjustments: [],
    },
    {
      name: "a change of nothing is not recorded",
      actions: [
        ...TWO_ON_BOARD,
        adjust({ userId: P1.userId, delta: 0 }),
        adjust({ userId: P1.userId, score: 0 }),
      ],
      scores: { 1: 0, 2: 0 },
      adjustments: [],
    },
    {
      name: "ignored after game over (final results stay final)",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        skip(0, 1),
        adjust({ userId: P1.userId, delta: 5 }),
      ],
      scores: { 1: 1000, 2: 1000 },
      type: GameState.GameOver,
    },
  ];

  it.each(cases)(
    "$name",
    ({ actions, scores: expected, type, adjustments }) => {
      const state = run(actions);
      expect(scores(state)).toEqual(expected);
      if (type) expect(state.type).toBe(type);
      if (adjustments) {
        expect(
          state.scoreAdjustments.map(({ userId, delta }) => ({
            userId,
            delta,
          })),
        ).toEqual(adjustments);
      }
    },
  );

  it("doesn't change board control or whose turn it is", () => {
    const before = run(P2_ANSWERING);
    const after = gameEngine(before, {
      type: ActionType.AdjustScore,
      payload: { userId: P2.userId, delta: 5000, admin: true },
      ts: 99,
    });
    expect(after.boardControl).toBe(before.boardControl);
    expect(after.buzzes).toEqual(before.buzzes);
    expect(after.answerStartedAt).toBe(before.answerStartedAt);
  });

  it("counts for the next round's board control (lowest score picks)", () => {
    const state = run([
      ...TWO_ON_BOARD,
      adjust({ userId: P1.userId, delta: 100 }),
      skip(0, 0),
      skip(0, 1),
    ]);
    expect(state.type).toBe(GameState.PreviewRound);
    expect(state.boardControl).toBe(P2.userId);
  });

  it("updates team totals", () => {
    const state = run([
      join(P1, "red"),
      join(P2, "red"),
      join(P3, "blue"),
      start(),
      adjust({ userId: P2.userId, delta: 400 }),
    ]);
    const standings = getStandings({
      ...state,
      scoreChanges: getScoreChanges(state),
    });
    expect(
      standings.teams?.map(({ team, score, change }) => ({
        team,
        score,
        change,
      })),
    ).toEqual([
      { team: "red", score: 400, change: 400 },
      { team: "blue", score: 0, change: 0 },
    ]);
  });
});

describe("standings deltas with admin score changes", () => {
  const changes = (state: State) => Object.fromEntries(getScoreChanges(state));

  it("before any question: the change shows on its own", () => {
    expect(
      changes(
        run([...TWO_ON_BOARD, adjust({ userId: P1.userId, delta: 300 })]),
      ),
    ).toEqual({ 1: 300 });
  });

  it("after a question: it adds to that question's changes", () => {
    const state = run([
      ...P2_ANSWERING,
      check(P2.userId, 0, 0, true),
      next(P2.userId, 0, 0),
      adjust({ userId: P2.userId, delta: 100 }),
      adjust({ userId: P1.userId, delta: -50 }),
    ]);
    expect(changes(state)).toEqual({ 1: -50, 2: 300 });
  });

  it("during a question: it belongs to that question", () => {
    const during = run([...READING, adjust({ userId: P1.userId, delta: 100 })]);
    expect(changes(during)).toEqual({ 1: 100 });
    const finished = run([
      ...P2_ANSWERING,
      adjust({ userId: P1.userId, delta: 100 }),
      check(P2.userId, 0, 0, true),
    ]);
    expect(changes(finished)).toEqual({ 1: 100, 2: 200 });
  });

  it("the next question starts from zero again", () => {
    const state = run([
      ...READING,
      adjust({ userId: P1.userId, delta: 100 }),
      skip(0, 0),
      next(P1.userId, 0, 0),
      choose(0, 1),
      buzz(P1.userId, 0, 1, 100),
      buzz(P2.userId, 0, 1, CLUE_TIMEOUT_MS + 1),
      check(P1.userId, 0, 1, false),
    ]);
    expect(changes(state)).toEqual({ 1: -200 });
  });

  it("each player's score minus the change is the score before", () => {
    const state = run([
      ...P2_ANSWERING,
      check(P2.userId, 0, 0, true),
      adjust({ userId: P2.userId, score: 1000 }),
    ]);
    expect(state.players.get(P2.userId)?.score).toBe(1000);
    expect(changes(state)).toEqual({ 2: 1000 });
  });
});

describe("acting for a player (admin-tagged player actions)", () => {
  /** Each scenario runs the same way whether the player or the admin (for
   * them) sends the last action. */
  const cases: {
    name: string;
    game?: typeof MOCK_GAME;
    setup: TestAction[];
    action: TestAction;
    changed: boolean;
  }[] = [
    {
      name: "start the round for the board-control player",
      setup: [join(P1), join(P2)],
      action: start(P1.userId),
      changed: true,
    },
    {
      name: "not for a player without board control",
      setup: [join(P1), join(P2)],
      action: start(P2.userId),
      changed: false,
    },
    {
      name: "choose a question for the board-control player",
      setup: TWO_ON_BOARD,
      action: choose(0, 1, P1.userId),
      changed: true,
    },
    {
      name: "not for a player without board control",
      setup: TWO_ON_BOARD,
      action: choose(0, 1, P2.userId),
      changed: false,
    },
    {
      name: "a buzz that times out for a player who is away",
      setup: [...READING, buzz(P2.userId, 0, 0, 100)],
      action: buzz(P1.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
      changed: true,
    },
    {
      name: "mark the buzz winner's answer right",
      setup: P2_ANSWERING,
      action: check(P2.userId, 0, 0, true),
      changed: true,
    },
    {
      name: "not for a player who didn't win the buzz",
      setup: P2_ANSWERING,
      action: check(P1.userId, 0, 0, true),
      changed: false,
    },
    {
      name: "back to the board for the board-control player",
      setup: [...P2_ANSWERING, check(P2.userId, 0, 0, true)],
      action: next(P2.userId, 0, 0),
      changed: true,
    },
    {
      name: "not for another player",
      setup: [...P2_ANSWERING, check(P2.userId, 0, 0, true)],
      action: next(P1.userId, 0, 0),
      changed: false,
    },
    {
      name: "a wager",
      setup: [...ROUND_2, start2, choose(0, 0)],
      action: wager(P1.userId, 0, 0, 500),
      changed: true,
    },
    {
      name: "a Final answer",
      setup: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P1.userId, 0, 1, 300),
        wager(P2.userId, 0, 1, 400),
      ],
      action: answer(P2.userId, 0, 1, "what is x"),
      changed: true,
    },
    {
      name: "hand the cat in the bag over for the chooser",
      game: SECRET_GAME,
      setup: [...TWO_ON_BOARD, choose(1, 0)],
      action: pass(P1.userId, P2.userId, 1, 0),
      changed: true,
    },
    {
      name: "not for a player who didn't choose it",
      game: SECRET_GAME,
      setup: [...TWO_ON_BOARD, choose(1, 0)],
      action: pass(P2.userId, P1.userId, 1, 0),
      changed: false,
    },
    {
      name: "pick a multiple choice option (checked against the answer)",
      game: CHOICE_GAME,
      setup: [
        ...TWO_ON_BOARD,
        choose(0, 0),
        buzz(P2.userId, 0, 0, 100),
        buzz(P1.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
      ],
      // A forged "correct" with a wrong option still counts as wrong.
      action: check(P2.userId, 0, 0, true, { choice: 0 }),
      changed: true,
    },
  ];

  it.each(cases)("$name", ({ game, setup, action, changed }) => {
    const before = run(setup, stateFromGame(game ?? MOCK_GAME));
    const byPlayer = gameEngine(before, { ts: 100, ...action });
    const byAdmin = gameEngine(before, { ts: 100, ...asAdmin(action) });
    expect(byAdmin).toEqual(byPlayer);
    if (changed) {
      expect(byAdmin).not.toBe(before);
    } else {
      expect(byAdmin).toEqual(before);
    }
  });

  it("a multiple choice pick for the player is judged by the engine", () => {
    const state = run(
      [
        ...TWO_ON_BOARD,
        choose(0, 0),
        buzz(P2.userId, 0, 0, 100),
        buzz(P1.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
        asAdmin(check(P2.userId, 0, 0, true, { choice: 0 })),
      ],
      stateFromGame(CHOICE_GAME),
    );
    expect(state.players.get(P2.userId)?.score).toBe(-200);
    expect(state.buzzes.get(P2.userId)).toBe(CANT_BUZZ_FLAG);
  });

  it("solo play keeps working (no admin)", () => {
    const solo = run([
      join(P1),
      start(),
      choose(0, 0),
      buzz(P1.userId, 0, 0, 100),
      check(P1.userId, 0, 0, true),
      next(P1.userId, 0, 0),
    ]);
    expect(solo.type).toBe(GameState.ShowBoard);
    expect(solo.players.get(P1.userId)?.score).toBe(200);
    expect(solo.scoreAdjustments).toEqual([]);
  });
});

describe("getAdminStep", () => {
  const cases: {
    name: string;
    game?: typeof MOCK_GAME;
    actions: TestAction[];
    expected: AdminStep;
    canSkip?: boolean;
  }[] = [
    { name: "nobody in the room", actions: [], expected: { kind: "none" } },
    {
      name: "the round preview: board control starts",
      actions: [join(P1), join(P2)],
      expected: { kind: "start", userId: P1.userId },
      canSkip: false,
    },
    {
      name: "the board: board control chooses",
      actions: TWO_ON_BOARD,
      expected: { kind: "choose", userId: P1.userId },
      canSkip: false,
    },
    {
      name: "buzzers open: who hasn't buzzed",
      actions: [...READING, buzz(P2.userId, 0, 0, 100)],
      expected: { kind: "buzz", userIds: [P1.userId] },
      canSkip: true,
    },
    {
      name: "the buzz winner marks",
      actions: P2_ANSWERING,
      expected: { kind: "check", userId: P2.userId, choices: false },
      canSkip: true,
    },
    {
      name: "the buzz winner picks an option",
      game: CHOICE_GAME,
      actions: [
        ...TWO_ON_BOARD,
        choose(0, 0),
        buzz(P2.userId, 0, 0, 100),
        buzz(P1.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
      ],
      expected: { kind: "check", userId: P2.userId, choices: true },
    },
    {
      name: "the answer is shown: board control goes back to the board",
      actions: [...P2_ANSWERING, check(P2.userId, 0, 0, true)],
      expected: { kind: "next", userId: P2.userId },
      canSkip: false,
    },
    {
      name: "a Double Down: board control wagers",
      actions: [...ROUND_2, start2, choose(0, 0)],
      expected: { kind: "wager", userIds: [P1.userId] },
      canSkip: true,
    },
    {
      name: "the Final: who hasn't wagered",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P2.userId, 0, 1, 10),
      ],
      expected: { kind: "wager", userIds: [P1.userId] },
    },
    {
      name: "the Final: who hasn't answered",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P1.userId, 0, 1, 10),
        wager(P2.userId, 0, 1, 10),
        answer(P2.userId, 0, 1, "x"),
      ],
      expected: { kind: "answer", userIds: [P1.userId] },
    },
    {
      name: "the Final: who hasn't marked",
      actions: [
        ...ROUND_2,
        start2,
        skip(0, 0),
        choose(0, 1),
        wager(P1.userId, 0, 1, 10),
        wager(P2.userId, 0, 1, 10),
        answer(P2.userId, 0, 1, "x"),
        answer(P1.userId, 0, 1, "y"),
        check(P1.userId, 0, 1, true),
      ],
      expected: { kind: "checks", userIds: [P2.userId] },
    },
    {
      name: "the Final nobody can wager on: show the answer",
      actions: [
        ...TWO_ON_BOARD,
        skip(0, 0),
        skip(0, 1),
        start2,
        skip(0, 0),
        choose(0, 1),
      ],
      expected: { kind: "reveal", userId: P1.userId },
      canSkip: true,
    },
    {
      name: "a cat in the bag: the chooser gives it to someone else",
      game: SECRET_GAME,
      actions: [join(P1), join(P2), join(P3), start(), choose(1, 0)],
      expected: {
        kind: "pass",
        userId: P1.userId,
        receivers: [P2.userId, P3.userId],
      },
      canSkip: true,
    },
    {
      name: "game over",
      actions: [...ROUND_2, start2, skip(0, 0), skip(0, 1)],
      expected: { kind: "none" },
      canSkip: false,
    },
  ];

  it.each(cases)("$name", ({ game, actions, expected, canSkip }) => {
    const state = run(actions, stateFromGame(game ?? MOCK_GAME));
    expect(getAdminStep(state)).toEqual(expected);
    if (canSkip !== undefined) {
      expect(canSkipOpenClue(state)).toBe(canSkip);
    }
  });

  it("canSkipClue: unplayed board questions, or the open one", () => {
    const board = run(TWO_ON_BOARD);
    expect(canSkipClue(board, 0, 0)).toBe(true);
    expect(canSkipClue(board, 0, 5)).toBe(false);
    expect(canSkipClue(run([...TWO_ON_BOARD, skip(0, 0)]), 0, 0)).toBe(false);
    const open = run(READING);
    expect(canSkipClue(open, 0, 0)).toBe(true);
    expect(canSkipClue(open, 0, 1)).toBe(false);
  });
});
