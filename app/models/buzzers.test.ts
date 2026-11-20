import { describe, expect, it } from "vitest";

import { ActionType } from "~/engine/engine";
import type { DbRoomEvent } from "~/models/room-event.server";

import { mayCloseBuzzersYet } from "./buzzers";

const at = (ms: number) => new Date(ms).toISOString();
function ev(
  id: number,
  type: string,
  ms: number,
  payload: object,
): DbRoomEvent {
  return {
    id,
    room_id: 1,
    ts: at(ms),
    type,
    payload: JSON.parse(JSON.stringify(payload)),
  };
}
const Q = { round: 0, i: 0, j: 0 };
const T0 = 1_000_000;
const OPEN = ev(1, ActionType.OpenBuzzers, T0, { userId: "a", ...Q });

describe("mayCloseBuzzersYet", () => {
  it("not before the buzzers opened", () => {
    expect(mayCloseBuzzersYet([], Q, 5000, T0 + 60_000)).toBe(false);
  });

  it("when the buzz window is over (with a little clock tolerance)", () => {
    expect(mayCloseBuzzersYet([OPEN], Q, 5000, T0 + 3000)).toBe(false);
    expect(mayCloseBuzzersYet([OPEN], Q, 5000, T0 + 4000)).toBe(true);
  });

  it("a moment after someone buzzed in", () => {
    const events = [
      OPEN,
      ev(2, ActionType.Buzz, T0 + 1000, {
        userId: "b",
        i: 0,
        j: 0,
        deltaMs: 900,
      }),
    ];
    expect(mayCloseBuzzersYet(events, Q, 60_000, T0 + 1000)).toBe(true);
    // A "didn't buzz" doesn't count.
    const passes = [
      OPEN,
      ev(2, ActionType.Buzz, T0 + 1000, {
        userId: "b",
        i: 0,
        j: 0,
        deltaMs: 60_001,
      }),
    ];
    expect(mayCloseBuzzersYet(passes, Q, 60_000, T0 + 1000)).toBe(false);
  });
});
