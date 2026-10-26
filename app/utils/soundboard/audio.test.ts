/* eslint-disable @typescript-eslint/consistent-type-assertions -- Web Audio
   and fetch mocks stand in for browser objects. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playOnAudio, SAMPLE_WAIT_MS, type SoundboardAudio } from "./audio";
import { SampleCache } from "./samples";
import { scheduleSound } from "./synth";

vi.mock("./synth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./synth")>()),
  scheduleSound: vi.fn(() => 1),
}));

const BUFFER = { duration: 2 } as AudioBuffer;

/** A minimal AudioContext: records the buffer sources it starts. */
function mockAudio(decode: () => Promise<AudioBuffer>) {
  const started: { buffer: AudioBuffer | null; gain: number }[] = [];
  const ctx = {
    currentTime: 0,
    decodeAudioData: vi.fn(decode),
    createGain: () => {
      const node = { gain: { value: 0 }, connect: (n: unknown) => n };
      return node;
    },
    createBufferSource: () => {
      const source = {
        buffer: null as AudioBuffer | null,
        out: null as { gain: { value: number } } | null,
        connect(n: { gain: { value: number } }) {
          source.out = n;
          return n;
        },
        start() {
          started.push({ buffer: source.buffer, gain: source.out!.gain.value });
        },
      };
      return source;
    },
  } as unknown as AudioContext;
  return { ctx, started };
}

function okResponse() {
  return new Response(new Uint8Array([1]), { status: 200 });
}

function setup(
  decode: () => Promise<AudioBuffer>,
  fetchFn = vi.fn(async () => okResponse()),
) {
  const { ctx, started } = mockAudio(decode);
  const bus = {} as AudioNode;
  const audio: SoundboardAudio = {
    ctx,
    bus,
    samples: new SampleCache(ctx, fetchFn),
  };
  return { audio, started, fetchFn, bus };
}

beforeEach(() => {
  vi.mocked(scheduleSound).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("playOnAudio", () => {
  it("plays the decoded sample at the volume, through the limiter bus", async () => {
    const { audio, started } = setup(async () => BUFFER);
    await audio.samples.load("applause");

    expect(playOnAudio(audio, "applause", 0.4)).toBe(true);
    expect(started).toEqual([{ buffer: BUFFER, gain: 0.4 }]);
    expect(scheduleSound).not.toHaveBeenCalled();
  });

  it("falls back to the synth when the sample failed to load", async () => {
    const { audio, started, bus } = setup(async () => {
      throw new Error("EncodingError");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await audio.samples.load("ding");

    expect(playOnAudio(audio, "ding", 0.5)).toBe(true);
    expect(started).toEqual([]);
    expect(scheduleSound).toHaveBeenCalledWith(audio.ctx, bus, "ding", {
      volume: 0.5,
    });
  });

  it("loads a sample on first use and plays it once decoded", async () => {
    const { audio, started, fetchFn } = setup(async () => BUFFER);

    expect(playOnAudio(audio, "tada", 0.5)).toBe(true);
    expect(started).toEqual([]);
    await vi.waitFor(() => expect(started).toHaveLength(1));
    expect(started[0]).toEqual({ buffer: BUFFER, gain: 0.5 });
    expect(scheduleSound).not.toHaveBeenCalled();

    // Cached: the next play is immediate, with no new fetch.
    expect(playOnAudio(audio, "tada", 0.5)).toBe(true);
    expect(started).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("plays the synth instead if the sample takes too long", async () => {
    vi.useFakeTimers();
    let finish: (b: AudioBuffer) => void = () => {};
    const { audio, started } = setup(
      () => new Promise<AudioBuffer>((resolve) => (finish = resolve)),
    );

    expect(playOnAudio(audio, "wrong", 0.5)).toBe(true);
    await vi.advanceTimersByTimeAsync(SAMPLE_WAIT_MS);
    expect(scheduleSound).toHaveBeenCalledTimes(1);

    // The late sample doesn't play on top, but is cached for next time.
    finish(BUFFER);
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual([]);
    expect(audio.samples.status("wrong")).toBe("ready");
    expect(playOnAudio(audio, "wrong", 0.5)).toBe(true);
    expect(started).toHaveLength(1);
    expect(scheduleSound).toHaveBeenCalledTimes(1);
  });
});
