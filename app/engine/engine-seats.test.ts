import { describe, expect, it } from "vitest";

import { MOCK_GAME } from "~/models/mock.server";
import type { DbRoomEvent } from "~/models/room-event.server";

import type { Action } from "./engine";
import {
  ActionType,
  CLUE_TIMEOUT_MS,
  gameEngine,
  isGameUnderway,
} from "./engine";
import { applyRoomEventsToState } from "./room-event";
import { GameState, type Player, type State, stateFromGame } from "./state";

type TestAction = Omit<Action, "ts"> & { ts?: number };

const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };
const P3 = { userId: "3", name: "Player 3" };
const RED = "#dc2626";
const SMILE = "emoji:🦊";

const initialState = stateFromGame(MOCK_GAME);

const join = (
  p: typeof P1,
  extra: Record<string, unknown> = {},
): TestAction => ({
  type: ActionType.Join,
  payload: { ...p, ...extra },
});
const start: TestAction = {
  type: ActionType.StartRound,
  payload: { round: 0, userId: P1.userId },
};
const choose = (i: number, j: number, userId = P1.userId): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId, i, j },
});
const buzz = (userId: string, i: number, j: number, deltaMs: number) => ({
  type: ActionType.Buzz,
  payload: { userId, i, j, deltaMs },
});
const check = (userId: string, i: number, j: number, correct: boolean) => ({
  type: ActionType.Check,
  payload: { userId, i, j, correct },
});
const next = (userId: string, i: number, j: number): TestAction => ({
  type: ActionType.NextClue,
  payload: { userId, i, j },
});
const leave = (p: typeof P1): TestAction => ({
  type: ActionType.Leave,
  payload: p,
});
/** A kick as a player sends it (and as every kick before the admin rule). */
const kick = (p: typeof P1): TestAction => ({
  type: ActionType.Kick,
  payload: p,
});
/** A kick by the site admin, as the player route inserts it. */
const adminKick = (p: typeof P1, admin: unknown = true): TestAction => ({
  type: ActionType.Kick,
  payload: { ...p, admin },
});

/** P2 answers the first $200 question right (P1 doesn't buzz). P1 keeps
 * board control only if P2 is gone; otherwise P2 picks next. */
