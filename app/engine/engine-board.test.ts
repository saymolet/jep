import { describe, expect, it } from "vitest";

import type { Game } from "~/models/convert.server";
import { GameSchema } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import data8x5 from "~/static/mock-8x5.jep.json";
import raggedData from "~/static/mock-ragged.jep.json";

import type { Action } from "./engine";
import { ActionType, CLUE_TIMEOUT_MS, gameEngine } from "./engine";
import { applyRoomEventsToState } from "./room-event";
import {
  GameState,
  type State,
  getNumCluesInBoard,
  stateFromGame,
} from "./state";

type TestAction = Omit<Action, "ts"> & { ts?: number };

function load(data: unknown, id: string) {
  return { ...GameSchema.parse(data), id, visibility: "PUBLIC" as const };
}

/** Round 0: Short (3 questions), Full (5), Middle (4) — the first category is
 * shorter than the board. Round 1: Pair (2), Single (1). */
const RAGGED_GAME = load(raggedData, "ragged");
const WIDE_GAME = load(data8x5, "8x5");

const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };

const join = (p: typeof P1): TestAction => ({
  type: ActionType.Join,
  payload: p,
});
const start = (round = 0, userId = P1.userId): TestAction => ({
  type: ActionType.StartRound,
  payload: { round, userId },
});
const choose = (i: number, j: number, userId = P1.userId): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId, i, j },
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
const check = (
  userId: string,
  i: number,
  j: number,
  correct: boolean,
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
const next = (i: number, j: number, userId = P1.userId): TestAction => ({
  type: ActionType.NextClue,
  payload: { userId, i, j },
});

/** One player answers (i, j) correctly and goes back to the board. */
const answer = (i: number, j: number): TestAction[] => [
  choose(i, j),
  buzz(P1.userId, i, j),
  check(P1.userId, i, j, true),
  next(i, j),
];

/** Every existing cell of a board, column by column. */
function cellsOf(game: Game, round: number): [number, number][] {
  return game.boards[round].categories.flatMap((category, j) =>
    category.clues.map((_, i): [number, number] => [i, j]),
  );
}

function answerAll(cells: [number, number][]) {
  return cells.flatMap(([i, j]) => answer(i, j));
}

function run(actions: TestAction[], state: State) {
  for (const action of actions) {
    state = gameEngine(state, { ts: 0, ...action });
  }
  return state;
}

const SOLO: TestAction[] = [join(P1), start()];
const RAGGED_ROUND_0 = cellsOf(RAGGED_GAME, 0);
const RAGGED_ROUND_1 = cellsOf(RAGGED_GAME, 1);

describe("boards with uneven categories", () => {
  it("sizes the answer grid by the longest category", () => {
    const s = stateFromGame(RAGGED_GAME);
    expect(s.isAnswered[0]).toHaveLength(5);
    expect(s.isAnswered[0].every((row) => row.length === 3)).toBe(true);
    expect(s.isAnswered[1]).toHaveLength(2);
    expect(s.isAnswered[1].every((row) => row.length === 2)).toBe(true);
    expect(s.numCluesInBoard).toBe(12);
    expect(getNumCluesInBoard(RAGGED_GAME, 1)).toBe(3);
  });

  it("does not share answer cells between rows", () => {
    const s = run([...SOLO, ...answer(4, 1)], stateFromGame(RAGGED_GAME));
    const answered = s.isAnswered[0]
      .flatMap((row, i) => row.map((c, j) => (c.isAnswered ? [i, j] : null)))
      .filter(Boolean);
    expect(answered).toStrictEqual([[4, 1]]);
  });

  const cases: {
    name: string;
    game?: Game;
    actions: TestAction[];
    expect: (s: State) => void;
  }[] = [
    {
      name: "chooses the last question of the short first column",
      actions: [...SOLO, choose(2, 0)],
      expect: (s) => {
        expect(s.type).toBe(GameState.ReadClue);
        expect(s.activeClue).toStrictEqual([2, 0]);
      },
    },
    {
      name: "chooses a question in a row the other columns don't have",
      actions: [...SOLO, ...answer(4, 1)],
      expect: (s) => {
        expect(s.type).toBe(GameState.ShowBoard);
        expect(s.isAnswered[0][4][1].isAnswered).toBe(true);
        expect(s.players.get(P1.userId)?.score).toBe(1000);
        expect(s.numAnswered).toBe(1);
      },
    },
    {
      name: "ignores a missing cell in a short column",
      actions: [...SOLO, choose(4, 0)],
      expect: (s) => {
        expect(s.type).toBe(GameState.ShowBoard);
        expect(s.activeClue).toBeNull();
      },
    },
    {
      name: "ignores a cell past the last row",
      actions: [...SOLO, choose(5, 1)],
      expect: (s) => {
        expect(s.type).toBe(GameState.ShowBoard);
        expect(s.activeClue).toBeNull();
      },
    },
    {
      name: "keeps the round going until every existing question is answered",
      actions: [...SOLO, ...answerAll(RAGGED_ROUND_0.slice(0, -1))],
      expect: (s) => {
        expect(s.type).toBe(GameState.ShowBoard);
        expect(s.round).toBe(0);
        expect(s.numAnswered).toBe(11);
      },
    },
    {
      name: "ends the round when every existing question is answered",
      actions: [...SOLO, ...answerAll(RAGGED_ROUND_0)],
      expect: (s) => {
        expect(s.type).toBe(GameState.PreviewRound);
        expect(s.round).toBe(1);
        expect(s.numAnswered).toBe(0);
        expect(s.numCluesInBoard).toBe(3);
        expect(s.players.get(P1.userId)?.score).toBe(
          RAGGED_GAME.boards[0].categories
            .flatMap((c) => c.clues)
            .reduce((sum, c) => sum + c.value, 0),
        );
      },
    },
    {
      name: "plays the next uneven round to the end of the game",
      actions: [
        ...SOLO,
        ...answerAll(RAGGED_ROUND_0),
        start(1),
        ...answerAll(RAGGED_ROUND_1),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.GameOver);
        expect(s.round).toBe(1);
        expect(s.isAnswered[1][1][1].isAnswered).toBe(false);
      },
    },
    {
      name: "plays all 40 questions of an 8-category board",
      game: WIDE_GAME,
      actions: [...SOLO, ...answerAll(cellsOf(WIDE_GAME, 0))],
      expect: (s) => {
        expect(s.type).toBe(GameState.GameOver);
        expect(s.isAnswered[0]).toHaveLength(5);
        expect(s.isAnswered[0][0]).toHaveLength(8);
        expect(s.isAnswered[0].flat().filter((c) => c.isAnswered)).toHaveLength(
          40,
        );
      },
    },
    {
      name: "answers a wagerable question in a short column",
      game: SPECIAL_GAME(),
      actions: [
        join(P1),
        join(P2),
        start(),
        choose(0, 0),
        {
          type: ActionType.SetClueWager,
          payload: { userId: P1.userId, i: 0, j: 0, wager: 300 },
        },
        buzz(P1.userId, 0, 0),
        check(P1.userId, 0, 0, true),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(300);
        expect(s.isAnswered[0][0][0].isAnswered).toBe(true);
      },
    },
    {
      name: "passes a secret question in the longest column's extra row",
      game: SPECIAL_GAME(),
      actions: [
        join(P1),
        join(P2),
        start(),
        choose(2, 1),
        {
          type: ActionType.PassClue,
          payload: { userId: P1.userId, i: 2, j: 1, toUserId: P2.userId },
        },
        check(P2.userId, 2, 1, true),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P2.userId)?.score).toBe(600);
        expect(s.boardControl).toBe(P2.userId);
      },
    },
    {
      name: "checks a multiple choice pick in a middle column",
      game: SPECIAL_GAME(),
      actions: [
        join(P1),
        join(P2),
        start(),
        choose(1, 2),
        buzz(P1.userId, 1, 2),
        buzz(P2.userId, 1, 2, CLUE_TIMEOUT_MS + 1),
        check(P1.userId, 1, 2, false, 1),
      ],
      expect: (s) => {
        expect(s.type).toBe(GameState.RevealAnswerToAll);
        expect(s.players.get(P1.userId)?.score).toBe(400);
        expect(s.isAnswered[0][1][2].isAnswered).toBe(true);
      },
    },
  ];

  it.each(cases)("$name", ({ game = RAGGED_GAME, actions, expect: check }) => {
    check(run(actions, stateFromGame(game)));
  });
});

