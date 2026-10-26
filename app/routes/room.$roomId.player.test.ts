import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionType, CLUE_TIMEOUT_MS } from "~/engine";
import type { DbRoomEvent } from "~/models/room-event.server";

const ME = "user-1";
const OTHER = "user-2";
const THIRD = "user-3";

const mocks = vi.hoisted(() => ({
  createRoomEvent: vi.fn(),
  createRoomEventAsServer: vi.fn(),
  getAdmin: vi.fn(),
  getRoomEvents: vi.fn(),
  getRoom: vi.fn(),
  getGame: vi.fn(),
  getUserSession: vi.fn(),
}));

vi.mock("~/models/auth", () => ({
  getValidAuthSession: async () => null,
}));
vi.mock("~/admin/auth.server", () => ({ getAdmin: mocks.getAdmin }));
vi.mock("~/models/room-event.server", () => ({
  createRoomEvent: mocks.createRoomEvent,
  createRoomEventAsServer: mocks.createRoomEventAsServer,
  getRoomEvents: mocks.getRoomEvents,
}));
vi.mock("~/models/room.server", () => ({ getRoom: mocks.getRoom }));
vi.mock("~/models/game.server", () => ({ getGame: mocks.getGame }));
vi.mock("~/models/solves.server", () => ({
  getSolve: vi.fn(),
  markAttempted: vi.fn(),
}));
vi.mock("~/session.server", () => ({
  getUserSession: mocks.getUserSession,
  // The session belongs to ME: claiming any other userId is refused.
  requireSessionUserId: async (_request: Request, claimedUserId: string) => {
    if (claimedUserId !== ME) {
      throw new Response("userId does not match session", { status: 403 });
    }
  },
}));

import { MOCK_GAME } from "~/models/mock.server";

import { action } from "./room.$roomId.player";

const ROOM = { id: 5, name: "word", game_id: "mock" };

function toEvents(payloads: [ActionType, object][]): DbRoomEvent[] {
  return payloads.map(([type, payload], k) => ({
    id: k + 1,
    room_id: ROOM.id,
    ts: `2026-10-26T10:00:${String(k + 1).padStart(2, "0")}`,
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  }));
}

const LOBBY: [ActionType, object][] = [
  [ActionType.Join, { userId: ME, name: "Me" }],
  [ActionType.Join, { userId: OTHER, name: "Other" }],
  [ActionType.Join, { userId: THIRD, name: "Third" }],
];
const BOARD: [ActionType, object][] = [
  ...LOBBY,
  [ActionType.StartRound, { round: 0, userId: ME }],
];
const QUESTION_OPEN: [ActionType, object][] = [
  ...BOARD,
  [ActionType.ChooseClue, { userId: ME, i: 0, j: 0 }],
];
const UNDERWAY: [ActionType, object][] = [
  ...QUESTION_OPEN,
  [ActionType.Buzz, { userId: ME, i: 0, j: 0, deltaMs: 100 }],
  [
    ActionType.Buzz,
    { userId: OTHER, i: 0, j: 0, deltaMs: CLUE_TIMEOUT_MS + 1 },
  ],
  [
    ActionType.Buzz,
    { userId: THIRD, i: 0, j: 0, deltaMs: CLUE_TIMEOUT_MS + 1 },
  ],
  [ActionType.Check, { userId: ME, i: 0, j: 0, correct: true }],
  [ActionType.NextClue, { userId: ME, i: 0, j: 0 }],
];

async function call(
  method: string,
  fields: Record<string, string>,
  roomId = "5",
) {
  const req = new Request(`http://localhost/room/${roomId}/player`, {
    method,
    body: new URLSearchParams(fields),
  });
  return action({
    request: req,
    url: new URL(req.url),
    pattern: "/room/:roomId/player",
    params: { roomId },
    context: new RouterContextProvider(),
  });
}

