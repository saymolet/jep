// @vitest-environment node
// (happy-dom hides Set-Cookie on responses, like a browser.)
import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionType } from "~/engine";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  getValidAuthSession: vi.fn(),
  getGame: vi.fn(),
  createRoom: vi.fn(),
  getActiveRooms: vi.fn(),
  createRoomEventAsServer: vi.fn(),
  getLastRoomSettings: vi.fn(),
  setLastRoomSettings: vi.fn(),
  getUserSession: vi.fn(),
}));

vi.mock("~/admin/auth.server", () => ({ getAdmin: mocks.getAdmin }));
vi.mock("~/models/auth", () => ({
  getValidAuthSession: mocks.getValidAuthSession,
}));
vi.mock("~/models/game.server", () => ({ getGame: mocks.getGame }));
vi.mock("~/models/room.server", () => ({
  createRoom: mocks.createRoom,
  getActiveRooms: mocks.getActiveRooms,
}));
vi.mock("~/models/room-event.server", () => ({
  createRoomEventAsServer: mocks.createRoomEventAsServer,
}));
vi.mock("~/session.server", () => ({
  getLastRoomSettings: mocks.getLastRoomSettings,
  setLastRoomSettings: mocks.setLastRoomSettings,
  getUserSession: mocks.getUserSession,
}));

import { action, loader } from "./game_.$gameId.play";

const GAME = { id: "g1", title: "Game" };
const ADMIN = { until: Infinity, key: "k", csrf: "c" };

function args(url: string, init?: RequestInit) {
  const request = new Request(`http://localhost${url}`, init);
  return {
    request,
    url: new URL(request.url),
    pattern: "/game/:gameId/play",
    params: { gameId: "g1" },
    context: new RouterContextProvider(),
  };
}

async function thrown(promise: Promise<unknown>): Promise<Response> {
  const result = await promise.catch((e: unknown) => e);
  if (!(result instanceof Response)) throw new Error("expected a Response");
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdmin.mockResolvedValue(null);
  mocks.getValidAuthSession.mockResolvedValue(null);
  mocks.getGame.mockResolvedValue(GAME);
  mocks.getActiveRooms.mockResolvedValue([]);
  mocks.createRoom.mockResolvedValue("12-word");
  mocks.getLastRoomSettings.mockResolvedValue(null);
  mocks.setLastRoomSettings.mockResolvedValue({ "Set-Cookie": "s=1" });
  mocks.getUserSession.mockResolvedValue("visitor");
});

describe("new room loader", () => {
  it("creates a room with the defaults right away for everyone but the admin", async () => {
    const response = await thrown(loader(args("/game/g1/play")));
    expect(response.headers.get("Location")).toBe("/room/12-word");
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("shows the admin the room timers first (defaults)", async () => {
    mocks.getAdmin.mockResolvedValue(ADMIN);
    const data = await loader(args("/game/g1/play?new"));
    expect(data).toMatchObject({
      kind: "create",
      preview: GAME,
      lastUsed: false,
      settings: {
        answerTimeSec: 0,
        autoWrongOnTimeout: true,
        readTimeSec: null,
        buzzWindowSec: 5,
        finalAnswerTimeSec: 30,
        wagerTimeSec: 0,
      },
    });
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });

  it("pre-fills the admin's last-used timers (invalid values → defaults)", async () => {
    mocks.getAdmin.mockResolvedValue(ADMIN);
    mocks.getLastRoomSettings.mockResolvedValue({
      answerTimeSec: 15,
      autoWrongOnTimeout: false,
      readTimeSec: 0,
      buzzWindowSec: 3,
      finalAnswerTimeSec: 999,
      wagerTimeSec: 15,
    });
    const data = await loader(args("/game/g1/play"));
    expect(data).toMatchObject({
      kind: "create",
      lastUsed: true,
      settings: {
        answerTimeSec: 15,
        autoWrongOnTimeout: false,
        readTimeSec: 0,
        buzzWindowSec: 3,
        finalAnswerTimeSec: 30,
        wagerTimeSec: 15,
      },
    });
  });

  it("still offers the rooms in progress first", async () => {
    mocks.getAdmin.mockResolvedValue(ADMIN);
    mocks.getActiveRooms.mockResolvedValue([{ id: 1 }]);
    const data = await loader(args("/game/g1/play"));
    expect(data).toMatchObject({ kind: "choose" });
  });
});

describe("new room action", () => {
  const form = (fields: Record<string, string>) =>
    args("/game/g1/play", {
      method: "POST",
      body: new URLSearchParams(fields),
    });
  const TIMERS = {
    answerTimeSec: "0",
    autoWrongOnTimeout: "true",
    readTimeSec: "0",
    buzzWindowSec: "3",
    finalAnswerTimeSec: "30",
    wagerTimeSec: "15",
  };

  it("refuses everyone but the admin", async () => {
    const response = await thrown(action(form(TIMERS)));
    expect(response.status).toBe(403);
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });

  it("creates the room with the timers as its first event and remembers them", async () => {
    mocks.getAdmin.mockResolvedValue(ADMIN);
    const response = await thrown(action(form(TIMERS)));
    expect(response.headers.get("Location")).toBe("/room/12-word");
    expect(response.headers.get("Set-Cookie")).toBe("s=1");
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      12,
      ActionType.SetSettings,
      {
        userId: "visitor",
        answerTimeSec: 0,
        autoWrongOnTimeout: true,
        readTimeSec: 0,
        buzzWindowSec: 3,
        finalAnswerTimeSec: 30,
        wagerTimeSec: 15,
        admin: true,
      },
    );
    expect(mocks.setLastRoomSettings).toHaveBeenCalledWith(
      expect.any(Request),
      {
        answerTimeSec: 0,
        autoWrongOnTimeout: true,
        readTimeSec: 0,
        buzzWindowSec: 3,
        finalAnswerTimeSec: 30,
        wagerTimeSec: 15,
      },
    );
  });

  it("rejects invalid timers before creating anything", async () => {
    mocks.getAdmin.mockResolvedValue(ADMIN);
    const response = await thrown(
      action(form({ ...TIMERS, buzzWindowSec: "4" })),
    );
    expect(response.status).toBe(400);
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });
});
