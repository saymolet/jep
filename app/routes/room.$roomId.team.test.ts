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

import { action as setTeamAction } from "./room.$roomId.team";
import { action as renameTeamAction } from "./room.$roomId.team-name";

const ROOM = { id: 5, name: "word", game_id: "mock" };

function toEvents(payloads: [ActionType, object][]): DbRoomEvent[] {
  return payloads.map(([type, payload], k) => ({
    id: k + 1,
    room_id: ROOM.id,
    ts: `2026-10-25T10:00:0${k + 1}`,
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  }));
}

/** USER is on the red team, OTHER on the blue team. */
const LOBBY: [ActionType, object][] = [
  [ActionType.Join, { userId: USER, name: "Me", team: "red" }],
  [ActionType.Join, { userId: OTHER, name: "Other", team: "blue" }],
];
const QUESTION_OPEN: [ActionType, object][] = [
  ...LOBBY,
  [ActionType.StartRound, { round: 0, userId: USER }],
  [ActionType.ChooseClue, { userId: USER, i: 0, j: 0 }],
];

async function call(
  action: typeof setTeamAction | typeof renameTeamAction,
  path: string,
  roomId: string,
  fields: Record<string, string>,
) {
  const req = new Request(`http://localhost/room/${roomId}/${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  return action({
    request: req,
    url: new URL(req.url),
    pattern: `/room/:roomId/${path}`,
    params: { roomId },
    context: new RouterContextProvider(),
  });
}
const setTeam = (roomId: string, fields: Record<string, string>) =>
  call(setTeamAction, "team", roomId, fields);
const renameTeam = (roomId: string, fields: Record<string, string>) =>
  call(renameTeamAction, "team-name", roomId, fields);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getValidAuthSession.mockResolvedValue(null);
  mocks.getRoom.mockResolvedValue(ROOM);
  mocks.getGame.mockResolvedValue(MOCK_GAME);
  mocks.getRoomEvents.mockResolvedValue(toEvents(LOBBY));
});

describe("team route", () => {
  it("puts you on a team", async () => {
    await setTeam("5", { userId: USER, team: "green" });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.SetTeam,
      { userId: USER, team: "green" },
      undefined,
    );
  });

  it("takes you off your team with an empty team", async () => {
    await setTeam("5", { userId: USER, team: "" });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.SetTeam,
      { userId: USER, team: null },
      undefined,
    );
  });

  it("refuses to change someone else's team", async () => {
    await expect(
      setTeam("5", { userId: OTHER, team: "red" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("refuses players who are not in the game", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(LOBBY.slice(1)));
    await expect(
      setTeam("5", { userId: USER, team: "red" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("refuses team changes while a question is open", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(QUESTION_OPEN));
    await expect(
      setTeam("5", { userId: USER, team: "blue" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("rejects unknown teams", async () => {
    await expect(
      setTeam("5", { userId: USER, team: "purple" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns the action for solo play", async () => {
    const result = await setTeam("-1", { userId: USER, team: "yellow" });
    expect(result).toMatchObject({
      type: ActionType.SetTeam,
      payload: { userId: USER, team: "yellow" },
    });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });
});

describe("team-name route", () => {
  it("renames your own team (normalized)", async () => {
    await renameTeam("5", { userId: USER, team: "red", name: "  The  Foxes " });
    expect(mocks.createRoomEvent).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.RenameTeam,
      { userId: USER, team: "red", name: "The Foxes" },
      undefined,
    );
  });

  it("refuses to rename a team you are not on", async () => {
    await expect(
      renameTeam("5", { userId: USER, team: "blue", name: "Losers" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("refuses to rename on behalf of someone else", async () => {
    await expect(
      renameTeam("5", { userId: OTHER, team: "blue", name: "Owls" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("rejects names that are too long", async () => {
    await expect(
      renameTeam("5", { userId: USER, team: "red", name: "x".repeat(25) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mocks.createRoomEvent).not.toHaveBeenCalled();
  });

  it("allows renaming while a question is open", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(QUESTION_OPEN));
    await renameTeam("5", { userId: USER, team: "red", name: "Foxes" });
    expect(mocks.createRoomEvent).toHaveBeenCalled();
  });

  it("returns the action for solo play", async () => {
    const result = await renameTeam("-1", {
      userId: USER,
      team: "red",
      name: "Foxes",
    });
    expect(result).toMatchObject({
      type: ActionType.RenameTeam,
      payload: { userId: USER, team: "red", name: "Foxes" },
    });
  });
});
