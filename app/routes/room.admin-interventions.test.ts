import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionType, CLUE_TIMEOUT_MS } from "~/engine";
import type { Game } from "~/models/convert.server";
import type { DbRoomEvent } from "~/models/room-event.server";

/* Admin interventions (feature 20) through the room routes: the site admin
 * does a stuck player's step for them (`admin=true` on that step's own
 * route), skips a question or changes a score (the admin route). */

/** The visitor's own id: the admin is watching, not playing. */
const VISITOR = "admin-visitor";
const ANN = "ann";
const BOB = "bob";

const mocks = vi.hoisted(() => ({
  createRoomEventAsServer: vi.fn(),
  getAdmin: vi.fn(),
  getRoomEvents: vi.fn(),
  getRoom: vi.fn(),
  getGame: vi.fn(),
}));

vi.mock("~/models/auth", () => ({ getValidAuthSession: async () => null }));
vi.mock("~/admin/auth.server", () => ({ getAdmin: mocks.getAdmin }));
vi.mock("~/models/room-event.server", () => ({
  createRoomEventAsServer: mocks.createRoomEventAsServer,
  getRoomEvents: mocks.getRoomEvents,
}));
vi.mock("~/models/room.server", () => ({ getRoom: mocks.getRoom }));
vi.mock("~/models/game.server", () => ({ getGame: mocks.getGame }));
vi.mock("~/session.server", () => ({
  // The session belongs to VISITOR: claiming any other userId is refused.
  requireSessionUserId: async (_request: Request, claimedUserId: string) => {
    if (claimedUserId !== VISITOR) {
      throw new Response("userId does not match session", { status: 403 });
    }
  },
}));

import { getMockGame, MOCK_GAME } from "~/models/mock.server";

import { action as adminAction } from "./room.$roomId.admin";
import { action as answerAction } from "./room.$roomId.answer";
import { action as buzzAction } from "./room.$roomId.buzz";
import { action as checkAction } from "./room.$roomId.check";
import { action as chooseAction } from "./room.$roomId.choose-clue";
import { action as nextAction } from "./room.$roomId.next-clue";
import { action as passAction } from "./room.$roomId.pass-clue";
import { action as startAction } from "./room.$roomId.start";
import { action as wagerAction } from "./room.$roomId.wager";

const ROOM = { id: 5, name: "word", game_id: "mock" };
const ADMIN_SESSION = { until: Infinity, key: "k", csrf: "c" };

type Step = [ActionType, object];

function toEvents(steps: Step[]): DbRoomEvent[] {
  return steps.map(([type, payload], k) => ({
    id: k + 1,
    room_id: ROOM.id,
    ts: `2026-10-26T10:00:${String(k + 1).padStart(2, "0")}`,
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  }));
}

const LOBBY: Step[] = [
  [ActionType.Join, { userId: ANN, name: "Ann" }],
  [ActionType.Join, { userId: BOB, name: "Bob" }],
];
const BOARD: Step[] = [
  ...LOBBY,
  [ActionType.StartRound, { round: 0, userId: ANN }],
];
const READING: Step[] = [
  ...BOARD,
  [ActionType.ChooseClue, { userId: ANN, i: 0, j: 0 }],
];
const ANN_ANSWERING: Step[] = [
  ...READING,
  [ActionType.Buzz, { userId: ANN, i: 0, j: 0, deltaMs: 100 }],
  [ActionType.Buzz, { userId: BOB, i: 0, j: 0, deltaMs: CLUE_TIMEOUT_MS + 1 }],
];
const ANSWER_SHOWN: Step[] = [
  ...ANN_ANSWERING,
  [ActionType.Check, { userId: ANN, i: 0, j: 0, correct: true }],
];

/** Any room route's action (they differ only in their route types). */
type RouteAction = (args: {
  request: Request;
  url: URL;
  pattern: string;
  params: { roomId: string };
  context: RouterContextProvider;
}) => Promise<unknown>;

