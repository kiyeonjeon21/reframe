/**
 * Motion presets — a small NAMED vocabulary of logo-sting motions, each a
 * SEEDED GENERATOR (not a frozen template). `motionPreset(name, opts)` returns
 * a `beat` (goal-2's addressable, retimable unit) composed from the existing
 * primitives (motionPath, tween, stagger, path draw-on, expressive eases).
 *
 * Two-determinisms: same (name, knobs, seed) → identical IR (reproducible);
 * a different `seed` perturbs waypoints / timing / accents WITHIN BOUNDED
 * ranges → a measurably different motion that is still the same family. The
 * seed feeds a deterministic PRNG — no Math.random, ever.
 *
 * Universal knobs (every preset): `energy` 0..1 (settle ↔ springy overshoot),
 * `speed` (duration multiplier, >1 faster). Plus a signature knob `intensity`
 * 0..1 (the preset's amplitude) and, where spatial, `from`.
 */

import type { EaseName, TimelineIR } from "./ir.js";
import { beat, motionPath, par, seq, stagger, tween, wait } from "./dsl.js";

export type PresetName =
  | "draw-bloom"
  | "punch-in"
  | "rise-settle"
  | "slide-bank"
  | "reveal-orbit"
  | "spin-forge";

export const PRESET_NAMES: PresetName[] = [
  "draw-bloom",
  "punch-in",
  "rise-settle",
  "slide-bank",
  "reveal-orbit",
  "spin-forge",
];

/** The rig a preset drives: a group at `center` scaled to `baseScale`, with
 *  fill layers (bloom) and ink layers (draw-on outline). */
export interface PresetRig {
  group: string;
  center: [number, number];
  baseScale: number;
  fills: string[];
  inks: string[];
}

export interface PresetOpts {
  target: PresetRig;
  /** 0..1 — clean settle ↔ springy overshoot. Default 0.5. */
  energy?: number;
  /** Duration multiplier; >1 faster, <1 slower. Default 1. */
  speed?: number;
  /** 0..1 — the signature amplitude (orbit radius / rise distance / spins). Default 0.5. */
  intensity?: number;
  /** Entry direction for spatial presets. Default per preset. */
  from?: "left" | "right" | "top" | "bottom";
  /** Deterministic variation. Same seed → identical; different seed → same family. Default 0. */
  seed?: number;
}

/** mulberry32 — a deterministic PRNG seeded by an integer. Pure. */
function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** A tiny "set" tween (>0 so it validates) that establishes a start pose within
 *  the first frame, while the mark is still invisible. */
const SET = 1 / 120;

interface Ctx {
  e: number;
  sp: number;
  it: number;
  from: PresetOpts["from"];
  rand: () => number;
  jit: (amp: number) => number;
  g: string;
  cx: number;
  cy: number;
  s: number;
  fills: string[];
  inks: string[];
}

function ctx(o: PresetOpts): Ctx {
  const rand = makeRng((o.seed ?? 0) + 1);
  return {
    e: clamp01(o.energy ?? 0.5),
    sp: Math.max(0.25, o.speed ?? 1),
    it: clamp01(o.intensity ?? 0.5),
    from: o.from,
    rand,
    jit: (amp: number) => (rand() - 0.5) * 2 * amp,
    g: o.target.group,
    cx: o.target.center[0],
    cy: o.target.center[1],
    s: o.target.baseScale,
    fills: o.target.fills,
    inks: o.target.inks,
  };
}

const dur = (base: number, sp: number) => base / sp;
/** Energy → ease tier: clean → mild pop → springy. */
function settleEase(e: number): EaseName {
  return e < 0.34 ? "easeOutCubic" : e < 0.67 ? "easeOutBack" : "easeOutElastic";
}
function fromVec(from: PresetOpts["from"], dist: number): [number, number] {
  switch (from) {
    case "left":
      return [-dist, 0];
    case "right":
      return [dist, 0];
    case "top":
      return [0, -dist];
    default:
      return [0, dist];
  }
}

/** Reveal the mark by fading its fills in (no draw-on). */
function fadeFills(c: Ctx, base = 0.4, gap = 0.06): TimelineIR {
  return stagger(
    gap / c.sp,
    ...c.fills.map((id, i) =>
      tween(id, { opacity: 1 }, { duration: dur(base, c.sp), ease: "easeOutQuad", ...(i === 0 && { label: "reveal" }) }),
    ),
  );
}
/** Draw the outline on, staggered, with seed-jittered per-stroke durations. */
function drawInks(c: Ctx): TimelineIR {
  return stagger(
    0.15 / c.sp,
    ...c.inks.map((id, i) =>
      tween(id, { progress: 1 }, { duration: dur(1.3 + c.jit(0.2), c.sp), ease: "easeInOutQuad", ...(i === 0 && { label: "draw" }) }),
    ),
  );
}

