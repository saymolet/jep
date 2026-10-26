import { describe, expect, it } from "vitest";

import { getClientAddress, LoginThrottle } from "./throttle";

const MIN = 60_000;

describe("LoginThrottle", () => {
  it("locks a client out after 5 failures for 15 minutes", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 4; i++) throttle.recordFailure("1.1.1.1", i * 1000);
    expect(throttle.isLocked("1.1.1.1", 5000)).toBe(false);
    throttle.recordFailure("1.1.1.1", 5000);
    expect(throttle.isLocked("1.1.1.1", 5001)).toBe(true);
    expect(throttle.isLocked("1.1.1.1", 5000 + 15 * MIN - 1)).toBe(true);
    expect(throttle.isLocked("1.1.1.1", 5000 + 15 * MIN)).toBe(false);
    // Other clients are not affected.
    expect(throttle.isLocked("2.2.2.2", 5001)).toBe(false);
  });

  it("forgets failures outside the window", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 4; i++) throttle.recordFailure("ip", 0);
    throttle.recordFailure("ip", 15 * MIN + 1);
    expect(throttle.isLocked("ip", 15 * MIN + 2)).toBe(false);
  });

  it("a correct password resets the client's failures", () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < 4; i++) throttle.recordFailure("ip", i);
    throttle.recordSuccess("ip");
    throttle.recordFailure("ip", 10);
    expect(throttle.isLocked("ip", 11)).toBe(false);
  });

  it("locks everyone out after many failures from many clients", () => {
    const throttle = new LoginThrottle({ maxGlobalFailures: 10 });
    for (let i = 0; i < 10; i++) throttle.recordFailure(`10.0.0.${i}`, i);
    expect(throttle.isLocked("192.168.1.1", 20)).toBe(true);
    expect(throttle.isLocked("192.168.1.1", 9 + 15 * MIN)).toBe(false);
  });

  it("tracks a bounded number of clients", () => {
    const throttle = new LoginThrottle({
      maxEntries: 3,
      maxGlobalFailures: 1000,
    });
    for (let i = 0; i < 4; i++) throttle.recordFailure("first", i);
    for (let i = 0; i < 20; i++) throttle.recordFailure(`other-${i}`, 10 + i);
    // "first" was dropped to make room, so its 4 failures are forgotten.
    throttle.recordFailure("first", 100);
    expect(throttle.isLocked("first", 101)).toBe(false);
  });
});

describe("getClientAddress", () => {
  it.each([
    [{ "X-Real-IP": "1.2.3.4", "X-Forwarded-For": "9.9.9.9" }, "1.2.3.4"],
    // A client can send its own X-Forwarded-For; nginx appends the real
    // address, so only the last entry is trusted.
    [{ "X-Forwarded-For": "6.6.6.6, 5.6.7.8" }, "5.6.7.8"],
    [{}, "unknown"],
  ])("%j → %s", (headers, expected) => {
    expect(getClientAddress(new Headers(headers))).toBe(expected);
  });
});
