/**
 * Procedural SFX: every sound is a pure function of the sample index and a
 * seed — the audio analogue of evaluate(scene, t). No Math.random, no assets,
 * no license questions.
 */

import type { SfxName } from "@reframe/core";
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

export interface SynthParams {
  seed?: number;
  gainDb?: number;
}

function buffer(duration: number): { out: Float32Array; n: number } {
  const n = Math.round(duration * SAMPLE_RATE);
  return { out: new Float32Array(n), n };
}

/** Band-passed noise sweeping 1200→300 Hz under a swell-then-decay envelope. */
function whoosh(seed: number): Float32Array {
  const dur = 0.35;
  const { out, n } = buffer(dur);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const u = t / dur;
    const center = 1200 * Math.pow(300 / 1200, u);
    const alpha = Math.min(1, (TAU * center) / SAMPLE_RATE);
    lp += alpha * (noise(i, seed) - lp); // low-pass
    lp2 += alpha * 0.5 * (lp - lp2); // second pole; band ≈ lp - lp2
    const env = u < 0.3 ? u / 0.3 : expDecay(t - 0.3 * dur, dur * 0.7, 4);
    out[i] = (lp - lp2) * env * 2.2;
  }
  return out;
}

/** Pitch-dropping sine burst with a 2ms noise transient. */
function pop(seed: number): Float32Array {
  const dur = 0.12;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 600 * Math.pow(150 / 600, t / 0.08);
    phase += (TAU * freq) / SAMPLE_RATE;
    const transient = t < 0.002 ? noise(i, seed) * 0.5 : 0;
    out[i] = (Math.sin(phase) + transient) * expDecay(t, dur, 6) * 0.8;
  }
  return out;
}

/** Tiny dry click: high sine half-cycle + filtered noise burst. */
function tick(seed: number): Float32Array {
  const dur = 0.03;
  const { out, n } = buffer(dur);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const sine = t < 0.004 ? Math.sin(TAU * 4000 * t) : 0;
    out[i] = (sine * 0.6 + noise(i, seed) * 0.35) * expDecay(t, dur, 8);
  }
  return out;
}

/** Rising tone with a soft swell — for knob/parameter gestures. */
function rise(seed: number): Float32Array {
  const dur = 0.5;
  const { out, n } = buffer(dur);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const u = t / dur;
    const freq = 220 * Math.pow(880 / 220, u);
    phase += (TAU * freq) / SAMPLE_RATE;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 1.5;
    out[i] = (Math.sin(phase) + 0.3 * Math.sin(2 * phase)) * env * 0.45;
  }
  return out;
}

/** Five detuned high partials with slow individual tremolo. */
function shimmer(seed: number): Float32Array {
  const dur = 0.9;
  const { out, n } = buffer(dur);
  const partials = Array.from({ length: 5 }, (_, p) => ({
    freq: 2000 + hash01(p, seed + 7) * 2000,
    am: 0.5 + hash01(p, seed + 8) * 1.5,
    phase: hash01(p, seed + 9) * TAU,
  }));
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const u = t / dur;
    const env = Math.sin(Math.PI * u) ** 1.2;
    let s = 0;
    for (const part of partials) {
      s += Math.sin(TAU * part.freq * t + part.phase) * (0.6 + 0.4 * Math.sin(TAU * part.am * t));
    }
    out[i] = (s / 5) * env * 0.5;
  }
  return out;
}

/** Low sine drop with a bass-noise attack. */
function thud(seed: number): Float32Array {
  const dur = 0.25;
  const { out, n } = buffer(dur);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 90 * Math.pow(45 / 90, t / 0.15);
    phase += (TAU * freq) / SAMPLE_RATE;
    lp += 0.02 * (noise(i, seed) - lp);
    const attack = t < 0.01 ? lp * 3 : 0;
    out[i] = (Math.sin(phase) * 0.9 + attack) * expDecay(t, dur, 5);
  }
  return out;
}

const RECIPES: Record<SfxName, (seed: number) => Float32Array> = {
  whoosh,
  pop,
  tick,
  rise,
  shimmer,
  thud,
};

export function synthSfx(name: SfxName, params: SynthParams = {}): Float32Array {
  const samples = RECIPES[name](params.seed ?? 0);
  if (params.gainDb) {
    const g = Math.pow(10, params.gainDb / 20);
    for (let i = 0; i < samples.length; i++) samples[i]! *= g;
  }
  return samples;
}

/** Three-voice detuned drone with very slow tremolo, sized to the scene. */
export function synthAmbientPad(duration: number, seed = 0): Float32Array {
  const { out, n } = buffer(duration);
  const voices = [110, 165, 220].flatMap((f, v) => [
    { freq: f * (1 + (hash01(v, seed + 3) - 0.5) * 0.004), am: 0.05 + hash01(v, seed + 4) * 0.08, phase: hash01(v, seed + 5) * TAU },
    { freq: f * (1 - (hash01(v, seed + 6) - 0.5) * 0.004), am: 0.05 + hash01(v, seed + 7) * 0.08, phase: hash01(v, seed + 8) * TAU },
  ]);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const voice of voices) {
      s += Math.sin(TAU * voice.freq * t + voice.phase) * (0.75 + 0.25 * Math.sin(TAU * voice.am * t));
    }
    out[i] = (s / voices.length) * 0.7;
  }
  return out;
}
