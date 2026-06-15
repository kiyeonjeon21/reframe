/**
 * Motion ops — a small GSAP-style library of everyday motions that apply to ANY
 * node (text, logo paths, shapes), composed from the existing primitives
 * (tween / motionPath / beat). `motionOp(name, target, opts)` returns a labeled
 * beat (+ optional `setup` base-prop overrides for entrances) you can author in
 * code or ADD to a scene from the editor via the `addTimeline` overlay verb.
 *
 * Ops compute absolute targets from `opts.base` (the node's current transform),
 * so they're correct on nodes that aren't at scale 1 / origin 0.
 */
import type { EaseName, PropValue, TimelineIR } from "./ir.js";
import { beat, par, seq, tween } from "./dsl.js";

export type MotionOpName =
  | "rotate"
  | "zoom"
  | "ken-burns"
  | "slide-in"
  | "fade"
  | "draw-on"
  | "pulse";

export const MOTION_OPS: MotionOpName[] = ["rotate", "zoom", "ken-burns", "slide-in", "fade", "draw-on", "pulse"];

export interface MotionOpOpts {
  energy?: number;
  speed?: number;
  amount?: number;
  from?: "left" | "right" | "top" | "bottom";
  /** The target node's current transform — lets scale/position ops be correct
   *  on nodes that aren't at scale 1 / origin 0. */
  base?: { scale?: number; x?: number; y?: number; rotation?: number };
}

export interface MotionOpResult {
  /** Base-prop overrides the op needs (e.g. start hidden for a fade). */
  setup?: Record<string, Record<string, PropValue>>;
  /** The op's animation, a labeled beat. */
  timeline: TimelineIR;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
function settleEase(e: number): EaseName {
  return e < 0.34 ? "easeOutCubic" : e < 0.67 ? "easeOutBack" : "easeOutElastic";
}
function fromVec(from: MotionOpOpts["from"], dist: number): [number, number] {
  switch (from) {
    case "right":
      return [dist, 0];
    case "top":
      return [0, -dist];
    case "bottom":
      return [0, dist];
    default:
      return [-dist, 0];
  }
}

/** A stable beat label for an op on a node (so it's patchable + foldable). */
export const motionOpLabel = (name: MotionOpName, target: string) => `op-${name}-${target}`;

export function motionOp(name: MotionOpName, target: string, opts: MotionOpOpts = {}): MotionOpResult {
  const e = clamp01(opts.energy ?? 0.5);
  const sp = Math.max(0.25, opts.speed ?? 1);
  const amt = opts.amount ?? 1;
  const b = { scale: 1, x: 0, y: 0, rotation: 0, ...opts.base };
  const d = (base: number) => base / sp;
  const label = motionOpLabel(name, target);

  switch (name) {
    case "rotate":
      return { timeline: beat(label, {}, [tween(target, { rotation: b.rotation + 360 * amt }, { duration: d(1.0), ease: settleEase(e) })]) };

    case "zoom": {
      const peak = b.scale * (1 + 0.22 * amt);
      return {
        timeline: beat(label, {}, [
          seq(
            tween(target, { scale: peak }, { duration: d(0.4), ease: "easeOutBack" }),
            tween(target, { scale: b.scale }, { duration: d(0.45), ease: "easeInOutQuad" }),
          ),
        ]),
      };
    }

    case "ken-burns":
      return {
        timeline: beat(label, {}, [
          par(
            tween(target, { scale: b.scale * (1 + 0.1 * amt) }, { duration: d(3.0), ease: "easeInOutQuad" }),
            tween(target, { x: b.x + 26 * amt, y: b.y - 16 * amt }, { duration: d(3.0), ease: "easeInOutQuad" }),
          ),
        ]),
      };

    case "slide-in": {
      const [dx, dy] = fromVec(opts.from ?? "left", 320 * amt);
      return {
        setup: { [target]: { x: b.x + dx, y: b.y + dy, opacity: 0 } },
        timeline: beat(label, {}, [
          par(
            tween(target, { x: b.x, y: b.y }, { duration: d(0.7), ease: settleEase(e) }),
            tween(target, { opacity: 1 }, { duration: d(0.4), ease: "easeOutQuad" }),
          ),
        ]),
      };
    }

    case "fade":
      return {
        setup: { [target]: { opacity: 0 } },
        timeline: beat(label, {}, [tween(target, { opacity: 1 }, { duration: d(0.6), ease: "easeOutQuad" })]),
      };

    case "draw-on":
      return {
        setup: { [target]: { progress: 0 } },
        timeline: beat(label, {}, [tween(target, { progress: 1 }, { duration: d(1.3), ease: "easeInOutQuad" })]),
      };

    case "pulse": {
      const hi = b.scale * (1 + 0.12 * amt);
      const pulses = 2 + Math.round(amt);
      const steps: TimelineIR[] = [];
      for (let i = 0; i < pulses; i++) {
        steps.push(tween(target, { scale: hi }, { duration: d(0.22), ease: "easeOutQuad" }));
        steps.push(tween(target, { scale: b.scale }, { duration: d(0.22), ease: "easeInQuad" }));
      }
      return { timeline: beat(label, {}, [seq(...steps)]) };
    }
  }
}
