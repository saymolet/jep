/** Soundboard sounds, synthesized with the Web Audio API: no audio files to
 * license or host. Every sound is scheduled on a context (a live
 * AudioContext, or an OfflineAudioContext in tests/tuning) into `out`, and
 * lasts at most MAX_SOUND_SECONDS. */
import type { SoundId } from "./messages";

export const MAX_SOUND_SECONDS = 2;

/** How long each sound lasts, in seconds (its last node stops by then). */
export const SOUND_DURATION_S: Record<SoundId, number> = {
  applause: 1.9,
  drumroll: 2,
  tada: 1.6,
  wrong: 0.9,
  airhorn: 1.3,
  laugh: 1.25,
  ooh: 1.6,
  crickets: 1.8,
  ding: 1.6,
};

/** Per-sound gain so all sounds are about equally loud: measured on an
 * offline render at volume 1, the loudest 30% of each sound is about
 * -16 dBFS RMS (crickets -20, drumroll -19.5 to keep its crash below
 * clipping) and every peak stays below 1. */
export const SOUND_LEVEL: Record<SoundId, number> = {
  applause: 1.95,
  drumroll: 0.9,
  tada: 1.15,
  wrong: 0.53,
  airhorn: 0.3,
  laugh: 1.55,
  ooh: 0.3,
  // High-pitched: sounds louder than it measures.
  crickets: 0.9,
  ding: 1.4,
};

type Ctx = BaseAudioContext;

/** Silence to fade to/from: exponential ramps can't reach 0. */
const SILENT = 0.0001;

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();

/** noiseBuffer is 2 s of white noise, made once per context. */
function noiseBuffer(ctx: Ctx): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** A gain with a percussive envelope: quick attack, exponential decay. */
function percussiveGain(
  ctx: Ctx,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, SILENT), t + attack);
  g.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  return g;
}

/** A gain that rises, holds and falls (linear), for sustained notes. */
function sustainedGain(
  ctx: Ctx,
  t: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
  return g;
}

/** A burst of filtered noise. */
function noiseBurst(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  {
    filter,
    frequency,
    q = 1,
    peak,
    attack = 0.002,
    decay,
  }: {
    filter: BiquadFilterType;
    frequency: number;
    q?: number;
    peak: number;
    attack?: number;
    decay: number;
  },
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = frequency;
  f.Q.value = q;
  const g = percussiveGain(ctx, t, peak, attack, decay);
  src.connect(f).connect(g).connect(out);
  // Start somewhere random in the buffer so bursts don't sound identical.
  src.start(t, Math.random() * 1.5, attack + decay + 0.01);
}

function oscillator(
  ctx: Ctx,
  type: OscillatorType,
  frequency: number,
  detuneCents = 0,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detuneCents;
  return osc;
}

/** Simple seeded randomness is not needed: Math.random keeps each
 * performance a little different, like the real thing. */
function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// The sounds

/** Applause: a crowd of hand claps (short band-passed noise bursts) over a
 * soft noise bed, swelling in and dying away. */
function applause(ctx: Ctx, out: AudioNode, t: number) {
  const end = 1.85;
  const bed = ctx.createBufferSource();
  bed.buffer = noiseBuffer(ctx);
  const bedFilter = ctx.createBiquadFilter();
  bedFilter.type = "bandpass";
  bedFilter.frequency.value = 1800;
  bedFilter.Q.value = 0.6;
  const bedGain = sustainedGain(ctx, t, 0.3, 0.25, 0.9, end - 1.15);
  bed.connect(bedFilter).connect(bedGain).connect(out);
  bed.start(t, 0, end);

  for (let at = 0; at < end - 0.1; ) {
    // Busier and louder in the middle, sparse at the end.
    const fade = at < 0.25 ? 0.5 + at * 2 : at > 1.1 ? (end - at) / 0.75 : 1;
    noiseBurst(ctx, out, t + at, {
      filter: "bandpass",
      frequency: between(900, 2600),
      q: 1.4,
      peak: between(0.35, 0.8) * fade,
      decay: between(0.03, 0.07),
    });
    at += between(0.012, 0.04) / Math.max(fade, 0.35);
  }
}

/** Drumroll: a snare roll getting louder, ending in a cymbal crash and a
 * kick drum. */
