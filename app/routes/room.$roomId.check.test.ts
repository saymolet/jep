import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionType } from "~/engine";
import type { DbRoomEvent } from "~/models/room-event.server";

const USER = "user-1";

const mocks = vi.hoisted(() => ({
  createRoomEventAsServer: vi.fn(),
  getAdmin: vi.fn(),
  getRoomEvents: vi.fn(),
  getRoom: vi.fn(),
  getGame: vi.fn(),
  getValidAuthSession: vi.fn(),
}));

vi.mock("~/models/auth", () => ({
  getValidAuthSession: mocks.getValidAuthSession,
}));
vi.mock("~/models/room-event.server", () => ({
  createRoomEventAsServer: mocks.createRoomEventAsServer,
  getRoomEvents: mocks.getRoomEvents,
}));
vi.mock("~/admin/auth.server", () => ({ getAdmin: mocks.getAdmin }));
vi.mock("~/models/room.server", () => ({ getRoom: mocks.getRoom }));
vi.mock("~/models/game.server", () => ({ getGame: mocks.getGame }));
vi.mock("~/session.server", () => ({
  requireSessionUserId: async (_request: Request, claimedUserId: string) => {
    if (claimedUserId !== USER) {
      throw new Response("userId does not match session", { status: 403 });
    }
  },
}));

import { getMockGame } from "~/models/mock.server";

import { action } from "./room.$roomId.check";

const ROOM = { id: 5, name: "word", game_id: "mock-choice" };

/** Room events that put USER on the (0, 0) multiple choice question (correct
 * option: 1) as the winning buzzer. */
function eventsUntilBuzz(): DbRoomEvent[] {
  const payloads: [ActionType, object][] = [
    [ActionType.Join, { userId: USER, name: "P1" }],
    [ActionType.StartRound, { round: 0, userId: USER }],
    [ActionType.ChooseClue, { userId: USER, i: 0, j: 0 }],
    [ActionType.Buzz, { userId: USER, i: 0, j: 0, deltaMs: 100 }],
  ];
  return payloads.map(([type, payload], k) => ({
    id: k + 1,
    room_id: ROOM.id,
    ts: `2026-10-25T10:00:0${k + 1}`,
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  }));
}

function request(fields: Record<string, string>) {
  return new Request("http://localhost/room/5/check", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}

async function callAction(roomId: string, fields: Record<string, string>) {
  const req = request(fields);
  return action({
    request: req,
    url: new URL(req.url),
    pattern: "/room/:roomId/check",
    params: { roomId },
    context: new RouterContextProvider(),
  });
}

describe("check route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getValidAuthSession.mockResolvedValue(null);
    mocks.getRoom.mockResolvedValue(ROOM);
    mocks.getGame.mockResolvedValue(await getMockGame("choice"));
    mocks.getRoomEvents.mockResolvedValue(eventsUntilBuzz());
  });

  it("marks a pick correct from the game data, ignoring the client", async () => {
    await callAction("5", {
      i: "0",
      j: "0",
      userId: USER,
      choice: "1",
      result: "incorrect",
    });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Check,
      { i: 0, j: 0, userId: USER, correct: true, choice: 1 },
    );
  });

  it("marks a wrong pick incorrect even if the client says correct", async () => {
    await callAction("5", {
      i: "0",
      j: "0",
      userId: USER,
      choice: "0",
      result: "correct",
    });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Check,
      { i: 0, j: 0, userId: USER, correct: false, choice: 0 },
    );
  });

  it("rejects a pick that is not one of the options", async () => {
    await expect(
      callAction("5", { i: "0", j: "0", userId: USER, choice: "9" }),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("rejects a pick on a question without choices", async () => {
    // (0, 1) is a normal question.
    await expect(
      callAction("5", { i: "0", j: "1", userId: USER, choice: "0" }),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("rejects a check on behalf of another player", async () => {
    await expect(
      callAction("5", { i: "0", j: "0", userId: "someone-else", choice: "1" }),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("keeps the self-check for normal questions", async () => {
    await callAction("5", { i: "0", j: "1", userId: USER, result: "correct" });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Check,
      { i: 0, j: 1, userId: USER, correct: true },
    );
    expect(mocks.getGame).not.toHaveBeenCalled();
  });

  it("returns the pick for solo play (the engine checks it)", async () => {
    const result = await callAction("-1", {
      i: "0",
      j: "0",
      userId: USER,
      choice: "1",
    });
    expect(result).toMatchObject({
      type: ActionType.Check,
      payload: { i: 0, j: 0, userId: USER, choice: 1 },
    });
  });

  it("records a timeout as a wrong answer without a pick", async () => {
    await callAction("5", {
      i: "0",
      j: "0",
      userId: USER,
      result: "correct",
      timedOut: "true",
    });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.Check,
      { i: 0, j: 0, userId: USER, correct: false, timedOut: true },
    );
  });

  it("returns a timeout for solo play", async () => {
    const result = await callAction("-1", {
      i: "0",
      j: "1",
      userId: USER,
      result: "incorrect",
      timedOut: "true",
    });
    expect(result).toMatchObject({
      type: ActionType.Check,
      payload: { i: 0, j: 1, userId: USER, correct: false, timedOut: true },
    });
  });
});
