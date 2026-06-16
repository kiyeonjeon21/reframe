/**
 * characterPreset — a SEEDED motion generator for the humanoid rig. The
 * character analog of `motionPreset`: `characterPreset(name, opts)` returns a
 * `beat` (a TimelineIR) that drives a `humanoid()` rig's joints through a named
 * performance (walk/run/jump/dance/wave/cheer). Same `(name, knobs, seed)` →
 * identical IR; a different `seed` varies it within the family.
 *
 *   seq(characterPreset("walk", { target: "hero", at: [CX, BASE_Y], cycles: 4 }))
 *
 * Pure keyframe timeline (a beat can't hold behaviors): secondary motion is
 * baked into poses; continuous idle stays the author's `oscillate`. Legs use the
 * 2-bone `ikReach` solver (foot targets relative to the hip → natural knee bend);
 * arms swing via FK. Assumes the `humanoid()` joint names.
 */

import { beat, par, seq, tween } from "./dsl.js";
import type { TimelineIR } from "./ir.js";
import { ikReach, poseTo, type Pose } from "./rig.js";

export const CHARACTER_PRESET_NAMES = ["walk", "run", "jump", "dance", "wave", "cheer"] as const;
export type CharacterPresetName = (typeof CHARACTER_PRESET_NAMES)[number];

export interface CharacterPresetOpts {
  /** humanoid rig id — joints are `${target}-${name}`, outer group = `${target}`. */
  target: string;
  /** 0..1 — stride / swing / bounce / jump-height amplitude (default 0.5). */
  energy?: number;
  /** >0 — tempo; durations divide by it (default 1, min 0.25). */
  speed?: number;
  /** Deterministic within-family variation (default 0). */
  seed?: number;
  /** Repeats for cyclic motions walk/run/dance (default 4). */
  cycles?: number;
  /** 1 = faces/moves right (default 1). */
  facing?: 1 | -1;
  /** The rig's scene position — needed to translate the body (walk travel, jump lift). Default [0,0]. */
  at?: [number, number];
  /** px travelled per cycle for walk/run (default ~stride·2; 0 = walk in place). */
  travel?: number;
}

// humanoid limb geometry (must match rig.ts humanoid())
const THIGH = 76, SHIN = 72;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** mulberry32 — replicated from presets.ts so determinism matches exactly. */
function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dur = (base: number, sp: number) => base / sp;

interface Ctx {
  g: string;
  e: number;
  sp: number;
  cycles: number;
  facing: number;
  at: [number, number];
  travel: number | undefined;
  rand: () => number;
  jit: (amp: number) => number;
}
function ctx(o: CharacterPresetOpts): Ctx {
  const rand = makeRng((o.seed ?? 0) + 1);
  return {
    g: o.target,
    e: clamp01(o.energy ?? 0.5),
    sp: Math.max(0.25, o.speed ?? 1),
    cycles: Math.max(1, Math.round(o.cycles ?? 4)),
    facing: o.facing ?? 1,
    at: o.at ?? [0, 0],
    travel: o.travel,
    rand,
    jit: (amp) => (rand() - 0.5) * 2 * amp,
  };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Foot offset relative to its hip over a gait phase p∈[0,1): planted forward→back
 * during stance, lifted+swung forward during swing. dx forward-positive. */
function footPos(p: number, stride: number, lift: number): [number, number] {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) {
    const u = p / 0.5; // stance: +stride → −stride, planted
    return [stride * (1 - 2 * u), 138];
  }
  const u = (p - 0.5) / 0.5; // swing: −stride → +stride, lifted mid-arc
  return [-stride + 2 * stride * u, 138 - Math.sin(Math.PI * u) * lift];
}

