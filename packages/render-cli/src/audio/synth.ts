/**
 * Procedural SFX: every sound is a pure function of the sample index, a seed,
 * and a pitch multiplier — the audio analogue of evaluate(scene, t). No
 * Math.random, no assets, no license questions. The `seed` shifts pitch (a
 * musical step) and texture so repeated cues sound different; `pitch` is an
 * explicit multiplier on top.
 */

import type { BgmSynth, SfxName } from "@reframe/core";
import { SAMPLE_RATE } from "./wav.js";

// Deterministic white noise (same hash family as core's wiggle).
function hash01(n: number, seed: number): number {
  let h = (n * 374761393 + seed * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}
const noise = (n: number, seed: number) => hash01(n, seed) * 2 - 1;

const TAU = Math.PI * 2;
const expDecay = (t: number, dur: number, k = 5) => Math.exp((-k * t) / dur);
// band-limited-ish square / hollow tone (cheap odd-harmonic sum)
const square = (ph: number) => (Math.sin(ph) + 0.33 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph)) / 1.4;

export interface SynthParams {
  seed?: number;
  /** Explicit frequency multiplier (1 = unchanged). Layered on top of the seed step. */
  pitch?: number;
  gainDb?: number;
}

// seed → a musical pitch multiplier (pentatonic-ish steps in semitones; seed 0 = unchanged)
const PITCH_STEPS = [0, 2, 4, 7, 9, 12, 5, -3, 16, -5];
function seedPitch(seed: number): number {
  const i = ((Math.round(seed) % PITCH_STEPS.length) + PITCH_STEPS.length) % PITCH_STEPS.length;
  return Math.pow(2, PITCH_STEPS[i]! / 12);
}

function buffer(duration: number): { out: Float32Array; n: number } {
  const n = Math.round(duration * SAMPLE_RATE);
  return { out: new Float32Array(n), n };
}

// ── transition ──────────────────────────────────────────────────────────────

/** Band-passed noise sweeping down under a swell-then-decay envelope. */
function whoosh(seed: number, pitch: number): Float32Array {
  const dur = 0.35;
  const { out, n } = buffer(dur);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const center = 1200 * pitch * Math.pow(0.25, u);
    const alpha = Math.min(1, (TAU * center) / SAMPLE_RATE);
    lp += alpha * (noise(i, seed) - lp);
    lp2 += alpha * 0.5 * (lp - lp2);
    const env = u < 0.3 ? u / 0.3 : expDecay(t - 0.3 * dur, dur * 0.7, 4);
    out[i] = (lp - lp2) * env * 2.2;
  }
  return out;
}

/** Bright, quick downward noise sweep (lighter, higher whoosh). */
function swish(seed: number, pitch: number): Float32Array {
  const dur = 0.32;
  const { out, n } = buffer(dur);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const center = 2600 * pitch * Math.pow(0.2, u);
    const alpha = Math.min(1, (TAU * center) / SAMPLE_RATE);
    lp += alpha * (noise(i, seed) - lp);
    lp2 += alpha * 0.5 * (lp - lp2);
    const env = u < 0.15 ? u / 0.15 : expDecay(t - 0.15 * dur, dur * 0.85, 5);
    out[i] = (lp - lp2) * env * 2.4;
  }
  return out;
}

/** Rising tone with a soft swell — for knob/parameter gestures. */
function rise(_seed: number, pitch: number): Float32Array {
  const dur = 0.5;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const freq = 220 * pitch * Math.pow(4, u);
    phase += (TAU * freq) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 1.5;
    out[i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * env * 0.45;
  }
  return out;
}