async function rejection(promise: Promise<unknown>) {
  const response = await promise.catch((e: unknown) => e);
  if (!(response instanceof Response)) {
    throw new Error("expected a Response to be thrown");
  }
  return { status: response.status, text: await response.text() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserSession.mockResolvedValue(ME);
  mocks.getRoom.mockResolvedValue(ROOM);
  mocks.getGame.mockResolvedValue(MOCK_GAME);
  mocks.getRoomEvents.mockResolvedValue(toEvents(LOBBY));
  mocks.getAdmin.mockResolvedValue(null);
});

describe("player route: kick", () => {
  it.each([
    ["the first round's preview", LOBBY],
    ["the first board before any question", BOARD],
  ])("a player may kick another in %s", async (_name, events) => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(events));
    await call("DELETE", { userId: OTHER, name: "Other" });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Kick,
      { userId: OTHER, name: "Other", color: undefined },
    );
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["a question is open", QUESTION_OPEN],
    ["the game is underway", UNDERWAY],
  ])("a player may not kick once %s (403)", async (_name, events) => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(events));
    const { status, text } = await rejection(
      call("DELETE", { userId: OTHER, name: "Other" }),
    );
    expect(status).toBe(403);
    expect(text).toMatch(/only the admin can kick/);
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("answers in Ukrainian", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(UNDERWAY));
    const req = new Request("http://localhost/room/5/player", {
      method: "DELETE",
      headers: { "Accept-Language": "uk" },
      body: new URLSearchParams({ userId: OTHER, name: "Other" }),
    });
    const { status, text } = await rejection(
      action({
        request: req,
        url: new URL(req.url),
        pattern: "/room/:roomId/player",
        params: { roomId: "5" },
        context: new RouterContextProvider(),
      }),
    );
    expect(status).toBe(403);
    expect(text).toMatch(/лише адміністратор/);
  });

  it("someone who doesn't play may not kick before the game (403)", async () => {
    mocks.getUserSession.mockResolvedValue("spectator");
    const { status } = await rejection(
      call("DELETE", { userId: OTHER, name: "Other" }),
    );
    expect(status).toBe(403);
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("the admin kicks during the game, tagged admin", async () => {
    mocks.getAdmin.mockResolvedValue({ until: Infinity, key: "k", csrf: "c" });
    mocks.getUserSession.mockResolvedValue("admin-watching");
    mocks.getRoomEvents.mockResolvedValue(toEvents(UNDERWAY));
    await call("DELETE", { userId: OTHER, name: "Other" });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Kick,
      { userId: OTHER, name: "Other", color: undefined, admin: true },
    );
  });

  it("the admin can't kick while a question is open (409)", async () => {
    mocks.getAdmin.mockResolvedValue({ until: Infinity, key: "k", csrf: "c" });
    mocks.getRoomEvents.mockResolvedValue(toEvents(QUESTION_OPEN));
    const { status } = await rejection(
      call("DELETE", { userId: OTHER, name: "Other" }),
    );
    expect(status).toBe(409);
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });
});

describe("player route: leave and join", () => {
  it("leaving (your own seat) goes through the server at any stage", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(UNDERWAY));
    await call("DELETE", { userId: ME, name: "Me" });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Leave,
      { userId: ME, name: "Me", color: undefined },
    );
    // No game replay is needed to leave.
    expect(mocks.getRoomEvents).not.toHaveBeenCalled();
  });

  it("joining is still a normal insert, only as yourself", async () => {
    await call("POST", { userId: ME, name: "Me" });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Join,
      { userId: ME, name: "Me", color: undefined },
      undefined,
    );
    await expect(
      call("POST", { userId: OTHER, name: "Other" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("solo play returns the Kick action without any checks", async () => {
    const result = await call("DELETE", { userId: OTHER, name: "Other" }, "-1");
    expect(result).toMatchObject({ type: ActionType.Kick });
    expect(mocks.getAdmin).not.toHaveBeenCalled();
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });
});
