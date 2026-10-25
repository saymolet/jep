import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionType } from "~/engine";
import type { DbRoomEvent } from "~/models/room-event.server";

const USER = "user-1";
const OTHER = "user-2";

const mocks = vi.hoisted(() => ({
  createRoomEvent: vi.fn(),
  getRoomEvents: vi.fn(),
  getRoom: vi.fn(),
  getGame: vi.fn(),
  getValidAuthSession: vi.fn(),
}));

vi.mock("~/models/auth", () => ({
  getValidAuthSession: mocks.getValidAuthSession,
}));
vi.mock("~/models/room-event.server", () => ({
  createRoomEvent: mocks.createRoomEvent,
  getRoomEvents: mocks.getRoomEvents,
}));
vi.mock("~/models/room.server", () => ({ getRoom: mocks.getRoom }));
vi.mock("~/models/game.server", () => ({ getGame: mocks.getGame }));
vi.mock("~/session.server", () => ({
  // The session belongs to USER: claiming any other userId is refused.
  requireSessionUserId: async (_request: Request, claimedUserId: string) => {
    if (claimedUserId !== USER) {
      throw new Response("userId does not match session", { status: 403 });
    }
  },
}));

import { MOCK_GAME } from "~/models/mock.server";

import { action } from "./room.$roomId.settings";

const ROOM = { id: 5, name: "word", game_id: "mock" };

function toEvents(payloads: [ActionType, object][]): DbRoomEvent[] {
  return payloads.map(([type, payload], k) => ({
    id: k + 1,
    room_id: ROOM.id,
    ts: `2026-10-26T10:00:0${k + 1}`,
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  }));
}

const LOBBY: [ActionType, object][] = [
  [ActionType.Join, { userId: USER, name: "Me" }],
  [ActionType.Join, { userId: OTHER, name: "Other" }],
];
const QUESTION_OPEN: [ActionType, object][] = [
  ...LOBBY,
  [ActionType.StartRound, { round: 0, userId: USER }],
  [ActionType.ChooseClue, { userId: USER, i: 0, j: 0 }],
];

async function call(roomId: string, fields: Record<string, string>) {
  const req = new Request(`http://localhost/room/${roomId}/settings`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  return action({
    request: req,
    url: new URL(req.url),
    pattern: "/room/:roomId/settings",
    params: { roomId },
    context: new RouterContextProvider(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getValidAuthSession.mockResolvedValue(null);
  mocks.getRoom.mockResolvedValue(ROOM);
  mocks.getGame.mockResolvedValue(MOCK_GAME);
  mocks.getRoomEvents.mockResolvedValue(toEvents(LOBBY));
});

describe("settings route", () => {
  it("saves the answer timer", async () => {
    await call("5", {
      userId: USER,
      answerTimeSec: "15",
      autoWrongOnTimeout: "false",
    });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.SetSettings,
      { userId: USER, answerTimeSec: 15, autoWrongOnTimeout: false },
      undefined,
    );
  });

  it("turns the timer off with 0", async () => {
    await call("5", {
      userId: USER,
      answerTimeSec: "0",
      autoWrongOnTimeout: "true",
    });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.SetSettings,
      { userId: USER, answerTimeSec: 0, autoWrongOnTimeout: true },
      undefined,
    );
  });

  it.each(["7", "-10", "abc", "3600"])(
    "rejects an answer time of %s",
    async (answerTimeSec) => {
      await expect(
        call("5", { userId: USER, answerTimeSec, autoWrongOnTimeout: "true" }),
      ).rejects.toMatchObject({ status: 400 });
      expect(mocks.createRoomEvent).not.toHaveBeenCalled();
    },
  );

  it("refuses changes on behalf of someone else", async () => {
    await expect(
      call("5", {
        userId: OTHER,
        answerTimeSec: "10",
        autoWrongOnTimeout: "true",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("refuses people who are not playing", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(LOBBY.slice(1)));
    await expect(
      call("5", {
        userId: USER,
        answerTimeSec: "10",
        autoWrongOnTimeout: "true",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("refuses changes while a question is open", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(QUESTION_OPEN));
    await expect(
      call("5", {
        userId: USER,
        answerTimeSec: "10",
        autoWrongOnTimeout: "true",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("returns the action for solo play", async () => {
    const result = await call("-1", {
      userId: USER,
      answerTimeSec: "30",
      autoWrongOnTimeout: "true",
    });
    expect(result).toMatchObject({
      type: ActionType.SetSettings,
      payload: { userId: USER, answerTimeSec: 30, autoWrongOnTimeout: true },
    });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });
});
