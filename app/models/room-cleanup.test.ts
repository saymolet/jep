import { describe, expect, it, vi } from "vitest";

import { cleanupInactiveRooms, ROOM_MAX_IDLE_HOURS } from "./room-cleanup";

function fakeClient(result: {
  data: unknown;
  error: { message: string } | null;
}) {
  return { rpc: vi.fn(async () => result) };
}

describe("cleanupInactiveRooms", () => {
  it("is 5 hours", () => {
    expect(ROOM_MAX_IDLE_HOURS).toBe(5);
  });

  it("calls the SQL function with the idle time and returns the count", async () => {
    const client = fakeClient({ data: 3, error: null });
    expect(await cleanupInactiveRooms(client)).toBe(3);
    expect(client.rpc).toHaveBeenCalledWith("cleanup_inactive_rooms", {
      max_idle: "5 hours",
      dry_run: false,
    });
  });

  it("only counts with dryRun", async () => {
    const client = fakeClient({ data: 0, error: null });
    expect(await cleanupInactiveRooms(client, { dryRun: true })).toBe(0);
    expect(client.rpc).toHaveBeenCalledWith("cleanup_inactive_rooms", {
      max_idle: "5 hours",
      dry_run: true,
    });
  });

  it("takes another number of hours", async () => {
    const client = fakeClient({ data: 1, error: null });
    await cleanupInactiveRooms(client, { maxIdleHours: 24 });
    expect(client.rpc).toHaveBeenCalledWith("cleanup_inactive_rooms", {
      max_idle: "24 hours",
      dry_run: false,
    });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "refuses %s hours without calling the database",
    async (maxIdleHours) => {
      const client = fakeClient({ data: 0, error: null });
      await expect(
        cleanupInactiveRooms(client, { maxIdleHours }),
      ).rejects.toThrow(/whole number/);
      expect(client.rpc).not.toHaveBeenCalled();
    },
  );

  it("throws the database error", async () => {
    const client = fakeClient({
      data: null,
      error: {
        message: "permission denied for function cleanup_inactive_rooms",
      },
    });
    await expect(cleanupInactiveRooms(client)).rejects.toThrow(
      /permission denied/,
    );
  });

  it.each([null, "3", -1, 2.5])("rejects an odd result %s", async (data) => {
    const client = fakeClient({ data, error: null });
    await expect(cleanupInactiveRooms(client)).rejects.toThrow(/returned/);
  });
});
