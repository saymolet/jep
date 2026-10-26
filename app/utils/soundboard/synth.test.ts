import { describe, expect, it } from "vitest";

import { SOUND_IDS } from "./messages";
import {
  MAX_SOUND_SECONDS,
  scheduleSound,
  SOUND_DURATION_S,
  SOUND_LEVEL,
} from "./synth";

/** A recorded AudioParam automation call. */
interface ParamCall {
  method: string;
  value: number;
  time: number;
}

class MockParam {
  value = 0;
  calls: ParamCall[] = [];
  setValueAtTime(value: number, time: number) {
    this.calls.push({ method: "set", value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push({ method: "linear", value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    // Like the browser: an exponential ramp to 0 (or below) throws.
    if (value <= 0) throw new RangeError("exponential ramp to " + value);
    this.calls.push({ method: "exponential", value, time });
    return this;
  }
}

class MockNode {
  connections: unknown[] = [];
  constructor(readonly kind: string) {}
  connect<T>(target: T): T {
    this.connections.push(target);
    return target;
  }
}

class MockSource extends MockNode {
  startedAt?: number;
  stopsAt?: number;
  start(when = 0, offset = 0, duration?: number) {
    void offset;
    if (this.startedAt !== undefined) throw new Error("started twice");
    this.startedAt = when;
    if (duration !== undefined) this.stopsAt = when + duration;
  }
  stop(when = 0) {
    this.stopsAt = when;
  }
}

class MockOscillator extends MockSource {
  type = "sine";
  frequency = new MockParam();
  detune = new MockParam();
  constructor() {
    super("oscillator");
  }
}

class MockBufferSource extends MockSource {
  buffer: unknown = null;
  constructor() {
    super("buffer");
  }
}

class MockAudioContext {
  currentTime = 10;
  sampleRate = 8000;
  destination = new MockNode("destination");
  sources: MockSource[] = [];
  params: MockParam[] = [];
  gains: (MockNode & { gain: MockParam })[] = [];

  private param() {
    const p = new MockParam();
    this.params.push(p);
    return p;
  }
  createGain() {
    const node = Object.assign(new MockNode("gain"), { gain: this.param() });
    this.gains.push(node);
    return node;
  }
  createBiquadFilter() {
    return Object.assign(new MockNode("filter"), {
      type: "lowpass",
      frequency: this.param(),
      Q: this.param(),
    });
  }
  createWaveShaper() {
    return Object.assign(new MockNode("shaper"), { curve: null });
  }
  createOscillator() {
    const osc = new MockOscillator();
    this.params.push(osc.frequency, osc.detune);
    this.sources.push(osc);
    return osc;
  }
  createBufferSource() {
    const src = new MockBufferSource();
    this.sources.push(src);
    return src;
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

/* eslint-disable @typescript-eslint/consistent-type-assertions -- the mocks
   implement only the part of the Web Audio API the synth uses. */
function asContext(ctx: MockAudioContext) {
  return ctx as unknown as BaseAudioContext;
}
function asNode(node: MockNode) {
  return node as unknown as AudioNode;
}
/* eslint-enable @typescript-eslint/consistent-type-assertions */

function schedule(id: (typeof SOUND_IDS)[number], volume = 0.5) {
  const ctx = new MockAudioContext();
  const out = new MockNode("bus");
  const duration = scheduleSound(asContext(ctx), asNode(out), id, { volume });
  return { ctx, out, duration };
}

describe("scheduleSound", () => {
  it.each(SOUND_IDS)("schedules %s without throwing", (id) => {
    const { ctx, out, duration } = schedule(id);
    expect(ctx.sources.length).toBeGreaterThan(0);
    expect(ctx.gains[0].connections).toEqual([out]);
    expect(duration).toBe(SOUND_DURATION_S[id]);
    expect(duration).toBeLessThanOrEqual(MAX_SOUND_SECONDS);
  });

  it.each(SOUND_IDS)(
    "%s starts now and every source stops within its duration",
    (id) => {
      const { ctx, duration } = schedule(id);
      const start = ctx.currentTime;
      for (const source of ctx.sources) {
        expect(source.startedAt).toBeGreaterThanOrEqual(start);
        expect(source.stopsAt, `${source.kind} never stops`).toBeDefined();
        expect(source.stopsAt!).toBeLessThanOrEqual(start + duration + 1e-9);
      }
      for (const param of ctx.params) {
        for (const call of param.calls) {
          expect(call.time).toBeGreaterThanOrEqual(start);
          expect(call.time).toBeLessThanOrEqual(start + duration + 1e-9);
          expect(Number.isFinite(call.value)).toBe(true);
        }
      }
    },
  );

  it("plays through one output gain at the requested volume", () => {
    const { ctx } = schedule("ding", 0.4);
    // The first gain created is the sound's output.
    expect(ctx.gains[0].gain.value).toBeCloseTo(0.4 * SOUND_LEVEL.ding);
  });

  it("clamps the volume", () => {
    expect(schedule("tada", 7).ctx.gains[0].gain.value).toBeCloseTo(
      SOUND_LEVEL.tada,
    );
    expect(schedule("tada", -1).ctx.gains[0].gain.value).toBe(0);
  });

  it("can schedule a sound later", () => {
    const ctx = new MockAudioContext();
    scheduleSound(asContext(ctx), asNode(new MockNode("bus")), "wrong", {
      volume: 1,
      when: 20,
    });
    for (const source of ctx.sources) {
      expect(source.startedAt).toBeGreaterThanOrEqual(20);
    }
  });
});