/** Long tension riser: rising filtered noise + rising tone, building to the end. */
function riser(seed: number, pitch: number): Float32Array {
  const dur = 0.85;
  const { out, n } = buffer(dur);
  let lp = 0, phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const center = 200 * pitch * Math.pow(12, u);
    const alpha = Math.min(1, (TAU * center) / SAMPLE_RATE);
    lp += alpha * (noise(i, seed) - lp);
    const freq = 120 * pitch * Math.pow(6, u);
    phase += (TAU * freq) / SAMPLE_RATE;
    const env = Math.pow(u, 1.6); // swells toward the climax
    out[i] = (lp * 1.6 + Math.sin(phase) * 0.5) * env * 0.9;
  }
  return out;
}

/** Sci-fi pitch warp: a vibrato'd sine sweeping up then down. */
function warp(_seed: number, pitch: number): Float32Array {
  const dur = 0.5;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const bend = Math.sin(Math.PI * u);            // 0→1→0 over the sound
    const vib = 1 + 0.4 * Math.sin(TAU * 18 * t);  // fast vibrato
    const freq = 300 * pitch * (1 + 2.5 * bend) * vib;
    phase += (TAU * freq) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * u) ** 0.8;
    out[i] = square(phase) * env * 0.5;
  }
  return out;
}

// ── ui ────────────────────────────────────────────────────────────────────

/** Tiny dry click: high sine half-cycle + filtered noise burst. */
function tick(seed: number, pitch: number): Float32Array {
  const dur = 0.03;
  const { out, n } = buffer(dur);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const sine = t < 0.004 ? Math.sin(TAU * 4000 * pitch * t) : 0;
    out[i] = (sine * 0.6 + noise(i, seed) * 0.35) * expDecay(t, dur, 8);
  }
  return out;
}

/** Crisp UI click — short mid sine + a filtered noise tap, drier than pop. */
function click(seed: number, pitch: number): Float32Array {
  const dur = 0.05;
  const { out, n } = buffer(dur);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    lp += 0.5 * (noise(i, seed) - lp);
    const sine = Math.sin(TAU * 1500 * pitch * t);
    out[i] = (sine * 0.5 + lp * 0.6) * expDecay(t, dur, 11);
  }
  return out;
}

/** Digital beep — a hollow square tone (melodic with seed). */
function blip(_seed: number, pitch: number): Float32Array {
  const dur = 0.1;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    phase += (TAU * 880 * pitch) / SAMPLE_RATE;
    const env = Math.min(1, u * 12) * Math.min(1, (1 - u) * 6); // quick in/out
    out[i] = square(phase) * env * 0.5;
  }
  return out;
}

/** Pitch-dropping sine burst with a 2 ms noise transient. */
function pop(seed: number, pitch: number): Float32Array {
  const dur = 0.12;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 600 * pitch * Math.pow(0.25, t / 0.08);
    phase += (TAU * freq) / SAMPLE_RATE;
    const transient = t < 0.002 ? noise(i, seed) * 0.5 : 0;
    out[i] = (Math.sin(phase) + transient) * expDecay(t, dur, 6) * 0.8;
  }
  return out;
}

/** Two-note rising "boop-beep" — a UI select/confirm. */
function select(_seed: number, pitch: number): Float32Array {
  const dur = 0.18;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const freq = (t < 0.08 ? 620 : 930) * pitch; // step up halfway
    phase += (TAU * freq) / SAMPLE_RATE;
    const env = Math.min(1, u * 16) * Math.min(1, (1 - u) * 5);
    out[i] = (Math.sin(phase) + 0.25 * Math.sin(2 * phase)) * env * 0.5;
  }
  return out;
}

// ── impact ──────────────────────────────────────────────────────────────────

/** Low sine drop with a bass-noise attack. */
function thud(seed: number, pitch: number): Float32Array {
  const dur = 0.25;
  const { out, n } = buffer(dur);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 90 * pitch * Math.pow(0.5, t / 0.15);
    phase += (TAU * freq) / SAMPLE_RATE;
    lp += 0.02 * (noise(i, seed) - lp);
    const attack = t < 0.01 ? lp * 3 : 0;
    out[i] = (Math.sin(phase) * 0.9 + attack) * expDecay(t, dur, 5);
  }
  return out;
}

