import { afterEach, describe, expect, it, vi } from "vitest";

import { BUZZ_HAPTIC, LOCKOUT_HAPTIC, vibrate } from "./haptics";

const original = Object.getOwnPropertyDescriptor(navigator, "vibrate");

afterEach(() => {
  if (original) {
    Object.defineProperty(navigator, "vibrate", original);
  } else {
    Reflect.deleteProperty(navigator, "vibrate");
  }
});

describe("vibrate", () => {
  it("vibrates where the Vibration API exists", () => {
    const spy = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      value: spy,
      configurable: true,
    });
    expect(vibrate(BUZZ_HAPTIC)).toBe(true);
    expect(spy).toHaveBeenCalledWith(BUZZ_HAPTIC);
    vibrate(LOCKOUT_HAPTIC);
    expect(spy).toHaveBeenLastCalledWith(LOCKOUT_HAPTIC);
  });

  it("does nothing where it is not supported", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      configurable: true,
    });
    expect(vibrate(BUZZ_HAPTIC)).toBe(false);
  });

  it("swallows errors from the browser", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: () => {
        throw new Error("blocked");
      },
      configurable: true,
    });
    expect(vibrate(LOCKOUT_HAPTIC)).toBe(false);
  });
});
