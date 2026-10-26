/* eslint-disable @typescript-eslint/consistent-type-assertions -- Web Audio
   and fetch mocks stand in for browser objects. */
import { describe, expect, it, vi } from "vitest";

import { SOUND_IDS } from "./messages";
import {
  MAX_SAMPLE_SECONDS,
  playSample,
  SAMPLE_DURATION_S,
  sampleUrl,
  SampleCache,
} from "./samples";

const BUFFER = { duration: 1.5 } as AudioBuffer;

function okResponse() {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg" },
  });
}

/** A context whose decodeAudioData uses the old callback API (Safari < 14.1
 * returns nothing) and calls back with `result`. */
function mockCtx(result: AudioBuffer | Error = BUFFER) {
  const decodeAudioData = vi.fn(
    (
      _data: ArrayBuffer,
      onSuccess?: (b: AudioBuffer) => void,
      onError?: (e: Error) => void,
    ) => {
      queueMicrotask(() => {
        if (result instanceof Error) onError?.(result);
        else onSuccess?.(result);
      });
      return undefined as unknown as Promise<AudioBuffer>;
    },
  );
  return {
    ctx: { decodeAudioData } as unknown as BaseAudioContext,
    decodeAudioData,
  };
}

describe("sample files", () => {
  it("has a URL and a duration for every sound", () => {
    for (const id of SOUND_IDS) {
      expect(sampleUrl(id)).toBe(`/sounds/soundboard/${id}.mp3`);
      expect(SAMPLE_DURATION_S[id]).toBeGreaterThan(0);
      expect(SAMPLE_DURATION_S[id]).toBeLessThanOrEqual(MAX_SAMPLE_SECONDS);
    }
  });
});

describe("SampleCache", () => {
  it("fetches and decodes a sample", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const { ctx, decodeAudioData } = mockCtx();
    const cache = new SampleCache(ctx, fetchFn);
    expect(cache.status("ding")).toBe("idle");
    expect(cache.get("ding")).toBeUndefined();

    const loading = cache.load("ding");
    expect(cache.status("ding")).toBe("loading");
    expect(await loading).toBe(BUFFER);
    expect(cache.status("ding")).toBe("ready");
    expect(cache.get("ding")).toBe(BUFFER);
    expect(fetchFn).toHaveBeenCalledWith("/sounds/soundboard/ding.mp3");
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it("fetches each sample only once", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const cache = new SampleCache(mockCtx().ctx, fetchFn);
    const [a, b] = await Promise.all([cache.load("tada"), cache.load("tada")]);
    expect(a).toBe(BUFFER);
    expect(b).toBe(BUFFER);
    expect(await cache.load("tada")).toBe(BUFFER);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("works with the promise-based decodeAudioData", async () => {
    const decodeAudioData = vi.fn(async () => BUFFER);
    const ctx = { decodeAudioData } as unknown as BaseAudioContext;
    const cache = new SampleCache(ctx, async () => okResponse());
    expect(await cache.load("wrong")).toBe(BUFFER);
  });

  it("marks a sample failed when decoding fails, without retrying", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const { ctx } = mockCtx(new Error("EncodingError"));
    const cache = new SampleCache(ctx, fetchFn);
    expect(await cache.load("airhorn")).toBeNull();
    expect(cache.status("airhorn")).toBe("failed");
    expect(cache.get("airhorn")).toBeNull();
    expect(await cache.load("airhorn")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("marks a sample failed on an HTTP error or a network error", async () => {
    const notFound = new SampleCache(
      mockCtx().ctx,
      async () => new Response("nope", { status: 404 }),
    );
    expect(await notFound.load("ooh")).toBeNull();
    expect(notFound.status("ooh")).toBe("failed");

    const offline = new SampleCache(mockCtx().ctx, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await offline.load("ooh")).toBeNull();
    expect(offline.status("ooh")).toBe("failed");
  });

  it("preloads every sound once", async () => {
    const fetchFn = vi.fn(async () => okResponse());
    const cache = new SampleCache(mockCtx().ctx, fetchFn);
    await cache.preloadAll();
    await cache.preloadAll();
    expect(fetchFn).toHaveBeenCalledTimes(SOUND_IDS.length);
    for (const id of SOUND_IDS) expect(cache.status(id)).toBe("ready");
  });
});

describe("playSample", () => {
  it("plays the buffer through a gain at the volume into the destination", () => {
    const source = {
      buffer: null as AudioBuffer | null,
      connect: vi.fn((n: unknown) => n),
      start: vi.fn(),
    };
    const gain = { gain: { value: 0 }, connect: vi.fn((n: unknown) => n) };
    const ctx = {
      currentTime: 4,
      createBufferSource: () => source,
      createGain: () => gain,
    } as unknown as BaseAudioContext;
    const destination = {} as AudioNode;

    const duration = playSample(ctx, destination, BUFFER, { volume: 0.5 });
    expect(duration).toBe(1.5);
    expect(source.buffer).toBe(BUFFER);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(destination);
    expect(gain.gain.value).toBe(0.5);
    expect(source.start).toHaveBeenCalledWith(4);

    playSample(ctx, destination, BUFFER, { volume: 3 });
    expect(gain.gain.value).toBe(1);
  });
});