/** Deep cinematic boom — sub-sine drop + a noise body, long tail. */
function boom(seed: number, pitch: number): Float32Array {
  const dur = 0.6;
  const { out, n } = buffer(dur);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 70 * pitch * Math.pow(0.5, t / 0.3);
    phase += (TAU * freq) / SAMPLE_RATE;
    lp += 0.06 * (noise(i, seed) - lp);
    const body = t < 0.06 ? lp * 2.5 * (1 - t / 0.06) : 0; // noisy slam
    out[i] = (Math.sin(phase) * 1.0 + body) * expDecay(t, dur, 3.2);
  }
  return out;
}

/** Wooden knock — a fast-decaying mid sine with a filtered tap. */
function knock(seed: number, pitch: number): Float32Array {
  const dur = 0.14;
  const { out, n } = buffer(dur);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 220 * pitch * Math.pow(0.7, t / 0.05);
    phase += (TAU * freq) / SAMPLE_RATE;
    lp += 0.3 * (noise(i, seed) - lp);
    const tap = t < 0.005 ? lp : 0;
    out[i] = (Math.sin(phase) * 0.8 + tap * 0.6) * expDecay(t, dur, 9);
  }
  return out;
}

// ── positive ──────────────────────────────────────────────────────────────

/** Bell — inharmonic partials decaying at different rates. */
function chime(seed: number, pitch: number): Float32Array {
  const dur = 0.7;
  const { out, n } = buffer(dur);
  const f0 = 800 * pitch;
  const partials = [
    { f: f0, a: 1.0, k: 4 },
    { f: f0 * 2.76, a: 0.5, k: 5.5 },
    { f: f0 * 5.4, a: 0.28, k: 7 },
    { f: f0 * 8.9, a: 0.13, k: 9 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const p of partials) s += Math.sin(TAU * p.f * t) * p.a * expDecay(t, dur, p.k);
    const strike = t < 0.003 ? noise(i, seed) * 0.3 : 0;
    out[i] = (s / 1.9 + strike) * 0.6;
  }
  return out;
}

/** Single clean bell — fundamental + octave, smooth decay. */
function ding(_seed: number, pitch: number): Float32Array {
  const dur = 0.5;
  const { out, n } = buffer(dur);
  const f0 = 1200 * pitch;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const s = Math.sin(TAU * f0 * t) + 0.4 * Math.sin(TAU * f0 * 2 * t) + 0.2 * Math.sin(TAU * f0 * 3.01 * t);
    out[i] = (s / 1.6) * expDecay(t, dur, 4.5) * 0.6;
  }
  return out;
}

/** Arcade coin — a quick low square then a sustained higher one. */
function coin(_seed: number, pitch: number): Float32Array {
  const dur = 0.3;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const freq = (t < 0.06 ? 988 : 1319) * pitch; // B5 → E6
    phase += (TAU * freq) / SAMPLE_RATE;
    const env = Math.min(1, u * 30) * expDecay(Math.max(0, t - 0.06), dur, 3.5);
    out[i] = square(phase) * env * 0.55;
  }
  return out;
}

/** Fast rising high arpeggio — a sparkle/twinkle glissando. */
function sparkle(seed: number, pitch: number): Float32Array {
  const dur = 0.6;
  const { out, n } = buffer(dur);
  const steps = [1, 1.5, 2, 3, 4, 5, 6]; // ascending ratios
  const base = 1200 * pitch;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    let s = 0;
    for (let g = 0; g < steps.length; g++) {
      const on = u * steps.length - g; // each grain blooms in turn
      if (on > 0 && on < 3) {
        const ge = Math.exp(-on * 1.8);
        s += Math.sin(TAU * base * steps[g]! * t + hash01(g, seed) * TAU) * ge;
      }
    }
    out[i] = (s / 2.4) * Math.sin(Math.PI * u) ** 0.5 * 0.5;
  }
  return out;
}