function drumroll(ctx: Ctx, out: AudioNode, t: number) {
  const rollEnd = 1.35;
  let i = 0;
  for (let at = 0; at < rollEnd; at += 0.042, i++) {
    const crescendo = 0.25 + 0.6 * (at / rollEnd);
    // Alternating hands: every other stroke a little softer.
    const hand = i % 2 === 0 ? 1 : 0.8;
    noiseBurst(ctx, out, t + at, {
      filter: "highpass",
      frequency: 1200,
      q: 0.7,
      peak: crescendo * hand,
      decay: 0.06,
    });
    // The drum's body.
    const body = oscillator(ctx, "triangle", 190);
    const bodyGain = percussiveGain(ctx, t + at, 0.25 * crescendo, 0.002, 0.05);
    body.connect(bodyGain).connect(out);
    body.start(t + at);
    body.stop(t + at + 0.06);
  }

  const hit = t + rollEnd + 0.05;
  noiseBurst(ctx, out, hit, {
    filter: "highpass",
    frequency: 4500,
    q: 0.5,
    peak: 0.5,
    attack: 0.004,
    decay: 0.55,
  });
  const kick = oscillator(ctx, "sine", 150);
  kick.frequency.setValueAtTime(150, hit);
  kick.frequency.exponentialRampToValueAtTime(45, hit + 0.18);
  const kickGain = percussiveGain(ctx, hit, 0.5, 0.003, 0.35);
  kick.connect(kickGain).connect(out);
  kick.start(hit);
  kick.stop(hit + 0.4);
}

/** One brass-like note: two detuned saws through a low-pass filter that opens
 * with the attack. */
function brassNote(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  frequency: number,
  duration: number,
  peak: number,
  vibrato?: AudioNode,
) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(600, t);
  filter.frequency.linearRampToValueAtTime(3200, t + 0.04);
  filter.frequency.linearRampToValueAtTime(2000, t + 0.2);
  const g = sustainedGain(ctx, t, peak, 0.03, duration - 0.13, 0.1);
  filter.connect(g).connect(out);
  for (const detune of [-7, 7]) {
    const osc = oscillator(ctx, "sawtooth", frequency, detune);
    if (vibrato) vibrato.connect(osc.frequency);
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + duration);
  }
}

/** Ta-da: a short pickup chord and a long, bright chord. */
function tada(ctx: Ctx, out: AudioNode, t: number) {
  for (const f of [392, 493.88, 587.33]) {
    brassNote(ctx, out, t, f, 0.15, 0.12);
  }
  const vibrato = oscillator(ctx, "sine", 5.5);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(5, t + 0.7);
  vibrato.connect(depth);
  vibrato.start(t);
  vibrato.stop(t + 1.6);
  for (const f of [523.25, 659.25, 783.99, 1046.5]) {
    brassNote(ctx, out, t + 0.19, f, 1.35, 0.1, depth);
  }
}

/** Wrong answer: a low, raspy game-show buzzer. */
function wrong(ctx: Ctx, out: AudioNode, t: number) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1500;
  const g = sustainedGain(ctx, t, 0.3, 0.01, 0.75, 0.08);
  filter.connect(g).connect(out);
  for (const [type, f] of [
    ["square", 146],
    ["sawtooth", 151],
  ] as const) {
    const osc = oscillator(ctx, type, f);
    osc.frequency.setValueAtTime(f, t + 0.6);
    osc.frequency.linearRampToValueAtTime(f * 0.88, t + 0.84);
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + 0.86);
  }
}

/** A soft-clipping curve for the air horn's growl. */
function distortionCurve(amount: number) {
  // An odd length puts 0 exactly in the middle (no DC offset in silence).
  const n = 257;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(amount * x);
  }
  return curve;
}

/** Air horn: three blasts (short, short, long) of a loud detuned chord with a
 * little pitch bend at the start of each. */
function airhorn(ctx: Ctx, out: AudioNode, t: number) {
  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve(3);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3500;
  shaper.connect(filter).connect(out);

  const blasts: [number, number][] = [
    [0, 0.13],
    [0.18, 0.13],
    [0.36, 0.9],
  ];
  for (const [start, length] of blasts) {
    const at = t + start;
    const g = sustainedGain(ctx, at, 0.22, 0.01, length - 0.06, 0.05);
    g.connect(shaper);
    for (const [ratio, detune] of [
      [1, 0],
      [1, 12],
      [1, -12],
      [1.5, 4],
    ]) {
      const f = 415 * ratio;
      const osc = oscillator(ctx, "sawtooth", f, detune);
      osc.frequency.setValueAtTime(f * 0.92, at);
      osc.frequency.exponentialRampToValueAtTime(f, at + 0.05);
      osc.connect(g);
      osc.start(at);
      osc.stop(at + length);
    }
  }
}

/** A voice through two formant (vowel) filters. */
function formantVoice(
  ctx: Ctx,
  out: AudioNode,
  formants: [frequency: number, q: number, gain: number][],
): AudioNode {
  const input = ctx.createGain();
  for (const [frequency, q, gain] of formants) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = frequency;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    input.connect(f).connect(g).connect(out);
  }
  return input;
}

