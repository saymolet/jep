import { describe, expect, it } from "vitest";

import { ServerClock } from "./server-clock";

describe("ServerClock", () => {
  it("trusts the local clock without samples", () => {
    expect(new ServerClock().now(5000)).toBe(5000);
  });

  it("corrects a device clock that is ahead", () => {
    const clock = new ServerClock();
    // The device is 30 s ahead; the message took 200 ms.
    clock.note(100_000, 130_200);
    expect(clock.now(140_000)).toBe(109_800);
  });

  it("corrects a device clock that is behind", () => {
    const clock = new ServerClock();
    clock.note(100_000, 70_050);
    expect(clock.now(80_000)).toBe(109_950);
  });

  it("keeps the sample with the smallest delay", () => {
    const clock = new ServerClock();
    clock.note(100_000, 103_000); // a slow message (old event, slow page)
    clock.note(200_000, 200_100); // a quick one
    clock.note(300_000, 302_000);
    expect(clock.offset).toBe(100);
  });

  it("ignores invalid samples", () => {
    const clock = new ServerClock();
    clock.note(Number.NaN, 1000);
    expect(clock.offset).toBeNull();
  });
});
