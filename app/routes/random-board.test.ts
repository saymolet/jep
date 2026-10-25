import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getValidAuthSession: vi.fn(),
  createGame: vi.fn(),
  generateRandomGame: vi.fn(),
}));

vi.mock("~/models/auth", () => ({
  getValidAuthSession: mocks.getValidAuthSession,
}));
vi.mock("~/models/game.server", () => ({ createGame: mocks.createGame }));
vi.mock("~/models/random-board.server", async () => {
  class RandomBoardPoolError extends Error {
    constructor(
      readonly needed: number,
      readonly available: number,
    ) {
      super("pool");
    }
  }
  return {
    RandomBoardPoolError,
    generateRandomGame: mocks.generateRandomGame,
  };
});

import { RandomBoardPoolError } from "~/models/random-board.server";

import { action } from "./random-board";

const GAME = { title: "T", author: "A", copyright: "", note: "", boards: [] };

async function post(fields: Record<string, string>, headers?: HeadersInit) {
  const request = new Request("http://localhost/random-board", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers,
  });
  return action({
    request,
    url: new URL(request.url),
    pattern: "/random-board",
    params: {},
    context: new RouterContextProvider(),
  });
}

/** The status and body of a `data()` result or a Response. */
function unwrap(result: Awaited<ReturnType<typeof action>>) {
  if (result instanceof Response) {
    return { status: result.status, location: result.headers.get("Location") };
  }
  return { status: result.init?.status ?? 200, data: result.data };
}

describe("POST /random-board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getValidAuthSession.mockResolvedValue(null);
    mocks.generateRandomGame.mockResolvedValue(GAME);
    mocks.createGame.mockResolvedValue("new-game");
  });

  it("creates an unlisted game as a guest (server-side insert) and opens a new room", async () => {
    const result = unwrap(
      await post({ categories: "6", rounds: "2", includeFinal: "on" }),
    );

    expect(result).toEqual({
      status: 302,
      location: "/game/new-game/play?new",
    });
    const [options, text] = mocks.generateRandomGame.mock.calls[0];
    expect(options).toEqual({ categories: 6, rounds: 2, includeFinal: true });
    expect(text.title).toMatch(/^Random board · /);
    expect(text.author).toBe("Jep! random");
    expect(text.note(["X", "Y"])).toBe("Categories from: X, Y");
    expect(mocks.createGame).toHaveBeenCalledWith(
      GAME,
      "UNLISTED",
      undefined,
      undefined,
      { asAdmin: true },
    );
  });

  it("creates the game as the logged-in user and can open solo play", async () => {
    mocks.getValidAuthSession.mockResolvedValue({
      userId: "user-1",
      accessToken: "token",
    });
    const result = unwrap(await post({ intent: "solo" }));

    expect(result).toEqual({ status: 302, location: "/game/new-game/solo" });
    expect(mocks.generateRandomGame.mock.calls[0][0]).toEqual({
      categories: 5,
      rounds: 1,
      includeFinal: false,
    });
    expect(mocks.createGame).toHaveBeenCalledWith(
      GAME,
      "UNLISTED",
      "user-1",
      "token",
      { asAdmin: false },
    );
  });

  it("writes the title and note in the request language", async () => {
    await post({}, { "Accept-Language": "uk" });
    const [, text] = mocks.generateRandomGame.mock.calls[0];
    expect(text.title).toMatch(/^Випадкова гра · /);
    expect(text.note(["X"])).toBe("Категорії з ігор: X");
  });

  it("explains a too small pool", async () => {
    mocks.generateRandomGame.mockRejectedValue(new RandomBoardPoolError(10, 4));
    const result = unwrap(await post({ rounds: "2" }));

    expect(result.status).toBe(422);
    expect(result.data).toEqual({
      error: expect.stringMatching(
        /^Not enough public games.*needs 10 .*only 4 were found/,
      ),
    });
    expect(mocks.createGame).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { categories: "9" },
    { categories: "2" },
    { rounds: "3" },
  ])("rejects invalid options %o", async (fields) => {
    const result = unwrap(await post(fields));
    expect(result.status).toBe(400);
    expect(mocks.generateRandomGame).not.toHaveBeenCalled();
  });
});