/** Laugh: "ha-ha-ha-ha-ha", falling in pitch. */
function laugh(ctx: Ctx, out: AudioNode, t: number) {
  // "a" as in "ha".
  const voice = formantVoice(ctx, out, [
    [800, 6, 1.6],
    [1200, 8, 1.1],
    [2600, 10, 0.4],
  ]);
  for (let i = 0; i < 5; i++) {
    const at = t + i * 0.2;
    const pitch = 310 - i * 18;
    const g = sustainedGain(ctx, at + 0.03, 0.6, 0.02, 0.07, 0.06);
    g.connect(voice);
    const osc = oscillator(ctx, "sawtooth", pitch);
    osc.frequency.setValueAtTime(pitch, at + 0.03);
    osc.frequency.linearRampToValueAtTime(pitch * 0.88, at + 0.18);
    osc.connect(g);
    osc.start(at + 0.03);
    osc.stop(at + 0.19);
    // The breathy "h".
    noiseBurst(ctx, out, at, {
      filter: "bandpass",
      frequency: 1600,
      q: 0.8,
      peak: 0.12,
      attack: 0.01,
      decay: 0.05,
    });
  }
}

/** Ooh: a crowd going "ooooh", rising then falling. */
function ooh(ctx: Ctx, out: AudioNode, t: number) {
  // "oo" as in "ooh".
  const voice = formantVoice(ctx, out, [
    [350, 5, 1.8],
    [800, 7, 0.7],
  ]);
  const g = sustainedGain(ctx, t, 0.5, 0.3, 0.75, 0.5);
  g.connect(voice);
  for (const base of [150, 185, 220, 262, 300, 330]) {
    const f = base * between(0.98, 1.02);
    const osc = oscillator(ctx, "sawtooth", f, between(-15, 15));
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.linearRampToValueAtTime(f * 1.18, t + 0.5);
    osc.frequency.linearRampToValueAtTime(f * 0.86, t + 1.55);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 1.58);
  }
}

/** Crickets: two crickets chirping in the awkward silence. */
function crickets(ctx: Ctx, out: AudioNode, t: number) {
  const crickets: [frequency: number, offset: number, peak: number][] = [
    [4400, 0, 0.35],
    [4750, 0.17, 0.22],
  ];
  for (const [frequency, offset, peak] of crickets) {
    for (let chirp = offset; chirp < 1.6; chirp += 0.4) {
      const osc = oscillator(ctx, "sine", frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + chirp);
      // Three quick pulses per chirp.
      for (let p = 0; p < 3; p++) {
        const at = t + chirp + p * 0.04;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + 0.006);
        g.gain.linearRampToValueAtTime(0, at + 0.028);
      }
      osc.connect(g).connect(out);
      osc.start(t + chirp);
      osc.stop(t + chirp + 0.13);
    }
  }
}

/** A bell strike: a few inharmonic partials, each fading at its own rate. */
function bell(ctx: Ctx, out: AudioNode, t: number, f: number, peak: number) {
  const partials: [ratio: number, gain: number, decay: number][] = [
    [1, 1, 1.3],
    [2, 0.35, 0.8],
    [2.76, 0.25, 0.5],
    [5.4, 0.1, 0.25],
  ];
  for (const [ratio, gain, decay] of partials) {
    const osc = oscillator(ctx, "sine", f * ratio);
    const g = percussiveGain(ctx, t, peak * gain, 0.003, decay);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.01);
  }
}

/** Ding: a bright "ding-ding" of a correct-answer bell. */
function ding(ctx: Ctx, out: AudioNode, t: number) {
  bell(ctx, out, t, 1046.5, 0.35);
  bell(ctx, out, t + 0.14, 1318.5, 0.35);
}

const SYNTHS: Record<SoundId, (ctx: Ctx, out: AudioNode, t: number) => void> = {
  applause,
  drumroll,
  tada,
  wrong,
  airhorn,
  laugh,
  ooh,
  crickets,
  ding,
};

/** scheduleSound schedules sound `id` on `ctx` into `destination`, starting
 * at `when` (default: now) at `volume` (0–1). Returns its duration in
 * seconds. */
export function scheduleSound(
  ctx: Ctx,
  destination: AudioNode,
  id: SoundId,
  { volume, when = ctx.currentTime }: { volume: number; when?: number },
): number {
  const out = ctx.createGain();
  out.gain.value = Math.max(0, Math.min(1, volume)) * SOUND_LEVEL[id];
  out.connect(destination);
  SYNTHS[id](ctx, out, when);
  return SOUND_DURATION_S[id];
}
