/** Soundboard samples: real recordings (CC0, see
 * public/sounds/soundboard/CREDITS.md), served as static files and decoded
 * into AudioBuffers on first use. A sample that can't be fetched or decoded
 * falls back to the synthesized sound (synth.ts). */
import { SOUND_IDS, type SoundId } from "./messages";

/** Every sample is at most this long. */
export const MAX_SAMPLE_SECONDS = 3;

/** How long each sample lasts, in seconds (rounded up). Used to count
 * overlapping sounds. */
export const SAMPLE_DURATION_S: Record<SoundId, number> = {
  applause: 2.6,
  drumroll: 3,
  tada: 1.8,
  wrong: 1,
  airhorn: 2.6,
  laugh: 2,
  ooh: 2,
  crickets: 2.6,
  ding: 2.1,
};

/** sampleUrl is where sound `id`'s sample file is served (public/). */
export function sampleUrl(id: SoundId) {
  return `/sounds/soundboard/${id}.mp3`;
}

export type SampleStatus = "idle" | "loading" | "ready" | "failed";

type Entry =
  | { status: "loading"; promise: Promise<AudioBuffer | null> }
  | { status: "ready"; buffer: AudioBuffer }
  | { status: "failed" };

/** decodeAudio decodes with the callback form of decodeAudioData, which
 * older Safari (no promise form) and every current browser support. */
function decodeAudio(
  ctx: BaseAudioContext,
  data: ArrayBuffer,
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    // Older Safari returns nothing.
    const result: Promise<AudioBuffer> | undefined = ctx.decodeAudioData(
      data,
      resolve,
      reject,
    );
    // Browsers that return a promise reject it too: avoid an unhandled
    // rejection (the error callback already rejected ours), and resolve
    // from it in case the callbacks aren't called.
    if (result) result.then(resolve, reject);
  });
}

/** SampleCache fetches and decodes each sample once and keeps the result:
 * the AudioBuffer, or "failed" (not retried — the synth plays instead). */
export class SampleCache {
  private entries = new Map<SoundId, Entry>();

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly fetchFn: (url: string) => Promise<Response> = (url) =>
      fetch(url),
  ) {}

  status(id: SoundId): SampleStatus {
    return this.entries.get(id)?.status ?? "idle";
  }

  /** The decoded sample: undefined while not loaded yet, null if it
   * failed. */
  get(id: SoundId): AudioBuffer | null | undefined {
    const entry = this.entries.get(id);
    if (entry?.status === "ready") return entry.buffer;
    if (entry?.status === "failed") return null;
    return undefined;
  }

  /** load fetches and decodes sample `id` (once). Resolves to the buffer,
   * or null if it failed. Never rejects. */
  load(id: SoundId): Promise<AudioBuffer | null> {
    const entry = this.entries.get(id);
    if (entry?.status === "ready") return Promise.resolve(entry.buffer);
    if (entry?.status === "failed") return Promise.resolve(null);
    if (entry?.status === "loading") return entry.promise;

    const promise = this.fetchAndDecode(id).then(
      (buffer) => {
        this.entries.set(id, { status: "ready", buffer });
        return buffer;
      },
      (err: unknown) => {
        console.warn(`Soundboard sample ${id} failed to load:`, err);
        this.entries.set(id, { status: "failed" });
        return null;
      },
    );
    this.entries.set(id, { status: "loading", promise });
    return promise;
  }

  /** preloadAll loads every sample (about 270 KB in all). */
  async preloadAll(): Promise<void> {
    await Promise.all(SOUND_IDS.map((id) => this.load(id)));
  }

  private async fetchAndDecode(id: SoundId): Promise<AudioBuffer> {
    const response = await this.fetchFn(sampleUrl(id));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return decodeAudio(this.ctx, await response.arrayBuffer());
  }
}

/** playSample plays `buffer` on `ctx` into `destination` at `volume` (0–1),
 * starting at `when` (default: now). The samples are loudness-normalized
 * (≈ −16 LUFS), so no per-sound level is needed. Returns its duration in
 * seconds. */
export function playSample(
  ctx: BaseAudioContext,
  destination: AudioNode,
  buffer: AudioBuffer,
  { volume, when = ctx.currentTime }: { volume: number; when?: number },
): number {
  const out = ctx.createGain();
  out.gain.value = Math.max(0, Math.min(1, volume));
  out.connect(destination);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(out);
  source.start(when);
  return buffer.duration;
}
