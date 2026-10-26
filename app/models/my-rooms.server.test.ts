import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionType } from "~/engine";
import type { Game } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";

type RoomRow = {
  room_id: number;
  room_name: string;
  game_id: string;
  last_activity: string;
};

interface FakeDb {
  rooms: RoomRow[];
  events: Map<number, DbRoomEvent[]>;
  games: Map<string, Game>;
  rpcError: { message: string } | null;
  rpcCalls: { fn: string; args: unknown }[];
  getSupabase: ReturnType<typeof vi.fn>;
  getGame: ReturnType<typeof vi.fn>;
}

const db = vi.hoisted(() => {
  const state: FakeDb = {
    rooms: [],
    events: new Map(),
    games: new Map(),
    rpcError: null,
    rpcCalls: [],
    getSupabase: vi.fn(),
    getGame: vi.fn(),
  };
  return state;
});

vi.mock("varlock/env", () => ({
  ENV: { SUPABASE_URL: "http://127.0.0.1:54321" },
}));
vi.mock("~/supabase/admin.server", () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("~/supabase", () => ({ getSupabase: db.getSupabase }));
vi.mock("~/models/game.server", () => ({ getGame: db.getGame }));

import { MOCK_GAME } from "~/models/mock.server";

import { MAX_MY_ROOM_CANDIDATES, MAX_MY_ROOMS } from "./my-rooms";
import { getMyRoomsInProgress } from "./my-rooms.server";

const NOW = Date.parse("2026-10-25T12:00:00Z");

/** A fake of the Supabase calls: the rpc and getRoomEvents' select. */
function fakeClient() {
  const ok = (data: unknown) => Promise.resolve({ data, error: null });
  return {
    rpc: (fn: string, args: unknown) => {
      db.rpcCalls.push({ fn, args });
      return db.rpcError
        ? Promise.resolve({ data: null, error: db.rpcError })
        : ok(db.rooms);
    },
    from: (table: string) => {
      expect(table).toBe("room_events");
      return {
        select: () => ({
          order: () => ({
            eq: (_column: string, roomId: number) =>
              ok(db.events.get(roomId) ?? []),
          }),
        }),
      };
    },
  };
}

let nextId = 1;
function event(
  roomId: number,
  type: string,
  payload: DbRoomEvent["payload"],
): DbRoomEvent {
  return {
    id: nextId++,
    room_id: roomId,
    ts: "2026-10-25T11:00:00",
    type,
    payload,
  };
}

/** Adds a room where `players` joined (no question played yet). */
function addRoom(id: number, players: string[], gameId = "g1") {
  db.rooms.push({
    room_id: id,
    room_name: `word${id}`,
    game_id: gameId,
    last_activity: "2026-10-25T11:00:00",
  });
  db.events.set(
    id,
    players.map((userId) =>
      event(id, ActionType.Join, { userId, name: userId.toUpperCase() }),
    ),
  );
}

describe("getMyRoomsInProgress", () => {
  beforeEach(() => {
    db.rooms = [];
    db.events.clear();
    db.games = new Map([["g1", MOCK_GAME]]);
    db.rpcError = null;
    db.rpcCalls = [];
    db.getSupabase.mockReset().mockImplementation(fakeClient);
    db.getGame
      .mockReset()
      .mockImplementation(async (id: string) => db.games.get(id) ?? null);
  });

  it("asks for the user's own ids, the last 7 days, a bounded number", async () => {
    addRoom(1, ["guest", "other"]);
    const rooms = await getMyRoomsInProgress(["acct", "guest", "acct", null], {
      accessToken: "token",
      accountId: "acct",
      now: NOW,
    });
    expect(db.rpcCalls).toEqual([
      {
        fn: "user_rooms_in_progress",
        args: {
          user_ids: ["acct", "guest"],
          since: "2026-10-18T12:00:00.000Z",
          max_count: MAX_MY_ROOM_CANDIDATES,
        },
      },
    ]);
    // The user's token (row-level security) and account (private games).
    expect(db.getSupabase).toHaveBeenCalledWith("token");
    expect(db.getGame).toHaveBeenCalledWith("g1", "acct");
    expect(rooms.map((r) => r.roomName)).toEqual(["1-word1"]);
    expect(rooms[0].players.map((p) => p.name)).toEqual(["GUEST", "OTHER"]);
  });

  it("makes no query without an id", async () => {
    expect(await getMyRoomsInProgress([null, undefined, ""])).toEqual([]);
    expect(db.rpcCalls).toEqual([]);
  });

  it("drops rooms the user left, finished games and games they can't open", async () => {
    addRoom(1, ["me"]);
    addRoom(2, ["me", "other"]);
    db.events.get(2)!.push(event(2, ActionType.Leave, { userId: "me" }));
    addRoom(3, ["me"], "private");
    addRoom(4, ["me"]);
    db.events
      .get(4)!
      .push(event(4, ActionType.StartRound, { round: 0, userId: "me" }));
    // Room 5: a one-question game played to the end.
    const oneClue: Game = {
      ...MOCK_GAME,
      boards: [
        {
          categoryNames: ["C"],
          categories: [
            { name: "C", clues: [{ clue: "Q", answer: "A", value: 200 }] },
          ],
        },
      ],
    };
    db.games.set("short", oneClue);
    addRoom(5, ["me"], "short");
    const c = { userId: "me", i: 0, j: 0 };
    db.events
      .get(5)!
      .push(
        event(5, ActionType.StartRound, { round: 0, userId: "me" }),
        event(5, ActionType.ChooseClue, c),
        event(5, ActionType.Buzz, { ...c, deltaMs: 100 }),
        event(5, ActionType.Check, { ...c, correct: true }),
        event(5, ActionType.NextClue, c),
      );

    const rooms = await getMyRoomsInProgress(["me"], { now: NOW });
    expect(rooms.map((r) => r.id)).toEqual([1, 4]);
    // Each game is loaded once.
    expect(db.getGame.mock.calls.filter(([id]) => id === "g1")).toHaveLength(1);
  });

  it("lists at most MAX_MY_ROOMS rooms", async () => {
    for (let id = 1; id <= MAX_MY_ROOMS + 3; id++) addRoom(id, ["me"]);
    const rooms = await getMyRoomsInProgress(["me"], { now: NOW });
    expect(rooms.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("returns no rooms instead of failing the page on a database error", async () => {
    db.rpcError = { message: "function does not exist" };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(await getMyRoomsInProgress(["me"], { now: NOW })).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
