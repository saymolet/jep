import { produce } from "immer";
import { describe, expect, it } from "vitest";

import { MOCK_GAME } from "~/models/mock.server";
import type { DbRoomEvent } from "~/models/room-event.server";
import { MAX_TEAM_NAME_LENGTH } from "~/models/team";

import type { Action } from "./engine";
import { ActionType, CLUE_TIMEOUT_MS, gameEngine } from "./engine";
import { applyRoomEventsToState } from "./room-event";
import { GameState, type Player, type State, stateFromGame } from "./state";
import {
  countTeamMembers,
  getTeamStandings,
  getWinningTeams,
  isTeamMode,
} from "./teams";

type TestAction = Omit<Action, "ts"> & { ts?: number };

const P1 = { userId: "1", name: "Player 1" };
const P2 = { userId: "2", name: "Player 2" };
const P3 = { userId: "3", name: "Player 3" };

const initialState = stateFromGame(MOCK_GAME);

const join = (p: typeof P1, team?: unknown): TestAction => ({
  type: ActionType.Join,
  payload: team === undefined ? p : { ...p, team },
});
const setTeam = (userId: string, team: unknown): TestAction => ({
  type: ActionType.SetTeam,
  payload: { userId, team },
});
const rename = (userId: string, team: string, name: string): TestAction => ({
  type: ActionType.RenameTeam,
  payload: { userId, team, name },
});
const start: TestAction = {
  type: ActionType.StartRound,
  payload: { round: 0, userId: P1.userId },
};
const choose = (i: number, j: number): TestAction => ({
  type: ActionType.ChooseClue,
  payload: { userId: P1.userId, i, j },
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
const kick = (p: typeof P1): TestAction => ({
  type: ActionType.Kick,
  payload: p,
});

/** P1 answers the first $200 question right (P2 doesn't buzz). */
const P1_SCORES_200: TestAction[] = [
  start,
  choose(0, 0),
  buzz(P1.userId, 0, 0, 100),
  buzz(P2.userId, 0, 0, CLUE_TIMEOUT_MS + 1),
  check(P1.userId, 0, 0, true),
  next(P1.userId, 0, 0),
];

function run(actions: TestAction[], state: State = initialState) {
  return actions.reduce(
    (s, action) => gameEngine(s, { ts: 0, ...action }),
    state,
  );
}

function teams(state: State) {
  return {
    players: Object.fromEntries(
      Array.from(state.players.values(), (p) => [p.userId, p.team ?? null]),
    ),
    names: Object.fromEntries(state.teamNames),
  };
}

describe("team engine", () => {
  interface TestCase {
    name: string;
    actions: TestAction[];
    expected: ReturnType<typeof teams>;
  }

  const testCases: TestCase[] = [
    {
      name: "players have no team by default",
      actions: [join(P1), join(P2)],
      expected: { players: { 1: null, 2: null }, names: {} },
    },
    {
      name: "a player joins with a team",
      actions: [join(P1, "red"), join(P2)],
      expected: { players: { 1: "red", 2: null }, names: {} },
    },
    {
      name: "an unknown team on join is ignored (replay of a forged event)",
      actions: [join(P1, "purple")],
      expected: { players: { 1: null }, names: {} },
    },
    {
      name: "a player picks, switches and clears their team",
      actions: [
        join(P1),
        join(P2),
        setTeam(P1.userId, "blue"),
        setTeam(P2.userId, "blue"),
        setTeam(P2.userId, "green"),
        setTeam(P1.userId, null),
      ],
      expected: { players: { 1: null, 2: "green" }, names: {} },
    },
    {
      name: "SetTeam for someone not in the game is ignored",
      actions: [join(P1), setTeam(P3.userId, "red")],
      expected: { players: { 1: null }, names: {} },
    },
    {
      name: "a member renames their team (trimmed, spaces collapsed)",
      actions: [join(P1, "red"), rename(P1.userId, "red", "  The   Foxes ")],
      expected: { players: { 1: "red" }, names: { red: "The Foxes" } },
    },
    {
      name: "a blank name resets the default name",
      actions: [
        join(P1, "red"),
        rename(P1.userId, "red", "Foxes"),
        rename(P1.userId, "red", "   "),
      ],
      expected: { players: { 1: "red" }, names: {} },
    },
    {
      name: "a non-member can't rename a team",
      actions: [
        join(P1, "red"),
        join(P2, "blue"),
        rename(P2.userId, "red", "Losers"),
      ],
      expected: { players: { 1: "red", 2: "blue" }, names: {} },
    },
    {
      name: "a name that is too long is ignored",
      actions: [
        join(P1, "red"),
        rename(P1.userId, "red", "x".repeat(MAX_TEAM_NAME_LENGTH + 1)),
      ],
      expected: { players: { 1: "red" }, names: {} },
    },
    {
      name: "the longest name counts characters, not UTF-16 units",
      actions: [
        join(P1, "red"),
        rename(P1.userId, "red", "🦊".repeat(MAX_TEAM_NAME_LENGTH)),
      ],
      expected: {
        players: { 1: "red" },
        names: { red: "🦊".repeat(MAX_TEAM_NAME_LENGTH) },
      },
    },
    {
      name: "a team's name is forgotten when its last member moves away",
      actions: [
        join(P1, "red"),
        join(P2, "red"),
        rename(P1.userId, "red", "Foxes"),
        setTeam(P1.userId, "blue"),
        rename(P1.userId, "blue", "Owls"),
        setTeam(P2.userId, null),
      ],
      expected: { players: { 1: "blue", 2: null }, names: { blue: "Owls" } },
    },
    {
      name: "a kicked player's team name is forgotten",
      actions: [
        join(P1),
        join(P2, "red"),
        rename(P2.userId, "red", "Foxes"),
        kick(P2),
      ],
      expected: { players: { 1: null }, names: {} },
    },
    {
      name: "a left player keeps their team and its name",
      actions: [
        join(P1),
        join(P2, "red"),
        rename(P2.userId, "red", "Foxes"),
        leave(P2),
      ],
      expected: { players: { 1: null }, names: { red: "Foxes" } },
    },
    {
      name: "teams can change between questions",
      actions: [
        join(P1),
        join(P2),
        ...P1_SCORES_200,
        setTeam(P1.userId, "red"),
      ],
      expected: { players: { 1: "red", 2: null }, names: {} },
    },
    {
      name: "teams can't change while a question is open",
      actions: [
        join(P1),
        join(P2),
        start,
        choose(0, 0),
        setTeam(P1.userId, "red"),
      ],
      expected: { players: { 1: null, 2: null }, names: {} },
    },
    {
      name: "renaming works while a question is open",
      actions: [
        join(P1, "red"),
        join(P2),
        start,
        choose(0, 0),
        rename(P1.userId, "red", "Foxes"),
      ],
      expected: { players: { 1: "red", 2: null }, names: { red: "Foxes" } },
    },
    {
      name: "teams can change while paused",
      actions: [
        join(P1),
        { type: ActionType.TogglePause },
        setTeam(P1.userId, "yellow"),
      ],
      expected: { players: { 1: "yellow" }, names: {} },
    },
    {
      name: "the team moves along when a guest signs in (TransferPlayer)",
      actions: [
        join(P1, "green"),
        {
          type: ActionType.TransferPlayer,
          payload: { oldUserId: P1.userId, newUserId: "acct" },
        },
      ],
      expected: { players: { acct: "green" }, names: {} },
    },
  ];

  for (const tc of testCases) {
    it(tc.name, () => {
      expect(teams(run(tc.actions))).toStrictEqual(tc.expected);
    });
  }

  it("rejects an unknown team in SetTeam (invalid payload)", () => {
    expect(() => run([join(P1), setTeam(P1.userId, "pink")])).toThrow(
      /SetTeam/,
    );
  });

  it("ignores team changes and renames after game over", () => {
    const over = produce(run([join(P1, "red")]), (draft) => {
      draft.type = GameState.GameOver;
    });
    const after = run(
      [setTeam(P1.userId, "blue"), rename(P1.userId, "red", "Foxes")],
      over,
    );
    expect(teams(after)).toStrictEqual({ players: { 1: "red" }, names: {} });
  });

  it("does not change scoring: points stay per player", () => {
    const state = run([join(P1, "red"), join(P2, "red"), ...P1_SCORES_200]);
    expect(state.players.get(P1.userId)?.score).toBe(200);
    expect(state.players.get(P2.userId)?.score).toBe(0);
  });

  it("replays team events from room events (and old events without teams)", () => {
    const payloads: [ActionType, object][] = [
      [ActionType.Join, P1],
      [ActionType.Join, { ...P2, team: "blue" }],
      [ActionType.SetTeam, { userId: P1.userId, team: "red" }],
      [
        ActionType.RenameTeam,
        { userId: P1.userId, team: "red", name: "Foxes" },
      ],
    ];
    const events: DbRoomEvent[] = payloads.map(([type, payload], k) => ({
      id: k + 1,
      room_id: 1,
      ts: `2026-10-25T10:00:0${k + 1}`,
      type,
      payload: JSON.parse(JSON.stringify(payload)),
    }));
    const state = applyRoomEventsToState(stateFromGame(MOCK_GAME), events);
    expect(teams(state)).toStrictEqual({
      players: { 1: "red", 2: "blue" },
      names: { red: "Foxes" },
    });
  });
});

describe("team standings", () => {
  const player = (
    userId: string,
    score: number,
    team?: Player["team"],
  ): Player => ({
    userId,
    name: `P${userId}`,
    score,
    ...(team ? { team } : {}),
  });
  const map = (...players: Player[]) =>
    new Map(players.map((p) => [p.userId, p]));

  it("is off until someone has a team", () => {
    expect(
      isTeamMode({ players: map(player("1", 0)), leftPlayers: map() }),
    ).toBe(false);
    expect(
      isTeamMode({ players: map(player("1", 0, "red")), leftPlayers: map() }),
    ).toBe(true);
    expect(
      isTeamMode({ players: map(), leftPlayers: map(player("1", 0, "red")) }),
    ).toBe(true);
  });

  it("sums members, counts leavers, sorts by total and keeps solo players out", () => {
    const standings = getTeamStandings({
      players: map(
        player("1", 200, "blue"),
        player("2", 400, "blue"),
        player("3", 1000, "red"),
        player("4", 5000),
      ),
      leftPlayers: map(player("5", -300, "red"), player("6", 100, "green")),
      teamNames: new Map([["blue", "Owls"]]),
    });
    expect(
      standings.map((s) => [s.team, s.name ?? null, s.score]),
    ).toStrictEqual([
      ["red", null, 700],
      ["blue", "Owls", 600],
      ["green", null, 100],
    ]);
    expect(standings[1].members.map((p) => p.userId)).toStrictEqual(["2", "1"]);
    expect(standings[0].leftMembers.map((p) => p.userId)).toStrictEqual(["5"]);
    expect(standings[2].members).toStrictEqual([]);
  });

  it("keeps the fixed team order on equal totals and reports ties", () => {
    const standings = getTeamStandings({
      players: map(player("1", 300, "yellow"), player("2", 300, "red")),
      leftPlayers: map(),
    });
    expect(standings.map((s) => s.team)).toStrictEqual(["red", "yellow"]);
    expect(getWinningTeams(standings).map((s) => s.team)).toStrictEqual([
      "red",
      "yellow",
    ]);
    expect(getWinningTeams([])).toStrictEqual([]);
  });

  it("counts current members", () => {
    const players = map(player("1", 0, "red"), player("2", 0, "red"));
    expect(countTeamMembers(players, "red")).toBe(2);
    expect(countTeamMembers(players, "blue")).toBe(0);
  });
});
