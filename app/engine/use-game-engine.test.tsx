import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_GAME } from "~/models/mock.server";
import type { DbRoomEvent } from "~/models/room-event.server";

import { ActionType } from "./engine";
import type { PresenceRole } from "./presence";
import { ConnectionState, useGameEngine } from "./use-game-engine";

type InsertHandler = (payload: { new: DbRoomEvent }) => void;
type StatusHandler = (status: string, err?: Error) => void;
interface MockState {
  insertHandler: InsertHandler;
  presenceHandler: () => void;
  broadcastHandlers: Map<string, (message: { payload: unknown }) => void>;
  sent: unknown[];
  presenceState: Record<string, { role: string }[]>;
  tracked: ({ role: string } | null)[];
  statusHandler: StatusHandler;
  /** Rows returned by the next catch-up fetches. */
  fetchRows: DbRoomEvent[];
  /** `id > n` lower bounds requested by catch-up fetches. */
  fetchLowerBounds: number[];
}

const mocks = vi.hoisted(() => {
  const state: MockState = {
    insertHandler: () => {},
    presenceHandler: () => {},
    broadcastHandlers: new Map(),
    sent: [],
    presenceState: {},
    tracked: [],
    statusHandler: () => {},
    fetchRows: [],
    fetchLowerBounds: [],
  };
  const channel = {
    state: "joining",
    on: vi.fn(
      (
        event: string,
        filter: { event?: string },
        handler: InsertHandler & (() => void),
      ) => {
        if (event === "broadcast") {
          state.broadcastHandlers.set(filter.event ?? "", handler);
        } else if (event === "presence") {
          state.presenceHandler = handler;
        } else {
          state.insertHandler = handler;
        }
        return channel;
      },
    ),
    presenceState: () => state.presenceState,
    send: vi.fn((message: unknown) => {
      state.sent.push(message);
      return Promise.resolve("ok");
    }),
    track: vi.fn((meta: { role: string }) => {
      state.tracked.push(meta);
      return Promise.resolve("ok");
    }),
    untrack: vi.fn(() => {
      state.tracked.push(null);
      return Promise.resolve("ok");
    }),
    subscribe: vi.fn((handler: StatusHandler) => {
      state.statusHandler = handler;
      return channel;
    }),
  };
  const query = {
    select: () => query,
    eq: () => query,
    gt: (_col: string, value: number) => {
      state.fetchLowerBounds.push(value);
      return query;
    },
    order: () =>
      Promise.resolve({
        data: state.fetchRows.filter(
          (r) => r.id > (state.fetchLowerBounds.at(-1) ?? 0),
        ),
        error: null,
      }),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    from: vi.fn(() => query),
    realtime: { isConnected: () => true },
  };
  return { state, channel, client };
});

vi.mock("~/supabase", () => ({
  getSupabase: () => mocks.client,
}));

function event(
  id: number,
  type: ActionType,
  payload: { userId: string; name: string },
): DbRoomEvent {
  return {
    id,
    room_id: 7,
    ts: `2026-10-25T10:00:${String(id).padStart(2, "0")}`,
    type,
    payload,
  };
}

const JOIN_U1 = event(1, ActionType.Join, { userId: "u1", name: "Ann" });
const JOIN_U2 = event(2, ActionType.Join, { userId: "u2", name: "Bob" });
const RENAME_U2 = event(3, ActionType.ChangeName, {
  userId: "u2",
  name: "Bobby",
});
const LEAVE_U2 = event(4, ActionType.Leave, { userId: "u2", name: "Bobby" });

let engine: ReturnType<typeof useGameEngine>;
function TestHook({
  events,
  presence = null,
}: {
  events: DbRoomEvent[];
  presence?: PresenceRole | null;
}) {
  engine = useGameEngine(MOCK_GAME, events, 7, undefined, presence);
  return null;
}

