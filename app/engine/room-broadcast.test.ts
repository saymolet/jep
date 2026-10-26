import { describe, expect, it, vi } from "vitest";

import { createListenerSet, NO_BROADCAST } from "./room-broadcast";

describe("createListenerSet", () => {
  it("delivers to every listener until it unsubscribes", () => {
    const set = createListenerSet<string>();
    const a = vi.fn();
    const b = vi.fn();
    const stopA = set.add(a);
    set.add(b);
    set.emit("x");
    stopA();
    set.emit("y");
    expect(a.mock.calls).toEqual([["x"]]);
    expect(b.mock.calls).toEqual([["x"], ["y"]]);
    expect(set.size).toBe(1);
  });

  it("keeps going when a listener throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const set = createListenerSet<number>();
    const after = vi.fn();
    set.add(() => {
      throw new Error("boom");
    });
    set.add(after);
    expect(() => set.emit(1)).not.toThrow();
    expect(after).toHaveBeenCalledWith(1);
    error.mockRestore();
  });
});

describe("NO_BROADCAST", () => {
  it("sends nothing in solo play", () => {
    expect(NO_BROADCAST.available).toBe(false);
    expect(NO_BROADCAST.send({})).toBe(false);
    expect(typeof NO_BROADCAST.subscribe(() => {})).toBe("function");
  });
});
