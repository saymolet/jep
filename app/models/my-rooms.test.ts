import { describe, expect, it } from "vitest";

import { ActionType } from "~/engine";
import { createT } from "~/i18n";
import { formatTimeAgo } from "~/models/active-rooms";
import { getMockGame, MOCK_GAME } from "~/models/mock.server";
import type { DbRoomEvent } from "~/models/room-event.server";

import { summarizeMyRoom } from "./my-rooms";

const NOW = Date.parse("2026-10-25T12:00:00Z");
const ROOM = { id: 9, name: "apple" };

let nextId = 1;
function event(
  type: string,
  payload: DbRoomEvent["payload"],
  ts = "2026-10-25T11:50:00",
): DbRoomEvent {
  return { id: nextId++, room_id: 9, ts, type, payload };
}

const clue = (userId: string) => ({ userId, i: 0, j: 0 });

/** Ann ("guest-a") and Bob join; Bob answers the first question right. */
const BOB_SCORES = () => [
  event(ActionType.Join, {
    userId: "guest-a",
    name: "Ann",
    avatar: "emoji:🦊",
  }),
  event(ActionType.Join, { userId: "b", name: "Bob" }),
  event(ActionType.StartRound, { round: 0, userId: "guest-a" }),
  event(ActionType.ChooseClue, clue("guest-a")),
  event(ActionType.Buzz, { ...clue("b"), deltaMs: 100 }),
  event(ActionType.Buzz, { ...clue("guest-a"), deltaMs: 99_999 }),
  event(ActionType.Check, { ...clue("b"), correct: true }),
  event(ActionType.NextClue, clue("b"), "2026-10-25T11:55:00"),
];

describe("summarizeMyRoom", () => {
  it("describes a room the user plays in: title, players, score, place", () => {
    const room = summarizeMyRoom(
      MOCK_GAME,
      ROOM,
      BOB_SCORES(),
      ["guest-a"],
      NOW,
    );
    expect(room).toEqual({
      id: 9,
      roomName: "9-apple",
      gameTitle: MOCK_GAME.title,
      players: [
        { name: "Ann", color: expect.any(String), emoji: "🦊" },
        { name: "Bob", color: expect.any(String) },
      ],
      score: 0,
      rank: 2,
      minutesAgo: 5,
    });
    expect(
      summarizeMyRoom(MOCK_GAME, ROOM, BOB_SCORES(), ["b"], NOW),
    ).toMatchObject({ score: 200, rank: 1 });
  });

  it("skips rooms the user never joined or left", () => {
    expect(
      summarizeMyRoom(MOCK_GAME, ROOM, BOB_SCORES(), ["someone"], NOW),
    ).toBeNull();
    const left = [
      ...BOB_SCORES(),
      event(ActionType.Leave, { userId: "guest-a" }),
    ];
    expect(summarizeMyRoom(MOCK_GAME, ROOM, left, ["guest-a"], NOW)).toBeNull();
    expect(summarizeMyRoom(MOCK_GAME, ROOM, [], ["guest-a"], NOW)).toBeNull();
  });

  it("skips finished games", async () => {
    const game = await getMockGame("1x1");
    const events = [
      event(ActionType.Join, { userId: "a", name: "Ann" }),
      event(ActionType.StartRound, { round: 0, userId: "a" }),
      event(ActionType.ChooseClue, clue("a")),
      event(ActionType.Buzz, { ...clue("a"), deltaMs: 100 }),
      event(ActionType.Check, { ...clue("a"), correct: true }),
      event(ActionType.NextClue, clue("a")),
    ];
    expect(
      summarizeMyRoom(game, ROOM, events.slice(0, -1), ["a"], NOW),
    ).not.toBeNull();
    expect(summarizeMyRoom(game, ROOM, events, ["a"], NOW)).toBeNull();
  });

  it("finds a guest player for a user who has since logged in", () => {
    // Joined as a guest; now logged in as "acct" (the transfer happens when
    // they open the room).
    expect(
      summarizeMyRoom(MOCK_GAME, ROOM, BOB_SCORES(), ["acct", "guest-a"], NOW),
    ).toMatchObject({ score: 0 });
    // After the transfer the account id is the player.
    const transferred = [
      ...BOB_SCORES(),
      event(ActionType.TransferPlayer, {
        oldUserId: "guest-a",
        newUserId: "acct",
      }),
    ];
    expect(
      summarizeMyRoom(MOCK_GAME, ROOM, transferred, ["acct", "guest-a"], NOW),
    ).toMatchObject({ score: 0, rank: 2 });
  });

  it("skips rooms whose events can't be replayed", () => {
    expect(
      summarizeMyRoom(MOCK_GAME, ROOM, [event("mystery", null)], ["a"], NOW),
    ).toBeNull();
  });
});

describe("formatTimeAgo in days", () => {
  it.each([
    [24 * 60, "1 day ago", "1 день тому"],
    [3 * 24 * 60 + 5, "3 days ago", "3 дні тому"],
    [6 * 24 * 60, "6 days ago", "6 днів тому"],
  ])("%i minutes", (minutes, en, uk) => {
    expect(formatTimeAgo(minutes)).toBe(en);
    expect(formatTimeAgo(minutes, createT("uk"))).toBe(uk);
  });
});