/** Let pending promise callbacks (catch-up fetches) run. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useGameEngine", () => {
  let root: Root;

  beforeEach(() => {
    mocks.state.fetchRows = [];
    mocks.state.fetchLowerBounds = [];
    mocks.channel.state = "joining";
    mocks.state.presenceState = {};
    mocks.state.tracked = [];
    mocks.state.sent = [];
    mocks.state.broadcastHandlers = new Map();
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  function playerNames() {
    return Array.from(engine.players.values()).map((p) => p.name);
  }

  it("seeds state from the server's room events", () => {
    act(() => root.render(<TestHook events={[JOIN_U1]} />));
    expect(playerNames()).toEqual(["Ann"]);
    expect(engine.connectionState).toBe(ConnectionState.CONNECTING);
  });

  it("applies the player's own events from a revalidated loader snapshot, even before the channel subscribes", () => {
    // Regression: joining before SUBSCRIBED saved the Join, but the client
    // never received it. React Router revalidates the room loader after every
    // fetcher action, so the fresh snapshot must be merged into state.
    act(() => root.render(<TestHook events={[JOIN_U1]} />));
    act(() => root.render(<TestHook events={[JOIN_U1, JOIN_U2]} />));
    expect(playerNames()).toEqual(["Ann", "Bob"]);
  });

  it("does not re-apply events already received over realtime", () => {
    act(() => root.render(<TestHook events={[JOIN_U1]} />));
    act(() => mocks.state.insertHandler({ new: JOIN_U2 }));
    act(() => mocks.state.insertHandler({ new: LEAVE_U2 }));
    expect(playerNames()).toEqual(["Ann"]);

    // A snapshot containing the same events must not re-add Bob.
    act(() => root.render(<TestHook events={[JOIN_U1, JOIN_U2, LEAVE_U2]} />));
    expect(playerNames()).toEqual(["Ann"]);
    act(() => mocks.state.insertHandler({ new: JOIN_U2 }));
    expect(playerNames()).toEqual(["Ann"]);
  });

  it("catches up on SUBSCRIBED and again shortly after (CDC warm-up)", async () => {
    vi.useFakeTimers();
    act(() => root.render(<TestHook events={[JOIN_U1]} />));

    act(() => mocks.state.statusHandler("SUBSCRIBED"));
    await flush();
    expect(engine.connectionState).toBe(ConnectionState.CONNECTED);
    expect(mocks.state.fetchLowerBounds).toEqual([1]);

    // An event inserted right after SUBSCRIBED that realtime never delivers.
    mocks.state.fetchRows = [JOIN_U2];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mocks.state.fetchLowerBounds).toEqual([1, 1]);
    expect(playerNames()).toEqual(["Ann", "Bob"]);
  });

  it("fetches events missed before a realtime event and rebuilds state in order", async () => {
    act(() => root.render(<TestHook events={[JOIN_U1]} />));
    act(() => mocks.state.statusHandler("SUBSCRIBED"));
    await flush();

    // Realtime missed Bob's Join (id 2) but delivered his rename (id 3),
    // which is a no-op for an unknown player.
    act(() => mocks.state.insertHandler({ new: RENAME_U2 }));
    expect(playerNames()).toEqual(["Ann"]);

    // The next catch-up must still look for ids after 1, not after 3.
    mocks.state.fetchRows = [JOIN_U2, RENAME_U2];
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    mocks.channel.state = "joined";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();

    expect(mocks.state.fetchLowerBounds.at(-1)).toBe(1);
    // Replayed in order: Join(Bob) then ChangeName(Bobby).
    expect(playerNames()).toEqual(["Ann", "Bobby"]);
  });

  it("escalates to DISCONNECTED even when errors keep repeating", () => {
    vi.useFakeTimers();
    act(() => root.render(<TestHook events={[]} />));
    act(() => mocks.state.statusHandler("SUBSCRIBED"));
    // Supabase keeps retrying and reports an error every few seconds.
    for (let i = 0; i < 5; i++) {
      act(() => mocks.state.statusHandler("CHANNEL_ERROR"));
      expect(engine.connectionState).toBe(ConnectionState.RECONNECTING);
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
    }
    act(() => mocks.state.statusHandler("TIMED_OUT"));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(engine.connectionState).toBe(ConnectionState.DISCONNECTED);

    // Further background retries don't flip it back to RECONNECTING...
    act(() => mocks.state.statusHandler("CHANNEL_ERROR"));
    expect(engine.connectionState).toBe(ConnectionState.DISCONNECTED);

    // ...but a successful rejoin recovers.
    act(() => mocks.state.statusHandler("SUBSCRIBED"));
    expect(engine.connectionState).toBe(ConnectionState.CONNECTED);
  });

  it("announces its presence role once subscribed and counts spectators", async () => {
    act(() => root.render(<TestHook events={[]} presence="spectator" />));
    expect(mocks.state.tracked).toEqual([]);
    mocks.channel.state = "joined";
    act(() => mocks.state.statusHandler("SUBSCRIBED"));
    expect(mocks.state.tracked).toEqual([{ role: "spectator" }]);

    // The role changes on the live channel without re-subscribing.
    act(() => root.render(<TestHook events={[]} presence="player" />));
    expect(mocks.state.tracked.at(-1)).toEqual({ role: "player" });
    act(() => root.render(<TestHook events={[]} presence={null} />));
    expect(mocks.state.tracked.at(-1)).toBeNull();

    expect(engine.watchers).toBe(0);
    mocks.state.presenceState = {
      a: [{ role: "spectator" }],
      b: [{ role: "spectator" }],
      c: [{ role: "presenter" }],
      d: [{ role: "player" }],
    };
    act(() => mocks.state.presenceHandler());
    expect(engine.watchers).toBe(2);
    await flush();
  });

  it("sends soundboard broadcasts only while the channel is joined", () => {
    act(() => root.render(<TestHook events={[]} />));
    expect(engine.soundboard.available).toBe(true);
    const message = { sound: "ding", userId: "u1", name: "Ann" };
    expect(engine.soundboard.send(message)).toBe(false);
    expect(mocks.state.sent).toEqual([]);

    mocks.channel.state = "joined";
    act(() => mocks.state.statusHandler("SUBSCRIBED"));
    expect(engine.soundboard.send(message)).toBe(true);
    expect(mocks.state.sent).toEqual([
      { type: "broadcast", event: "soundboard", payload: message },
    ]);
  });

  it("delivers soundboard broadcasts to listeners, also after a reconnect", () => {
    act(() => root.render(<TestHook events={[JOIN_U1]} />));
    const received: unknown[] = [];
    const stop = engine.soundboard.subscribe((p) => received.push(p));
    const deliver = (payload: unknown) =>
      act(() => mocks.state.broadcastHandlers.get("soundboard")?.({ payload }));
    deliver({ sound: "tada" });

    // A reconnect makes a new channel; the listener keeps working.
    act(() => engine.reconnect?.());
    deliver({ sound: "ding" });
    stop();
    deliver({ sound: "wrong" });
    expect(received).toEqual([{ sound: "tada" }, { sound: "ding" }]);

    // Room events still arrive over postgres_changes.
    act(() => mocks.state.insertHandler({ new: JOIN_U2 }));
    expect(playerNames()).toEqual(["Ann", "Bob"]);
  });
});
