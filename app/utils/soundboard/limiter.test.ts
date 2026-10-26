import { describe, expect, it } from "vitest";

import {
  MAX_OVERLAPPING_SOUNDS,
  RECEIVE_COOLDOWN_MS,
  SEND_COOLDOWN_MS,
  SoundboardLimiter,
} from "./limiter";

describe("SoundboardLimiter.trySend", () => {
  it("allows one sound per cooldown", () => {
    const limiter = new SoundboardLimiter();
    expect(limiter.trySend(1_000)).toBe(true);
    expect(limiter.trySend(1_001)).toBe(false);
    expect(limiter.trySend(1_000 + SEND_COOLDOWN_MS - 1)).toBe(false);
    expect(limiter.trySend(1_000 + SEND_COOLDOWN_MS)).toBe(true);
  });

  it("tells when the next sound can be sent", () => {
    const limiter = new SoundboardLimiter();
    expect(limiter.sendReadyAt()).toBe(0);
    limiter.trySend(5_000);
    expect(limiter.sendReadyAt()).toBe(5_000 + SEND_COOLDOWN_MS);
  });

  it("does not extend the cooldown with refused presses", () => {
    const limiter = new SoundboardLimiter();
    limiter.trySend(0);
    limiter.trySend(1_500);
    expect(limiter.trySend(SEND_COOLDOWN_MS)).toBe(true);
  });
});

describe("SoundboardLimiter.tryReceive", () => {
  it("ignores sounds from the same sender that come too fast", () => {
    const limiter = new SoundboardLimiter();
    expect(limiter.tryReceive("a", 0)).toBe(true);
    expect(limiter.tryReceive("a", RECEIVE_COOLDOWN_MS - 1)).toBe(false);
    expect(limiter.tryReceive("a", RECEIVE_COOLDOWN_MS)).toBe(true);
  });

  it("tolerates network jitter below the sender's cooldown", () => {
    expect(RECEIVE_COOLDOWN_MS).toBeLessThan(SEND_COOLDOWN_MS);
    expect(RECEIVE_COOLDOWN_MS).toBeGreaterThanOrEqual(SEND_COOLDOWN_MS / 2);
  });

  it("limits each sender separately", () => {
    const limiter = new SoundboardLimiter();
    expect(limiter.tryReceive("a", 0)).toBe(true);
    expect(limiter.tryReceive("b", 10)).toBe(true);
    expect(limiter.tryReceive("a", 20)).toBe(false);
  });

  it("does not let a spammer extend their own cooldown forever", () => {
    const limiter = new SoundboardLimiter();
    limiter.tryReceive("a", 0);
    for (let t = 100; t < RECEIVE_COOLDOWN_MS; t += 100) {
      limiter.tryReceive("a", t);
    }
    expect(limiter.tryReceive("a", RECEIVE_COOLDOWN_MS)).toBe(true);
  });
});

describe("SoundboardLimiter overlapping sounds", () => {
  it(`plays at most ${MAX_OVERLAPPING_SOUNDS} sounds at once`, () => {
    const limiter = new SoundboardLimiter();
    for (let i = 0; i < MAX_OVERLAPPING_SOUNDS; i++) {
      expect(limiter.tryStartPlayback(0, 2_000)).toBe(true);
    }
    expect(limiter.tryStartPlayback(100, 2_000)).toBe(false);
  });

  it("frees a slot when a sound ends", () => {
    const limiter = new SoundboardLimiter();
    limiter.tryStartPlayback(0, 500);
    for (let i = 1; i < MAX_OVERLAPPING_SOUNDS; i++) {
      limiter.tryStartPlayback(0, 2_000);
    }
    expect(limiter.tryStartPlayback(499, 1_000)).toBe(false);
    expect(limiter.tryStartPlayback(500, 1_000)).toBe(true);
  });
});