/** One gait keyframe pose at phase `ph` (left-leg phase). */
function gaitPose(ph: number, stride: number, lift: number, armSwing: number, facing: number): Pose {
  const fl = footPos(ph, stride, lift);
  const fr = footPos(ph + 0.5, stride, lift);
  const [hipL, kneeL] = ikReach(THIGH, SHIN, facing * fl[0], fl[1], facing < 0);
  const [hipR, kneeR] = ikReach(THIGH, SHIN, facing * fr[0], fr[1], facing < 0);
  const swing = Math.cos(2 * Math.PI * ph); // +1 at ph0 (left foot fwd → right arm fwd)
  return {
    legUpperL: round(hipL), legLowerL: round(kneeL),
    legUpperR: round(hipR), legLowerR: round(kneeR),
    armUpperR: round(-10 - armSwing * swing), armLowerR: -16,
    armUpperL: round(10 + armSwing * swing), armLowerL: 16,
  };
}

/** walk & run share a gait; run is bigger, faster, with a forward lean. */
function gait(c: Ctx, run: boolean): TimelineIR {
  const stride = (run ? 34 : 24) + (run ? 40 : 30) * c.e + c.jit(3);
  const lift = run ? 40 : 26;
  const armSwing = (run ? 26 : 16) + 20 * c.e;
  const halfDur = (run ? 0.26 : 0.42) + c.jit(0.02);
  const lean = run ? c.facing * -6 : 0; // run leans into the direction
  const steps = c.cycles * 2;
  const d = dur(halfDur, c.sp);

  const intro = dur(0.16, c.sp);
  const keys: TimelineIR[] = [];
  for (let k = 0; k <= steps; k++) {
    const pose: Pose = { ...gaitPose(k / 2, stride, lift, armSwing, c.facing), chest: lean };
    keys.push(poseTo(c.g, pose, { duration: k === 0 ? intro : d, ease: k === 0 ? "easeOutQuad" : "linear" }));
  }
  const total = intro + steps * d;
  const travel = c.travel ?? stride * 2;
  const children: TimelineIR[] = [seq(...keys)];
  if (travel !== 0) {
    children.push(tween(c.g, { x: c.at[0] + c.facing * travel * c.cycles }, { duration: total, ease: "linear", label: "travel" }));
  }
  return beat(run ? "run" : "walk", {}, [par(...children)]);
}

function jumpBeat(c: Ctx): TimelineIR {
  const h = 120 + 150 * c.e;
  const [y0] = [c.at[1]];
  const CROUCH: Pose = { legUpperL: 18, legLowerL: 54, legUpperR: -18, legLowerR: 54, armUpperL: 28, armUpperR: -28 };
  const LAUNCH: Pose = { legUpperL: 0, legLowerL: 0, legUpperR: 0, legLowerR: 0, armUpperL: 150, armUpperR: -150 };
  const TUCK: Pose = { legUpperL: -28, legLowerL: 66, legUpperR: -28, legLowerR: 66, armUpperL: 124, armUpperR: -124 };
  const REST: Pose = { legUpperL: 3, legLowerL: -2, legUpperR: -3, legLowerR: 2, armUpperL: 10, armLowerL: 8, armUpperR: -10, armLowerR: -8 };
  const j = c.jit(0.03);
  return beat("jump", {}, [
    seq(
      par(poseTo(c.g, CROUCH, { duration: dur(0.24, c.sp), ease: "easeOutQuad" }), tween(c.g, { y: y0 + 26 }, { duration: dur(0.24, c.sp), ease: "easeOutQuad" })),
      par(poseTo(c.g, LAUNCH, { duration: dur(0.22 + j, c.sp), ease: "easeOutCubic" }), tween(c.g, { y: y0 - h }, { duration: dur(0.36, c.sp), ease: "easeOutCubic", label: "launch" })),
      poseTo(c.g, TUCK, { duration: dur(0.22, c.sp) }),
      par(poseTo(c.g, CROUCH, { duration: dur(0.28, c.sp), ease: "easeInQuad" }), tween(c.g, { y: y0 + 18 }, { duration: dur(0.3, c.sp), ease: "easeInCubic", label: "land" })),
      par(poseTo(c.g, REST, { duration: dur(0.45, c.sp), ease: "easeOutBack" }), tween(c.g, { y: y0 }, { duration: dur(0.45, c.sp), ease: "easeOutBack" })),
    ),
  ]);
}