/** Three-note major arpeggio up — a success/complete sting. */
function success(_seed: number, pitch: number): Float32Array {
  const dur = 0.6;
  const { out, n } = buffer(dur);
  const notes = [523.25, 659.25, 783.99].map((f) => f * pitch); // C5 E5 G5
  let phase = 0, cur = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const idx = Math.min(notes.length - 1, Math.floor(u * 3.2));
    if (idx !== cur) cur = idx;
    phase += (TAU * notes[cur]!) / SAMPLE_RATE;
    const local = u * 3.2 - idx; // 0..1 within the note
    const env = Math.min(1, local * 12) * Math.min(1, (1 - Math.min(1, local)) * 4 + 0.2);
    out[i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * env * 0.42;
  }
  return out;
}

/** Five detuned high partials with slow individual tremolo. */
function shimmer(seed: number, pitch: number): Float32Array {
  const dur = 0.9;
  const { out, n } = buffer(dur);
  const partials = Array.from({ length: 5 }, (_, p) => ({
    freq: (2000 + hash01(p, seed + 7) * 2000) * pitch,
    am: 0.5 + hash01(p, seed + 8) * 1.5,
    phase: hash01(p, seed + 9) * TAU,
  }));
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const env = Math.sin(Math.PI * u) ** 1.2;
    let s = 0;
    for (const part of partials) s += Math.sin(TAU * part.freq * t + part.phase) * (0.6 + 0.4 * Math.sin(TAU * part.am * t));
    out[i] = (s / 5) * env * 0.5;
  }
  return out;
}

// ── alert ───────────────────────────────────────────────────────────────────

/** Aggressive buzzy down-sweep — a zap. */
function zap(seed: number, pitch: number): Float32Array {
  const dur = 0.22;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const freq = 1600 * pitch * Math.pow(0.12, u);
    phase += (TAU * freq) / SAMPLE_RATE;
    const grit = noise(i, seed) * 0.25;
    out[i] = (square(phase) + grit) * expDecay(t, dur, 4.5) * 0.5;
  }
  return out;
}

/** Two descending square tones — a negative/error buzz. */
function error(_seed: number, pitch: number): Float32Array {
  const dur = 0.4;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE, u = t / dur;
    const freq = (t < 0.16 ? 311 : 233) * pitch; // Eb4 → Bb3
    phase += (TAU * freq) / SAMPLE_RATE;
    const seg = t < 0.16 ? u / 0.4 : (u - 0.4) / 0.6;
    const env = Math.min(1, seg * 18) * Math.min(1, (1 - seg) * 6);
    out[i] = square(phase) * env * 0.5;
  }
  return out;
}

const RECIPES: Record<SfxName, (seed: number, pitch: number) => Float32Array> = {
  whoosh, swish, rise, riser, warp,
  tick, click, blip, pop, select,
  thud, boom, knock,
  chime, ding, coin, sparkle, shimmer, success,
  zap, error,
};

export function synthSfx(name: SfxName, params: SynthParams = {}): Float32Array {
  const seed = params.seed ?? 0;
  const pitch = (params.pitch ?? 1) * seedPitch(seed);
  const samples = RECIPES[name](seed, pitch);
  if (params.gainDb) {
    const g = Math.pow(10, params.gainDb / 20);
    for (let i = 0; i < samples.length; i++) samples[i]! *= g;
  }
  // deterministic peak guard: pitch-shifting a recipe can push its noisy peaks
  // over 1.0 (→ hard-clip distortion in the WAV). Scale back only when needed,
  // so intentionally quiet sounds keep their relative level.
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]!));
  if (peak > 0.95) {
    const g = 0.95 / peak;
    for (let i = 0; i < samples.length; i++) samples[i]! *= g;
  }
  return samples;
}

