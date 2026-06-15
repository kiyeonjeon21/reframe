/**
 * MotionSketch — the intermediate representation between a video's pixel
 * motion signal and a reframe timeline. Extraction (pixels → sketch) lives in
 * the motion harness (it needs the profiler); this module owns the sketch
 * *vocabulary* and the *emission* (sketch → TimelineIR), both of which are
 * pure and dependency-free so core can host them.
 *
 * Reconstruction is deliberately geometry-free: events emit opacity/scale
 * tweens whose targets are absolute (1, or 1+magnitude), so a sketch re-applies
 * to nodes without knowing their rest positions — which is what makes the
 * round-trip verifier independent of node layout.
 */

import type { Ease, TimelineIR } from "./ir.js";
import { par, seq, tween, wait } from "./dsl.js";

export type MotionEventKind = "enter" | "exit" | "move" | "scale" | "emphasis";

/** Normalized 0..1 activity bounding box — a coarse region, NOT a tracked object. */
export interface MotionRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MotionEvent {
  /** Onset / settle, seconds. */
  t0: number;
  t1: number;
  kind: MotionEventKind;
  region: MotionRegion;
  /** Displacement or scale delta, normalized to the frame. */
  magnitude: number;
  easing: { class: string; thirdsRatio: number | null; reliable: boolean };
}

export interface MotionSketch {
  duration: number;
  fps: number;
  events: MotionEvent[];
  /** Global cadence; periodicityHz null when no clear oscillation. */
  rhythm: { periodicityHz: number | null; beatCount: number };
}

const EASE_BY_CLASS: Record<string, Ease> = {
  accelerating: "easeInCubic",
  decelerating: "easeOutCubic",
  linear: "linear",
};
function easeFor(easing: MotionEvent["easing"]): Ease {
  // unreliable/other → a neutral decelerating entrance, the common default
  return EASE_BY_CLASS[easing.class] ?? "easeOutCubic";
}

/**
 * Emit a reframe timeline reproducing a sketch's timing, applied to `nodeIds`.
 * Events are assigned to nodes in onset order (v1: region→node mapping is
 * goal-2's concern; here ids are given). Geometry-free: enter/exit drive
 * opacity, emphasis/scale drive scale, so the emitted timeline needs no node
 * coordinates. For an `enter` to read as an entrance the target node should
 * start hidden (opacity 0) — idiomatic reframe `initial` state.
 */
export function sketchToTimeline(sketch: MotionSketch, nodeIds: string[]): TimelineIR {
  if (nodeIds.length === 0) return seq();
  const events = [...sketch.events].sort((a, b) => a.t0 - b.t0);
  const steps: TimelineIR[] = [];

  events.forEach((ev, i) => {
    const node = nodeIds[i % nodeIds.length]!;
    const dur = Math.max(0.05, ev.t1 - ev.t0);
    const ease = easeFor(ev.easing);
    let motion: TimelineIR;
    switch (ev.kind) {
      case "enter":
        motion = tween(node, { opacity: 1 }, { duration: dur, ease });
        break;
      case "exit":
        motion = tween(node, { opacity: 0 }, { duration: dur, ease });
        break;
      case "emphasis": {
        const peak = 1 + Math.max(0.08, Math.min(0.5, ev.magnitude));
        motion = seq(
          tween(node, { scale: peak }, { duration: dur / 2, ease: "easeOutCubic" }),
          tween(node, { scale: 1 }, { duration: dur / 2, ease: "easeInOutQuad" }),
        );
        break;
      }
      case "scale":
        motion = tween(node, { scale: 1 + Math.max(-0.5, Math.min(0.5, ev.magnitude)) }, { duration: dur, ease });
        break;
      case "move":
        // translation is not reconstructable geometry-free in v1 — preserve the
        // timing as an opacity beat so the event still registers
        motion = tween(node, { opacity: 1 }, { duration: dur, ease });
        break;
    }
    steps.push(ev.t0 > 0 ? seq(wait(ev.t0), motion) : motion);
  });

  return par(...steps);
}
