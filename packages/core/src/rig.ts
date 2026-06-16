/**
 * Character rig: a first-class, declarative skeleton that COMPILES to plain IR.
 * The character analog of `devicePreset` (generates a NodeIR subtree) and
 * `motionPreset` (motion vocabulary). A `Bone` tree → nested `group` joints with
 * stable ids, each holding the bone's vector art; posing is forward-kinematics
 * (tween a joint group's `rotation`). Because it lowers to groups + paths, it
 * inherits the renderer, evaluate, overlay editing, preview, validation and the
 * determinism/golden contract for free — purely additive.
 *
 *   const body = humanoid({ id: "hero" });          // one-call skeleton
 *   poseTo("hero", { armUpperR: -150 }, { duration: 0.4 });   // wave
 *
 * Bone convention: the joint sits at the group origin (0,0); the bone extends
 * along +Y at rotation 0. A child joint's `at` pivot is in the PARENT bone's
 * local space (e.g. an elbow at [0, upperLength]). Joint names are the STABLE
 * regen addresses — id `${id}-${name}`; never rename them across a regen. Each
 * rig instance needs a distinct `id` (duplicate joints collide via the scene's
 * duplicate-id validation, exactly like `devicePreset`).
 */

import { group, par, path, stagger, tween } from "./dsl.js";
import type { Ease, NodeIR, TimelineIR } from "./ir.js";

export interface Bone {
  /** Stable joint name → group id `${id}-${name}`. */
  name: string;
  /** Joint pivot, in the PARENT bone's local space (root: usually [0,0]). */
  at: [number, number];
  /** Bone length along +Y — drives the default capsule shape and IK. */
  length?: number;
  /** Default-capsule width (default 20). */
  width?: number;
  /** Rest-pose angle (deg); 0 = points down (+Y). */
  rotation?: number;
  /** Custom bone art (joint at origin, extends +Y) — overrides the default capsule. */
  shape?: NodeIR[];
  children?: Bone[];
}

export interface RigOpts {
  /** Id PREFIX for the outer group and every joint (default "rig"); unique per instance. */
  id?: string;
  /** Root placement (default 0,0). */
  x?: number;
  y?: number;
  /** Uniform scale (default 1). */
  scale?: number;
  /** Outer-group opacity (default 1) — start hidden for an entrance. */
  opacity?: number;
  /** Bone line colour (default warm). */
  color?: string;
  /** Bone fill (default near-bg, so overlapping joints occlude cleanly). */
  fill?: string;
  /** Glow accent for the double-path look on default bones (default off). */
  glow?: string | false;
}

/** jointName → angle (deg). */
export type Pose = Record<string, number>;

const DEFAULT_LINE = "#FFE3D2";
const DEFAULT_FILL = "#0E1424";
const LINE_W = 5;
const GLOW_W = 16;
const K = 0.5523; // circle-arc cubic-bezier constant
const n = (v: number) => Number(v.toFixed(2));

/** A vertical capsule from the joint (≈y 0) to ≈y len, all cubic beziers (so a
 * bone can also morph). Joint at the top-centre. */
function capsulePath(hw: number, len: number): string {
  const yT = hw;
  const yB = Math.max(hw, len - hw);
  const k = hw * K;
  return (
    `M ${n(-hw)} ${n(yT)} ` +
    `C ${n(-hw)} ${n(yT - k)} ${n(-k)} ${n(yT - hw)} 0 ${n(yT - hw)} ` +
    `C ${n(k)} ${n(yT - hw)} ${n(hw)} ${n(yT - k)} ${n(hw)} ${n(yT)} ` +
    `L ${n(hw)} ${n(yB)} ` +
    `C ${n(hw)} ${n(yB + k)} ${n(k)} ${n(yB + hw)} 0 ${n(yB + hw)} ` +
    `C ${n(-k)} ${n(yB + hw)} ${n(-hw)} ${n(yB + k)} ${n(-hw)} ${n(yB)} Z`
  );
}

/** A 4-cubic oval (morphable) centred at (cx,cy). Handy for heads/torsos/hands. */
export function ovalPath(a: number, b: number, cx = 0, cy = 0): string {
  const ka = n(a * K), kb = n(b * K);
  const t = n(cy - b), bo = n(cy + b), c = n(cy), A = n(a), L = n(-a), X = n(cx);
  return (
    `M ${X} ${t} C ${n(cx + ka)} ${t} ${n(cx + A)} ${n(cy - kb)} ${n(cx + A)} ${c} ` +
    `C ${n(cx + A)} ${n(cy + kb)} ${n(cx + ka)} ${bo} ${X} ${bo} ` +
    `C ${n(cx - ka)} ${bo} ${n(cx + L)} ${n(cy + kb)} ${n(cx + L)} ${c} ` +
    `C ${n(cx + L)} ${n(cy - kb)} ${n(cx - ka)} ${t} ${X} ${t} Z`
  );
}

type BoneStyle = { color: string; fill: string; glow: string | false | undefined };

function boneShape(jointId: string, bone: Bone, o: BoneStyle): NodeIR[] {
  if (bone.shape) return bone.shape; // custom art, verbatim
  const len = bone.length ?? 0;
  if (len <= 0) return []; // a pure pivot joint (no visible bone)
  const d = capsulePath((bone.width ?? 20) / 2, len);
  const nodes: NodeIR[] = [];
  if (o.glow) nodes.push(path({ id: `${jointId}-glow`, d, x: 0, y: 0, fill: "none", stroke: o.glow, strokeWidth: GLOW_W, opacity: 0.18 }));
  nodes.push(path({ id: `${jointId}-shape`, d, x: 0, y: 0, fill: o.fill, stroke: o.color, strokeWidth: LINE_W }));
  return nodes;
}

