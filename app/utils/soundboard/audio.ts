/** The soundboard's AudioContext. Browsers only let audio start after the
 * user interacted with the page, so the context is created lazily: on the
 * first tap/key press (see installSoundboardAudioUnlock) or when a sound is
 * played after one. Creating it also starts loading the sound samples
 * (samples.ts); a sample that fails to load is synthesized instead
 * (synth.ts). Browser only — never called during server rendering. */
import type { SoundId } from "./messages";
import { playSample, SampleCache } from "./samples";
import { scheduleSound } from "./synth";

export interface SoundboardAudio {
  ctx: AudioContext;
  /** Every sound goes through a limiter so overlapping sounds don't clip. */
  bus: AudioNode;
  samples: SampleCache;
}

/** How long a sound that is still loading may be late before the
 * synthesized version plays instead. */
export const SAMPLE_WAIT_MS = 1_000;

let audio: SoundboardAudio | null = null;

function audioContextClass(): typeof AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  // Undefined in very old browsers (and in unit tests' happy-dom).
  return "AudioContext" in window ? window.AudioContext : undefined;
}

/** Whether the user has interacted with the page (unknown: assume yes). */
function hasUserActivation() {
  if (typeof navigator === "undefined") return false;
  return "userActivation" in navigator
    ? navigator.userActivation.hasBeenActive
    : true;
}

function getAudio(): SoundboardAudio | null {
  if (audio) return audio;
  const Ctor = audioContextClass();
  if (!Ctor) return null;
  try {
    const ctx = new Ctor();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    const samples = new SampleCache(ctx);
    audio = { ctx, bus: limiter, samples };
    // Fetch and decode every sample now, so the first sound is ready.
    void samples.preloadAll();
    return audio;
  } catch {
    return null;
  }
}

function resume(ctx: AudioContext) {
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

/** unlockSoundboardAudio creates (or resumes) the audio context. Call it from
 * a user gesture so sounds from others can play later. */
export function unlockSoundboardAudio() {
  const a = getAudio();
  if (a) resume(a.ctx);
}

/** installSoundboardAudioUnlock unlocks audio on the next tap, click or key
 * press anywhere on the page. Returns a cleanup function. */
export function installSoundboardAudioUnlock(): () => void {
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const unlock = () => {
    unlockSoundboardAudio();
    remove();
  };
  const remove = () => {
    for (const e of events) document.removeEventListener(e, unlock, true);
  };
  for (const e of events) document.addEventListener(e, unlock, true);
  return remove;
}

/** playSoundboardSound plays a sound at `volume` (0–1). Returns false when
 * it can't play: no Web Audio, or the page was never interacted with (the
 * browser would block it). */
export function playSoundboardSound(id: SoundId, volume: number): boolean {
  if (!audio && !hasUserActivation()) return false;
  const a = getAudio();
  if (!a) return false;
  resume(a.ctx);
  return playOnAudio(a, id, volume);
}

function synthesize(a: SoundboardAudio, id: SoundId, volume: number) {
  try {
    scheduleSound(a.ctx, a.bus, id, { volume });
    return true;
  } catch (err) {
    console.warn("Soundboard sound failed:", err);
    return false;
  }
}

/** playOnAudio plays sound `id` on `a`: its sample if decoded, the
 * synthesized sound if the sample failed. A sample still loading plays when
 * ready, or the synth plays after SAMPLE_WAIT_MS. */
export function playOnAudio(
  a: SoundboardAudio,
  id: SoundId,
  volume: number,
): boolean {
  const buffer = a.samples.get(id);
  if (buffer === null) return synthesize(a, id, volume);
  if (buffer) {
    try {
      playSample(a.ctx, a.bus, buffer, { volume });
      return true;
    } catch (err) {
      console.warn("Soundboard sample failed:", err);
      return synthesize(a, id, volume);
    }
  }
  // Still loading: whichever comes first, the sample or the timeout.
  let done = false;
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    synthesize(a, id, volume);
  }, SAMPLE_WAIT_MS);
  void a.samples.load(id).then(() => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    playOnAudio(a, id, volume);
  });
  return true;
}
