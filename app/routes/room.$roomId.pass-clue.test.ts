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
  requireSessionUserId: async (_request: Request, claimedUserId: string) => {
    if (claimedUserId !== USER) {
      throw new Response("userId does not match session", { status: 403 });
    }
  },
}));

import { getMockGame } from "~/models/mock.server";

import { action } from "./room.$roomId.pass-clue";

const ROOM = { id: 5, name: "word", game_id: "mock-secret" };

/** Room events where `chooser` (with board control) chose the secret question
 * at (1, 0). */
function events(chooser = USER): DbRoomEvent[] {
  const other = chooser === USER ? OTHER : USER;
  const payloads: [ActionType, object][] = [
    [ActionType.Join, { userId: chooser, name: "Chooser" }],
    [ActionType.Join, { userId: other, name: "Other" }],
    [ActionType.StartRound, { round: 0, userId: chooser }],
    [ActionType.ChooseClue, { userId: chooser, i: 1, j: 0 }],
  ];
  return payloads.map(([type, payload], k) => ({
    id: k + 1,
    room_id: ROOM.id,
    ts: `2026-10-25T10:00:0${k + 1}`,
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  }));
}

async function callAction(roomId: string, fields: Record<string, string>) {
  const req = new Request(`http://localhost/room/${roomId}/pass-clue`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  return action({
    request: req,
    url: new URL(req.url),
    pattern: "/room/:roomId/pass-clue",
    params: { roomId },
    context: new RouterContextProvider(),
  });
}

describe("pass-clue route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getValidAuthSession.mockResolvedValue(null);
    mocks.getRoom.mockResolvedValue(ROOM);
    mocks.getGame.mockResolvedValue(await getMockGame("secret"));
    mocks.getRoomEvents.mockResolvedValue(events());
  });

  it("gives the secret question to another player", async () => {
    await callAction("5", { i: "1", j: "0", userId: USER, toUserId: OTHER });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.PassClue,
      { i: 1, j: 0, userId: USER, toUserId: OTHER },
      undefined,
    );
  });

  it("rejects a pass on behalf of another player", async () => {
    await expect(
      callAction("5", { i: "1", j: "0", userId: OTHER, toUserId: USER }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("rejects a pass by a player without board control", async () => {
    mocks.getRoomEvents.mockResolvedValue(events(OTHER));
    await expect(
      callAction("5", { i: "1", j: "0", userId: USER, toUserId: OTHER }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["the chooser", USER],
    ["someone not in the game", "nobody"],
  ])("rejects passing to %s", async (_name, toUserId) => {
    await expect(
      callAction("5", { i: "1", j: "0", userId: USER, toUserId }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("rejects passing a question that is not being passed", async () => {
    await expect(
      callAction("5", { i: "0", j: "0", userId: USER, toUserId: OTHER }),
    ).rejects.toMatchObject({ status: 400 });
    mocks.getRoomEvents.mockResolvedValue(events().slice(0, 3));
    await expect(
      callAction("5", { i: "1", j: "0", userId: USER, toUserId: OTHER }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("returns the action for solo play", async () => {
    const result = await callAction("-1", {
      i: "1",
      j: "0",
      userId: USER,
      toUserId: OTHER,
    });
    expect(result).toMatchObject({
      type: ActionType.PassClue,
      payload: { i: 1, j: 0, userId: USER, toUserId: OTHER },
    });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });
});