function buildBone(bone: Bone, id: string, o: BoneStyle): NodeIR {
  const jointId = `${id}-${bone.name}`;
  return group(
    { id: jointId, x: bone.at[0], y: bone.at[1], rotation: bone.rotation ?? 0 },
    [...boneShape(jointId, bone, o), ...(bone.children ?? []).map((c) => buildBone(c, id, o))],
  );
}

/** Compile a skeleton to a NodeIR group tree. Outer group id = `${id}`; each
 * joint = `${id}-${name}` (the stable pose/overlay address). */
export function rig(root: Bone, opts: RigOpts = {}): NodeIR {
  const id = opts.id ?? "rig";
  const o: BoneStyle = { color: opts.color ?? DEFAULT_LINE, fill: opts.fill ?? DEFAULT_FILL, glow: opts.glow };
  return group(
    { id, x: opts.x ?? 0, y: opts.y ?? 0, scale: opts.scale ?? 1, opacity: opts.opacity ?? 1 },
    [buildBone(root, id, o)],
  );
}

/** A pose as a `states` fragment: `{ "${id}-${joint}": { rotation } }`. Merge
 * into scene `states` and transition with the existing `to(state, …)`. */
export function rigPose(id: string, pose: Pose): Record<string, { rotation: number }> {
  const out: Record<string, { rotation: number }> = {};
  for (const [name, deg] of Object.entries(pose)) out[`${id}-${name}`] = { rotation: deg };
  return out;
}

/** Pose-to-pose on the timeline: a `par` (or `stagger`) of rotation tweens. */
export function poseTo(
  id: string,
  pose: Pose,
  opts: { duration?: number; ease?: Ease; stagger?: number } = {},
): TimelineIR {
  const tweens = Object.entries(pose).map(([name, deg]) =>
    tween(`${id}-${name}`, { rotation: deg }, { duration: opts.duration ?? 0.5, ease: opts.ease ?? "easeInOutCubic" }),
  );
  return opts.stagger ? stagger(opts.stagger, ...tweens) : par(...tweens);
}

/**
 * 2-bone inverse kinematics. Returns `[shoulderDeg, elbowDeg]` (the +Y-down bone
 * convention) that place the chain's tip at `(dx,dy)` relative to the root joint.
 * Exact for in-reach targets; clamps gracefully (no NaN) when out of reach.
 * `flip` chooses the elbow-up vs elbow-down solution.
 *
 * Derivation: with R(θ) the canvas rotation, the tip is
 * R(θ1)·[ (0,upper) + R(θ2)·(0,lower) ]. The bracket has length D=hypot(dx,dy),
 * giving cosθ2 = (D²−u²−l²)/(2ul); then θ1 rotates that bracket onto the target.
 */
export function ikReach(upper: number, lower: number, dx: number, dy: number, flip = false): [number, number] {
  const D = Math.hypot(dx, dy);
  const cos2 = Math.max(-1, Math.min(1, (D * D - upper * upper - lower * lower) / (2 * upper * lower)));
  const theta2 = (flip ? -1 : 1) * Math.acos(cos2);
  // bracket vector v = (0,upper) + R(theta2)*(0,lower)
  const vx = -lower * Math.sin(theta2);
  const vy = upper + lower * Math.cos(theta2);
  const theta1 = Math.atan2(dy, dx) - Math.atan2(vy, vx);
  const deg = (r: number) => (r * 180) / Math.PI;
  return [deg(theta1), deg(theta2)];
}

export interface HumanoidOpts extends Omit<RigOpts, never> {}

/** A ready upright humanoid skeleton — the one-call body. Joints:
 * chest, head, armUpper/LowerL, armUpper/LowerR, legUpper/LowerL, legUpper/LowerR.
 * Rooted at the chest so every limb extends naturally along +Y. */
export function humanoid(opts: HumanoidOpts = {}): NodeIR {
  const line = opts.color ?? DEFAULT_LINE;
  const fill = opts.fill ?? DEFAULT_FILL;
  const glow = opts.glow;
  // a custom oval part with optional glow (for head / torso)
  const blob = (jid: string, a: number, b: number, cy: number): NodeIR[] => {
    const d = ovalPath(a, b, 0, cy);
    const nodes: NodeIR[] = [];
    if (glow) nodes.push(path({ id: `${jid}-glow`, d, x: 0, y: 0, fill: "none", stroke: glow, strokeWidth: GLOW_W, opacity: 0.18 }));
    nodes.push(path({ id: `${jid}-shape`, d, x: 0, y: 0, fill, stroke: line, strokeWidth: LINE_W }));
    return nodes;
  };
  const id = opts.id ?? "rig";
  const root: Bone = {
    name: "chest",
    at: [0, 0],
    shape: blob(`${id}-chest`, 44, 62, 22),
    children: [
      { name: "head", at: [0, -42], rotation: 0, shape: blob(`${id}-head`, 40, 42, -34) },
      { name: "armUpperL", at: [-42, -20], length: 60, width: 20, rotation: 10, children: [
        { name: "armLowerL", at: [0, 60], length: 56, width: 16, rotation: 8 } ] },
      { name: "armUpperR", at: [42, -20], length: 60, width: 20, rotation: -10, children: [
        { name: "armLowerR", at: [0, 60], length: 56, width: 16, rotation: -8 } ] },
      { name: "legUpperL", at: [-20, 76], length: 76, width: 26, rotation: 3, children: [
        { name: "legLowerL", at: [0, 76], length: 72, width: 22, rotation: -2 } ] },
      { name: "legUpperR", at: [20, 76], length: 76, width: 26, rotation: -3, children: [
        { name: "legLowerR", at: [0, 76], length: 72, width: 22, rotation: 2 } ] },
    ],
  };
  return rig(root, opts);
}