// ── background beds ───────────────────────────────────────────────────────

/** Render a chord of detuned sine voices with slow tremolo, sized to the scene. */
function pad(freqs: number[], duration: number, seed: number, opts: { amBase: number; bright: number; gain: number }): Float32Array {
  const { out, n } = buffer(duration);
  const voices = freqs.flatMap((f, v) => [
    { freq: f * (1 + (hash01(v, seed + 3) - 0.5) * 0.004), am: opts.amBase + hash01(v, seed + 4) * 0.08, phase: hash01(v, seed + 5) * TAU },
    { freq: f * (1 - (hash01(v, seed + 6) - 0.5) * 0.004), am: opts.amBase + hash01(v, seed + 7) * 0.08, phase: hash01(v, seed + 8) * TAU },
  ]);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const voice of voices) {
      s += Math.sin(TAU * voice.freq * t + voice.phase) * (0.75 + 0.25 * Math.sin(TAU * voice.am * t));
      if (opts.bright > 0) s += opts.bright * Math.sin(TAU * voice.freq * 2 * t + voice.phase);
    }
    out[i] = (s / voices.length) * opts.gain;
  }
  return out;
}

/** Three-voice detuned drone with very slow tremolo (the classic bed). */
export function synthAmbientPad(duration: number, seed = 0): Float32Array {
  return pad([110, 165, 220], duration, seed, { amBase: 0.05, bright: 0, gain: 0.7 });
}

/** Warm mellow chord (Cmaj9-ish, low) — lo-fi bed. */
function synthLofi(duration: number, seed = 0): Float32Array {
  return pad([130.81, 164.81, 196.0, 246.94], duration, seed, { amBase: 0.04, bright: 0.04, gain: 0.62 });
}

/** Rhythmic pulsing bass + fifth (~2 Hz gate) — driving bed. */
function synthPulse(duration: number, _seed = 0): Float32Array {
  const { out, n } = buffer(duration);
  const beat = 2.2; // Hz
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const ph = (t * beat) % 1;
    const gate = Math.exp(-ph * 5) * 0.9 + 0.1; // pluck each beat
    const s = Math.sin(TAU * 82 * t) + 0.6 * Math.sin(TAU * 123 * t) + 0.3 * Math.sin(TAU * 246 * t);
    out[i] = (s / 1.9) * gate * 0.6;
  }
  return out;
}

/** Dark close-interval cluster swelling + drifting up — suspense bed. */
function synthTension(duration: number, seed = 0): Float32Array {
  const { out, n } = buffer(duration);
  const base = [98, 104, 110]; // dissonant cluster
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const drift = 1 + 0.03 * (t / Math.max(0.001, duration)); // slow rise
    let s = 0;
    for (let v = 0; v < base.length; v++) {
      const f = base[v]! * drift * (1 + (hash01(v, seed) - 0.5) * 0.006);
      s += Math.sin(TAU * f * t + hash01(v, seed + 1) * TAU);
    }
    const swell = 0.6 + 0.4 * Math.sin(TAU * 0.08 * t);
    out[i] = (s / base.length) * swell * 0.6;
  }
  return out;
}

/** Bright major triad + octave with shimmer — uplifting bed. */
function synthUplift(duration: number, seed = 0): Float32Array {
  return pad([196.0, 246.94, 293.66, 392.0], duration, seed, { amBase: 0.07, bright: 0.1, gain: 0.6 });
}

const BGM_RECIPES: Record<BgmSynth, (duration: number, seed: number) => Float32Array> = {
  "ambient-pad": synthAmbientPad,
  lofi: synthLofi,
  pulse: synthPulse,
  tension: synthTension,
  uplift: synthUplift,
};

/** Dispatch a bgm synth by name. */
export function synthBgm(name: BgmSynth, duration: number, seed = 0): Float32Array {
  return BGM_RECIPES[name](duration, seed);
}
