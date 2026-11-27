import { describe, expect, it, vi } from "vitest";

/* getRoomEvents reads every event, page by page: Supabase returns at most
 * 1000 rows per request, and a long game (game night, 2026-11-27) passed
 * that, freezing the server's view of the room. */

const rows = Array.from({ length: 2345 }, (_, k) => ({ id: k + 1 }));
const ranges: [number, number][] = [];

vi.mock("~/supabase", () => ({
  getSupabase: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: (from: number, to: number) => {
          ranges.push([from, to]);
          return Promise.resolve({
            data: rows.slice(from, Math.min(to + 1, from + 1000)),
            error: null,
          });
        },
      };
      return query;
    },
  }),
}));
vi.mock("~/supabase/admin.server", () => ({ getSupabaseAdmin: vi.fn() }));

import { getRoomEvents } from "./room-event.server";

describe("getRoomEvents", () => {
  it("reads past Supabase's 1000-row limit", async () => {
    const events = await getRoomEvents(1);
    expect(events).toHaveLength(2345);
    expect(events.at(-1)).toEqual({ id: 2345 });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});
