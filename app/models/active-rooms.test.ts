import { describe, expect, it } from "vitest";

import { ActionType } from "~/engine";
import { createT } from "~/i18n";
import { MOCK_GAME, getMockGame } from "~/models/mock.server";
import type { DbRoomEvent } from "~/models/room-event.server";

import { formatTimeAgo, summarizeActiveRoom } from "./active-rooms";

const NOW = Date.parse("2026-10-25T12:00:00Z");

let nextId = 1;
function event(
  type: string,
  payload: DbRoomEvent["payload"],
  ts = "2026-10-25T11:50:00",
): DbRoomEvent {
  return { id: nextId++, room_id: 9, ts, type, payload };
}

const ROOM = { id: 9, name: "apple" };

describe("summarizeActiveRoom", () => {
  it("lists current players with colors and the last activity", () => {
    const summary = summarizeActiveRoom(
      MOCK_GAME,
      ROOM,
      [
        event(ActionType.Join, { userId: "a", name: "Ann", color: "#ef4444" }),
        event(ActionType.Join, { userId: "b", name: "Bob" }),
        event(ActionType.Join, { userId: "c", name: "Cy" }),
        event(
          ActionType.Leave,
          { userId: "c", name: "Cy" },
          "2026-10-25T11:55:00",
        ),
      ],
      NOW,
    );
    expect(summary).toEqual({
      id: 9,
      roomName: "9-apple",
      players: [
        { name: "Ann", color: "#ef4444" },
        { name: "Bob", color: expect.stringMatching(/^hsl\(/) },
      ],
      minutesAgo: 5,
    });
  });

  it("lists team totals when the room plays in teams", () => {
    const summary = summarizeActiveRoom(
      MOCK_GAME,
      ROOM,
      [
        event(ActionType.Join, { userId: "a", name: "Ann", team: "blue" }),
        event(ActionType.Join, { userId: "b", name: "Bob" }),
        event(ActionType.SetTeam, { userId: "b", team: "red" }),
        event(ActionType.RenameTeam, {
          userId: "b",
          team: "red",
          name: "Foxes",
        }),
      ],
      NOW,
    );
    expect(summary?.teams).toStrictEqual([
      { team: "red", name: "Foxes", score: 0 },
      { team: "blue", score: 0 },
    ]);
  });

  it("includes emoji avatars but not photos (to keep the list small)", () => {
    const summary = summarizeActiveRoom(
      MOCK_GAME,
      ROOM,
      [
        event(ActionType.Join, {
          userId: "a",
          name: "Ann",
          color: "#ef4444",
          avatar: "emoji:🦊",
        }),
        event(ActionType.Join, {
          userId: "b",
          name: "Bob",
          color: "#ef4444",
          avatar: "data:image/png;base64,AAAA",
        }),
      ],
      NOW,
    );
    expect(summary?.players).toStrictEqual([
      { name: "Ann", color: "#ef4444", emoji: "🦊" },
      { name: "Bob", color: "#ef4444" },
    ]);
  });

  it("skips rooms nobody is in", () => {
    expect(summarizeActiveRoom(MOCK_GAME, ROOM, [], NOW)).toBeNull();
    expect(
      summarizeActiveRoom(
        MOCK_GAME,
        ROOM,
        // The last player can't leave, so only a room nobody joined is empty.
        [event(ActionType.ChangeName, { userId: "a", name: "Ann" })],
        NOW,
      ),
    ).toBeNull();
  });

  it("skips rooms whose game is over", async () => {
    const game = await getMockGame("1x1");
    const clue = { userId: "a", i: 0, j: 0 };
    const events = [
      event(ActionType.Join, { userId: "a", name: "Ann" }),
      event(ActionType.StartRound, { round: 0, userId: "a" }),
      event(ActionType.ChooseClue, clue),
      event(ActionType.Buzz, { ...clue, deltaMs: 100 }),
      event(ActionType.Check, { ...clue, correct: true }),
      event(ActionType.NextClue, clue),
    ];
    // Sanity check: the room is in progress until the last clue is done.
    expect(
      summarizeActiveRoom(game, ROOM, events.slice(0, -1), NOW),
    ).not.toBeNull();
    expect(summarizeActiveRoom(game, ROOM, events, NOW)).toBeNull();
  });

  it("skips rooms with unknown event types instead of throwing", () => {
    expect(
      summarizeActiveRoom(MOCK_GAME, ROOM, [event("mystery", null)], NOW),
    ).toBeNull();
  });
});

describe("formatTimeAgo", () => {
  it.each([
    [0, "just now"],
    [1, "1 min ago"],
    [59, "59 min ago"],
    [60, "1 h ago"],
    [125, "2 h ago"],
  ])("%i minutes → %s", (minutes, label) => {
    expect(formatTimeAgo(minutes)).toBe(label);
  });

  it.each([
    [0, "щойно"],
    [5, "5 хв тому"],
    [125, "2 год тому"],
  ])("%i minutes → %s in Ukrainian", (minutes, label) => {
    expect(formatTimeAgo(minutes, createT("uk"))).toBe(label);
  });
});