function danceBeat(c: Ctx): TimelineIR {
  const y0 = c.at[1];
  const sway = 8 + 6 * c.e;
  const armUp = 130 + 30 * c.e;
  const A: Pose = { chest: sway, head: -sway * 0.5, armUpperR: -armUp, armLowerR: -20, armUpperL: 40, armLowerL: 30, legUpperL: 8, legUpperR: -2 };
  const B: Pose = { chest: -sway, head: sway * 0.5, armUpperL: armUp, armLowerL: 20, armUpperR: -40, armLowerR: -30, legUpperL: 2, legUpperR: -8 };
  const d = dur(0.34, c.sp);
  const keys: TimelineIR[] = [];
  for (let k = 0; k < c.cycles * 2; k++) {
    const pose = k % 2 === 0 ? A : B;
    keys.push(par(
      poseTo(c.g, pose, { duration: d, ease: "easeInOutQuad" }),
      tween(c.g, { y: y0 - (k % 2 === 0 ? 14 : 0) }, { duration: d, ease: "easeInOutQuad" }),
    ));
  }
  keys.push(tween(c.g, { y: y0 }, { duration: d }));
  return beat("dance", {}, [seq(...keys)]);
}

function waveBeat(c: Ctx): TimelineIR {
  const n = 3 + Math.round(c.rand() * 2);
  const amp = 16 + 10 * c.e;
  const steps: TimelineIR[] = [poseTo(c.g, { armUpperR: -150, armLowerR: -24 }, { duration: dur(0.4, c.sp), ease: "easeOutBack" })];
  for (let k = 0; k < n; k++) {
    steps.push(poseTo(c.g, { armLowerR: -24 + (k % 2 === 0 ? amp : -amp) }, { duration: dur(0.22, c.sp), ease: "easeInOutQuad" }));
  }
  steps.push(poseTo(c.g, { armUpperR: -10, armLowerR: -8 }, { duration: dur(0.4, c.sp), ease: "easeInOutCubic" }));
  return beat("wave", {}, [seq(...steps)]);
}

function cheerBeat(c: Ctx): TimelineIR {
  const y0 = c.at[1];
  const UP: Pose = { armUpperL: 152, armLowerL: 8, armUpperR: -152, armLowerR: -8 };
  const d = dur(0.3, c.sp);
  const keys: TimelineIR[] = [poseTo(c.g, UP, { duration: dur(0.35, c.sp), ease: "easeOutBack" })];
  for (let k = 0; k < c.cycles; k++) {
    keys.push(par(tween(c.g, { y: y0 - 28 }, { duration: d, ease: "easeOutQuad" }), poseTo(c.g, { armUpperL: 160, armUpperR: -160 }, { duration: d })));
    keys.push(par(tween(c.g, { y: y0 }, { duration: d, ease: "easeInQuad" }), poseTo(c.g, { armUpperL: 145, armUpperR: -145 }, { duration: d })));
  }
  return beat("cheer", {}, [seq(...keys)]);
}

export function characterPreset(name: CharacterPresetName, opts: CharacterPresetOpts): TimelineIR {
  const c = ctx(opts);
  switch (name) {
    case "walk": return gait(c, false);
    case "run": return gait(c, true);
    case "jump": return jumpBeat(c);
    case "dance": return danceBeat(c);
    case "wave": return waveBeat(c);
    case "cheer": return cheerBeat(c);
    default: {
      const _exhaustive: never = name;
      throw new Error(`unknown characterPreset "${_exhaustive}"`);
    }
  }
}