export function motionPreset(name: PresetName, opts: PresetOpts): TimelineIR {
  const c = ctx(opts);
  switch (name) {
    case "draw-bloom":
      return beat("draw-bloom", {}, [
        drawInks(c),
        fadeFills(c, 0.45),
        tween(c.g, { scale: c.s * (1.02 + 0.05 * c.e) }, { duration: dur(2.4, c.sp), ease: "easeInOutQuad", label: "settle" }),
      ]);

    case "punch-in": {
      // scale-pop emphasis: peak grows with energy (the monotonic overshoot gate)
      const peak = c.s * (1 + 0.06 + 0.24 * c.e + c.jit(0.02));
      return beat("punch-in", {}, [
        par(
          fadeFills(c, 0.25),
          seq(
            tween(c.g, { scale: peak }, { duration: dur(0.45 + c.jit(0.05), c.sp), ease: "easeOutCubic", label: "punch" }),
            tween(c.g, { scale: c.s }, { duration: dur(0.5, c.sp), ease: settleEase(c.e) }),
          ),
        ),
      ]);
    }

    case "rise-settle": {
      const es = 0.65 + c.rand() * 0.7; // seed: entry-distance scale (same family, different size)
      const dist = (220 + 260 * c.it) * es;
      const [dx, dy] = fromVec(c.from ?? "bottom", dist);
      const jx = c.jit(110); // seed: lateral entry drift
      return beat("rise-settle", {}, [
        par(
          motionPath(
            c.g,
            [
              [c.cx + dx + jx, c.cy + dy],
              [c.cx + dx * 0.4 - jx * 0.6, c.cy + dy * 0.4],
              [c.cx, c.cy],
            ],
            { duration: dur(1.1, c.sp), ease: settleEase(c.e), label: "rise" },
          ),
          fadeFills(c, 0.4),
        ),
      ]);
    }

    case "slide-bank": {
      const es = 0.65 + c.rand() * 0.7; // seed: entry-distance scale
      const dist = (420 + 240 * c.it) * es;
      const [dx, dy] = fromVec(c.from ?? "left", dist);
      const arc = c.jit(140); // seed: arc height
      const midx = c.jit(120); // seed: arc lateral
      const move = dur(1.2, c.sp);
      return beat("slide-bank", {}, [
        par(
          motionPath(
            c.g,
            [
              [c.cx + dx, c.cy + dy],
              [c.cx + dx * 0.4 + midx, c.cy + dy * 0.4 - 70 - arc],
              [c.cx, c.cy],
            ],
            { duration: move, ease: settleEase(c.e), autoRotate: true, label: "slide" },
          ),
          // level the bank out once it lands (authored after the path → wins for rotation)
          seq(wait(move), tween(c.g, { rotation: 0 }, { duration: dur(0.5, c.sp), ease: "easeOutCubic" })),
          fadeFills(c, 0.4),
        ),
      ]);
    }

    case "reveal-orbit": {
      const es = 0.65 + c.rand() * 0.7; // seed: orbit-radius scale
      const orbit = (180 + 160 * c.it) * es;
      const jx = c.jit(0.4);
      const jy = c.jit(0.4);
      return beat("reveal-orbit", {}, [
        drawInks(c),
        fadeFills(c, 0.45),
        par(
          motionPath(
            c.g,
            [
              [c.cx, c.cy],
              [c.cx - orbit * (1 + jx), c.cy - orbit * 0.8],
              [c.cx + orbit * (1 + jy), c.cy - orbit],
              [c.cx, c.cy],
            ],
            { duration: dur(1.7, c.sp), ease: "easeInOutCubic", label: "orbit" },
          ),
          seq(
            tween(c.g, { scale: c.s * (1.12 + 0.1 * c.e) }, { duration: dur(0.85, c.sp), ease: "easeOutBack" }),
            tween(c.g, { scale: c.s }, { duration: dur(0.85, c.sp), ease: "easeInOutQuad" }),
          ),
        ),
      ]);
    }

    case "spin-forge": {
      const turns = 1 + Math.round(c.it); // 1 or 2 full turns
      const dir = c.rand() < 0.5 ? -1 : 1; // seed: spin direction
      const startRot = dir * 360 * turns;
      const peak = c.s * (1 + 0.05 + 0.2 * c.e); // energy → overshoot (monotonic gate)
      return beat("spin-forge", {}, [
        par(
          seq(
            tween(c.g, { scale: c.s * 0.2, rotation: startRot }, { duration: SET }), // establish (invisible)
            tween(c.g, { scale: peak, rotation: 0 }, { duration: dur(0.9, c.sp), ease: "easeOutBack", label: "spin" }),
            tween(c.g, { scale: c.s }, { duration: dur(0.3, c.sp), ease: "easeInOutQuad" }),
          ),
          seq(wait(SET), fadeFills(c, 0.3)),
        ),
      ]);
    }
  }
}