async function call(
  route: RouteAction,
  path: string,
  fields: Record<string, string>,
  roomId = "5",
) {
  const req = new Request(`http://localhost/room/${roomId}/${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  return route({
    request: req,
    url: new URL(req.url),
    pattern: `/room/:roomId/${path}`,
    params: { roomId },
    context: new RouterContextProvider(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRoom.mockResolvedValue(ROOM);
  mocks.getGame.mockResolvedValue(MOCK_GAME);
  mocks.getRoomEvents.mockResolvedValue(toEvents(LOBBY));
  mocks.getAdmin.mockResolvedValue(ADMIN_SESSION);
});

describe("acting for a player", () => {
  const cases: {
    name: string;
    route: RouteAction;
    path: string;
    game?: () => Promise<Game>;
    events: Step[];
    fields: Record<string, string>;
    type: ActionType;
    payload: object;
  }[] = [
    {
      name: "start the round",
      route: startAction,
      path: "start",
      events: LOBBY,
      fields: { userId: ANN, round: "0" },
      type: ActionType.StartRound,
      payload: { round: 0, userId: ANN },
    },
    {
      name: "choose a question",
      route: chooseAction,
      path: "choose-clue",
      events: BOARD,
      fields: { userId: ANN, i: "0", j: "1" },
      type: ActionType.ChooseClue,
      payload: { userId: ANN, i: 0, j: 1 },
    },
    {
      name: "pass on the buzzer",
      route: buzzAction,
      path: "buzz",
      events: READING,
      fields: { userId: BOB, i: "0", j: "0", deltaMs: "5001" },
      type: ActionType.Buzz,
      payload: { userId: BOB, i: 0, j: 0, deltaMs: 5001 },
    },
    {
      name: "mark the answer right",
      route: checkAction,
      path: "check",
      events: ANN_ANSWERING,
      fields: { userId: ANN, i: "0", j: "0", result: "correct" },
      type: ActionType.Check,
      payload: { userId: ANN, i: 0, j: 0, correct: true },
    },
    {
      name: "pick a multiple choice option (judged by the server)",
      route: checkAction,
      path: "check",
      game: () => getMockGame("choice"),
      events: ANN_ANSWERING,
      fields: { userId: ANN, i: "0", j: "0", choice: "1", result: "incorrect" },
      type: ActionType.Check,
      payload: { userId: ANN, i: 0, j: 0, correct: true, choice: 1 },
    },
    {
      name: "go back to the board",
      route: nextAction,
      path: "next-clue",
      events: ANSWER_SHOWN,
      fields: { userId: ANN, i: "0", j: "0" },
      type: ActionType.NextClue,
      payload: { userId: ANN, i: 0, j: 0 },
    },
    {
      name: "send a Final answer",
      route: answerAction,
      path: "answer",
      events: BOARD,
      fields: { userId: BOB, i: "0", j: "1", answer: "" },
      type: ActionType.Answer,
      payload: { userId: BOB, i: 0, j: 1, answer: "" },
    },
    {
      name: "wager",
      route: wagerAction,
      path: "wager",
      events: BOARD,
      fields: { userId: ANN, i: "0", j: "0", wager: "100" },
      type: ActionType.SetClueWager,
      payload: { userId: ANN, i: 0, j: 0, wager: 100 },
    },
    {
      name: "give the cat in the bag away",
      route: passAction,
      path: "pass-clue",
      game: () => getMockGame("secret"),
      events: [...BOARD, [ActionType.ChooseClue, { userId: ANN, i: 1, j: 0 }]],
      fields: { userId: ANN, i: "1", j: "0", toUserId: BOB },
      type: ActionType.PassClue,
      payload: { userId: ANN, i: 1, j: 0, toUserId: BOB },
    },
  ];

  describe.each(cases)("$name", (c) => {
    beforeEach(async () => {
      if (c.game) mocks.getGame.mockResolvedValue(await c.game());
      mocks.getRoomEvents.mockResolvedValue(toEvents(c.events));
    });

    it("the admin does it for the player (needn't play)", async () => {
      await call(c.route, c.path, { ...c.fields, admin: "true" });
      expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
        ROOM.id,
        c.type,
        { ...c.payload, admin: true },
      );
    });

    it("403 for someone who isn't the admin", async () => {
      mocks.getAdmin.mockResolvedValue(null);
      await expect(
        call(c.route, c.path, { ...c.fields, admin: "true" }),
      ).rejects.toMatchObject({ status: 403 });
      expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
    });

    it("403 without the admin flag: only your own steps", async () => {
      await expect(call(c.route, c.path, c.fields)).rejects.toMatchObject({
        status: 403,
      });
      expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
    });

    it("solo play ignores the flag", async () => {
      const result = await call(
        c.route,
        c.path,
        { ...c.fields, admin: "true" },
        "-1",
      );
      expect(result).toMatchObject({ type: c.type });
      expect(JSON.stringify(result)).not.toContain('"admin"');
      expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
    });
  });

  it("a wager out of range is refused (it would break the room)", async () => {
    mocks.getRoomEvents.mockResolvedValue(
      toEvents([
        ...BOARD,
        [ActionType.SkipClue, { i: 0, j: 0, admin: true }],
        [ActionType.SkipClue, { i: 0, j: 1, admin: true }],
        [ActionType.StartRound, { round: 1, userId: ANN }],
        [ActionType.ChooseClue, { userId: ANN, i: 0, j: 0 }],
      ]),
    );
    await expect(
      call(wagerAction, "wager", {
        userId: ANN,
        i: "0",
        j: "0",
        wager: "5000",
        admin: "true",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await call(wagerAction, "wager", {
      userId: ANN,
      i: "0",
      j: "0",
      wager: "400",
      admin: "true",
    });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledTimes(1);
  });
});

describe("admin route", () => {
  const post = (fields: Record<string, string>, roomId = "5") =>
    call(adminAction, "admin", fields, roomId);

  it("403 for someone who isn't the admin (before anything else)", async () => {
    mocks.getAdmin.mockResolvedValue(null);
    const requests: Record<string, string>[] = [
      { intent: "skip", i: "0", j: "0" },
      { intent: "score", userId: ANN, op: "add", amount: "100" },
    ];
    for (const fields of requests) {
      await expect(post(fields)).rejects.toMatchObject({ status: 403 });
    }
    expect(mocks.getRoom).not.toHaveBeenCalled();
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("skips the open question", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(ANN_ANSWERING));
    expect(await post({ intent: "skip", i: "0", j: "0" })).toBeNull();
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.SkipClue,
      { i: 0, j: 0, admin: true },
    );
  });

  it("skips an unplayed question on the board", async () => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(BOARD));
    await post({ intent: "skip", i: "0", j: "1" });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.SkipClue,
      { i: 0, j: 1, admin: true },
    );
  });

  it.each([
    ["another question than the open one", READING, "0", "1"],
    ["the answer is already shown", ANSWER_SHOWN, "0", "0"],
    ["the round preview", LOBBY, "0", "0"],
    ["outside the board", BOARD, "9", "0"],
  ] as const)("409 to skip %s", async (_name, events, i, j) => {
    mocks.getRoomEvents.mockResolvedValue(toEvents([...events]));
    const result = await post({ intent: "skip", i, j });
    expect(result).toMatchObject({
      init: { status: 409 },
      data: { error: "this question can't be skipped now" },
    });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it.each([
    ["add", "200", { delta: 200 }],
    ["subtract", "200", { delta: -200 }],
    ["set", "-300", { score: -300 }],
  ] as const)("changes a score: %s %s", async (op, amount, change) => {
    mocks.getRoomEvents.mockResolvedValue(toEvents(READING));
    await post({ intent: "score", userId: BOB, op, amount });
    expect(mocks.createRoomEventAsServer).toHaveBeenCalledWith(
      ROOM.id,
      ActionType.AdjustScore,
      { userId: BOB, ...change, admin: true },
    );
  });

  it("a change of nothing is not stored", async () => {
    await post({ intent: "score", userId: BOB, op: "add", amount: "0" });
    await post({ intent: "score", userId: BOB, op: "set", amount: "0" });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("409 for someone who isn't in the game", async () => {
    const result = await post({
      intent: "score",
      userId: "nobody",
      op: "add",
      amount: "100",
    });
    expect(result).toMatchObject({ init: { status: 409 } });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("400 for amounts that aren't whole numbers or are too large", async () => {
    for (const amount of ["1.5", "abc", "", "99999999"]) {
      await expect(
        post({ intent: "score", userId: BOB, op: "add", amount }),
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(post({ intent: "nope" })).rejects.toMatchObject({
      status: 400,
    });
    expect(mocks.createRoomEventAsServer).not.toHaveBeenCalled();
  });

  it("409 after game over", async () => {
    mocks.getGame.mockResolvedValue(await getMockGame("1x1"));
    mocks.getRoomEvents.mockResolvedValue(
      toEvents([...BOARD, [ActionType.SkipClue, { i: 0, j: 0, admin: true }]]),
    );
    const result = await post({
      intent: "score",
      userId: BOB,
      op: "add",
      amount: "100",
    });
    expect(result).toMatchObject({ init: { status: 409 } });
  });

  it("solo play has no admin", async () => {
    await expect(
      post({ intent: "skip", i: "0", j: "0" }, "-1"),
    ).rejects.toMatchObject({ status: 400 });
  });
});