/** A one-round board shaped 1 / 3 / 2 with a wagerable question in the
 * single-question column, a secret question in the extra row of the longest
 * column and a multiple choice question in the last column. */
function SPECIAL_GAME(): Game {
  return GameSchema.parse({
    title: "Special",
    author: "Test",
    copyright: "",
    note: "",
    boards: [
      {
        categoryNames: ["One", "Three", "Two"],
        categories: [
          {
            name: "One",
            clues: [{ clue: "w", answer: "w", value: 200, wagerable: true }],
          },
          {
            name: "Three",
            clues: [
              { clue: "a", answer: "a", value: 200 },
              { clue: "b", answer: "b", value: 400 },
              { clue: "s", answer: "s", value: 600, secret: true },
            ],
          },
          {
            name: "Two",
            clues: [
              { clue: "c", answer: "c", value: 200 },
              {
                clue: "Pick",
                answer: "Fe",
                value: 400,
                choices: ["Ir", "Fe"],
              },
            ],
          },
        ],
      },
    ],
  });
}

describe("replaying an uneven board from room events", () => {
  let id = 0;
  function toEvents(actions: TestAction[]): DbRoomEvent[] {
    return actions.map((a) => {
      id += 1;
      return {
        id,
        room_id: 1,
        ts: new Date(Date.UTC(2026, 9, 25, 10, 0, id)).toISOString(),
        type: a.type,
        payload: JSON.parse(JSON.stringify(a.payload ?? null)),
      };
    });
  }

  it("rebuilds a finished uneven round", () => {
    const actions = [
      join(P1),
      join(P2),
      start(),
      ...answerAll(RAGGED_ROUND_0.slice(0, 4)).flatMap((a) =>
        a.type === ActionType.Buzz
          ? [
              a,
              buzz(
                P2.userId,
                (a.payload as { i: number }).i,
                (a.payload as { j: number }).j,
                CLUE_TIMEOUT_MS + 1,
              ),
            ]
          : [a],
      ),
    ];
    const live = run(actions, stateFromGame(RAGGED_GAME));
    const replayed = applyRoomEventsToState(
      stateFromGame(RAGGED_GAME),
      toEvents(actions),
    );
    expect(live.numAnswered).toBe(4);
    expect(replayed.numAnswered).toBe(4);
    expect(replayed.players.get(P1.userId)?.score).toBe(
      live.players.get(P1.userId)?.score,
    );
    expect(
      replayed.isAnswered[0].map((row) => row.map((c) => c.isAnswered)),
    ).toStrictEqual(
      live.isAnswered[0].map((row) => row.map((c) => c.isAnswered)),
    );
  });
});