const P2_SCORES_200: TestAction[] = [
  choose(0, 0),
  buzz(P2.userId, 0, 0, 100),
  buzz(P1.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
  buzz(P3.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
  check(P2.userId, 0, 0, true),
  next(P2.userId, 0, 0),
];
/** Three players, round 1 started, P2 has $200. */
const UNDERWAY: TestAction[] = [
  join(P1),
  join(P2),
  join(P3),
  start,
  ...P2_SCORES_200,
];

function run(actions: TestAction[], state: State = initialState) {
  return actions.reduce(
    (s, action) => gameEngine(s, { ts: 0, ...action }),
    state,
  );
}

/** The seats in a compact form: who plays (with score), who left. */
function seats(state: State) {
  const fmt = (m: Map<string, Player>) =>
    Object.fromEntries(Array.from(m.values(), (p) => [p.userId, p.score]));
  return {
    players: fmt(state.players),
    left: fmt(state.leftPlayers),
    boardControl: state.boardControl,
  };
}

describe("isGameUnderway", () => {
  const cases: { name: string; actions: TestAction[]; expected: boolean }[] = [
    {
      name: "first round's preview",
      actions: [join(P1), join(P2)],
      expected: false,
    },
    {
      name: "first round's board before any question",
      actions: [join(P1), join(P2), start],
      expected: false,
    },
    {
      name: "the first question is open",
      actions: [join(P1), join(P2), start, choose(0, 0)],
      expected: true,
    },
    {
      name: "back on the board after the first question",
      actions: [join(P1), join(P2), join(P3), start, ...P2_SCORES_200],
      expected: true,
    },
  ];
  for (const tc of cases) {
    it(tc.name, () => {
      expect(isGameUnderway(run(tc.actions))).toBe(tc.expected);
    });
  }

  it("later rounds and game over are underway", () => {
    expect(
      isGameUnderway({
        type: GameState.PreviewRound,
        round: 1,
        numAnswered: 0,
      }),
    ).toBe(true);
    expect(
      isGameUnderway({ type: GameState.GameOver, round: 0, numAnswered: 0 }),
    ).toBe(true);
  });
});

describe("seat engine (kick rules and rejoining)", () => {
  interface TestCase {
    name: string;
    actions: TestAction[];
    expected: ReturnType<typeof seats>;
  }

  const testCases: TestCase[] = [
    // Kicks by players: unchanged, before the game is underway only.
    {
      name: "a player kick in the first round's preview removes the player",
      actions: [join(P1), join(P2), kick(P2)],
      expected: { players: { 1: 0 }, left: {}, boardControl: "1" },
    },
    {
      name: "a player kick on the first board before any question removes the player",
      actions: [join(P1), join(P2), start, kick(P1)],
      expected: { players: { 2: 0 }, left: {}, boardControl: "2" },
    },
    {
      name: "a player kick is ignored once the game is underway",
      actions: [...UNDERWAY, kick(P2)],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "2",
      },
    },
    {
      name: "a player kick is ignored while the first question is open",
      actions: [join(P1), join(P2), start, choose(0, 0), kick(P2)],
      expected: { players: { 1: 0, 2: 0 }, left: {}, boardControl: "1" },
    },
    // Kicks by the admin.
    {
      name: "the admin removes a player before the game (removed for good)",
      actions: [join(P1), join(P2), adminKick(P2)],
      expected: { players: { 1: 0 }, left: {}, boardControl: "1" },
    },
    {
      name: "the admin removes a player during the game (kept with points as left)",
      actions: [...UNDERWAY, adminKick(P2)],
      expected: {
        players: { 1: 0, 3: 0 },
        left: { 2: 200 },
        boardControl: "1",
      },
    },
    {
      name: "the admin can't remove a player while a question is open",
      actions: [...UNDERWAY, choose(0, 1, P2.userId), adminKick(P3)],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "2",
      },
    },
    {
      name: "the admin can't remove the last player",
      actions: [
        join(P1),
        join(P2),
        start,
        ...P2_SCORES_200,
        adminKick(P1),
        adminKick(P2),
      ],
      expected: { players: { 2: 200 }, left: { 1: 0 }, boardControl: "2" },
    },
    {
      name: "an admin kick of someone not playing changes nothing",
      actions: [...UNDERWAY, adminKick({ userId: "x", name: "X" })],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "2",
      },
    },
    {
      name: "a malformed admin flag counts as a player kick (ignored during the game)",
      actions: [...UNDERWAY, adminKick(P2, "yes")],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "2",
      },
    },
    // Rejoining keeps the seat.
    {
      name: "a player who left during the game gets their seat and score back",
      actions: [...UNDERWAY, leave(P2), join(P2)],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "1",
      },
    },
    {
      name: "a player removed by the admin gets their seat and score back",
      actions: [...UNDERWAY, adminKick(P2), join(P2)],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "1",
      },
    },
    {
      name: "a Join for a seated player doesn't reset their score",
      actions: [...UNDERWAY, join(P2)],
      expected: {
        players: { 1: 0, 2: 200, 3: 0 },
        left: {},
        boardControl: "2",
      },
    },
    {
      name: "someone else's Join doesn't touch a seat",
      actions: [...UNDERWAY, join({ userId: "4", name: "Player 2" })],
      expected: {
        players: { 1: 0, 2: 200, 3: 0, 4: 0 },
        left: {},
        boardControl: "2",
      },
    },
    {
      name: "a player kicked before the game joins again from scratch",
      actions: [join(P1), join(P2), kick(P2), join(P2)],
      expected: { players: { 1: 0, 2: 0 }, left: {}, boardControl: "1" },
    },
  ];

  for (const tc of testCases) {
    it(tc.name, () => {
      expect(seats(run(tc.actions))).toEqual(tc.expected);
    });
  }

  it("rejoining restores color, avatar and team; the name comes from the new Join", () => {
    const state = run([
      join(P1),
      join(P2, { color: RED, avatar: SMILE, team: "red" }),
      join(P3),
      start,
      ...P2_SCORES_200,
      leave(P2),
      join({ ...P2, name: "Back again" }, { color: "#2563eb", team: "blue" }),
    ]);
    expect(state.players.get(P2.userId)).toEqual({
      userId: P2.userId,
      name: "Back again",
      color: RED,
      avatar: SMILE,
      team: "red",
      score: 200,
    });
    expect(state.leftPlayers.size).toBe(0);
  });

  it("joining after game over is still ignored, even for a returning player", () => {
    const left = run([...UNDERWAY, leave(P2)]);
    const over = { ...left, type: GameState.GameOver };
    expect(seats(run([join(P2)], over))).toEqual(seats(over));
  });

  it("old kick events replay unchanged", () => {
    const events: DbRoomEvent[] = [
      [ActionType.Join, P1],
      [ActionType.Join, P2],
      [ActionType.Join, P3],
      [ActionType.Kick, P3],
      [ActionType.StartRound, { round: 0, userId: P1.userId }],
      [ActionType.ChooseClue, { userId: P1.userId, i: 0, j: 0 }],
      [ActionType.Kick, P2],
    ].map(([type, payload], id) => ({
      id,
      room_id: 1,
      ts: new Date(Date.UTC(2026, 0, 1, 0, 0, id)).toISOString().slice(0, -1),
      type: type as string,
      payload,
    }));
    const state = applyRoomEventsToState(initialState, events);
    expect(seats(state)).toEqual({
      players: { 1: 0, 2: 0 },
      left: {},
      boardControl: "1",
    });
  });
});
