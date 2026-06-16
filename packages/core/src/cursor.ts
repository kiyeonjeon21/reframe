/**
 * Cursor / pointer motion — a vector mouse pointer that glides across the scene
 * and clicks things (the UI-demo staple). `cursor()` returns a NodeIR (like
 * `devicePreset`); `cursorTo` / `cursorPath` / `cursorClick` return TimelineIR
 * (like `characterPreset`). The pointer's HOTSPOT is the group origin (0,0), so a
 * move lands the tip exactly on a target. Pairs with `deviceScreenPoint` to click
 * UI inside a `devicePreset` screen.
 *
 *   nodes:     [devicePreset("browser", { id: "d", x, y, scale, content }), cursor({ id: "cur" })]
 *   timeline:  seq(cursorTo("cur", [start], deviceScreenPoint("browser", dOpts, [lx, ly])),
 *                  cursorClick("cur", { press: "d-ui-cta" }))
 */

import { beat, ellipse, group, motionPath, par, path, seq, tween, wait } from "./dsl.js";
import type { Ease, NodeIR, TimelineIR } from "./ir.js";

export type CursorStyle = "arrow" | "dot" | "ring";

export interface CursorOpts {
  id?: string;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  style?: CursorStyle;
  /** Pointer body colour (default white for arrow). */
  fill?: string;
  /** Accent for dot/ring body and the click ripple. */
  accent?: string;
}

// classic OS arrow, tip at the origin (0,0), pointing down-right (~34px tall)
const ARROW_D = "M0 0 L0 30 L8 23 L12.6 33 L17 31 L12.4 21.4 L21 21.4 Z";

export function cursor(opts: CursorOpts = {}): NodeIR {
  const id = opts.id ?? "cursor";
  const style = opts.style ?? "arrow";
  const fill = opts.fill ?? "#FFFFFF";
  const accent = opts.accent ?? "#FF5A1F";
  const art: NodeIR[] =
    style === "arrow"
      ? [path({ id: `${id}-arrow`, d: ARROW_D, x: 0, y: 0, fill, stroke: "#15171E", strokeWidth: 2 })]
      : style === "dot"
        ? [ellipse({ id: `${id}-dot`, x: 0, y: 0, width: 18, height: 18, fill: accent, anchor: "center" })]
        : [ellipse({ id: `${id}-ring`, x: 0, y: 0, width: 22, height: 22, fill: "none", stroke: accent, strokeWidth: 3, anchor: "center" })];
  return group(
    { id, x: opts.x ?? 0, y: opts.y ?? 0, scale: opts.scale ?? 1, opacity: opts.opacity ?? 1 },
    [
      // ripple ring (behind the pointer), emanates from the hotspot on click
      ellipse({ id: `${id}-ripple`, x: 0, y: 0, width: 30, height: 30, fill: "none", stroke: accent, strokeWidth: 3, opacity: 0, scale: 0, anchor: "center" }),
      // the pointer art lives in its own group so a click "tap" can scale it
      // independently of the cursor's resting scale
      group({ id: `${id}-art`, x: 0, y: 0 }, art),
    ],
  );
}

// --------------------------------------------------------------------- moves
export interface CursorToOpts {
  duration?: number;
  ease?: Ease;
  /** perpendicular bow as a fraction of distance (default 0.12; 0 = straight). */
  arc?: number;
  label?: string;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Glide the cursor from `from` to `to` along a gentle human arc. */
export function cursorTo(id: string, from: [number, number], to: [number, number], opts: CursorToOpts = {}): TimelineIR {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const dist = Math.hypot(dx, dy) || 1;
  const arc = opts.arc ?? 0.12;
  // midpoint pushed perpendicular to the travel direction
  const mid: [number, number] = [(from[0] + to[0]) / 2 + (-dy / dist) * arc * dist, (from[1] + to[1]) / 2 + (dx / dist) * arc * dist];
  const duration = opts.duration ?? clamp(dist / 1400, 0.4, 0.9);
  return motionPath(id, [from, mid, to], { duration, ease: opts.ease ?? "easeInOutCubic", curviness: 1, ...(opts.label && { label: opts.label }) });
}

export interface CursorPathOpts {
  duration?: number;
  ease?: Ease;
  curviness?: number;
  label?: string;
}
/** Move the cursor through a tour of waypoints (one smooth path). */
export function cursorPath(id: string, points: [number, number][], opts: CursorPathOpts = {}): TimelineIR {
  return motionPath(id, points, {
    duration: opts.duration ?? clamp(points.length * 0.5, 0.5, 4),
    ease: opts.ease ?? "easeInOutCubic",
    curviness: opts.curviness ?? 1,
    ...(opts.label && { label: opts.label }),
  });
}

// -------------------------------------------------------------------- clicks
export interface CursorClickOpts {
  /** overall click duration scale (default 1). */
  speed?: number;
  /** node id to "press" (a quick scale dip) when the cursor clicks it. */
  press?: string;
  /** show the expanding ripple ring (default true). */
  ripple?: boolean;
  label?: string;
}

function clickBody(id: string, o: CursorClickOpts): TimelineIR[] {
  const sp = Math.max(0.25, o.speed ?? 1);
  const d = (b: number) => b / sp;
  const out: TimelineIR[] = [
    // the pointer taps
    seq(tween(`${id}-art`, { scale: 0.82 }, { duration: d(0.08), ease: "easeOutQuad" }), tween(`${id}-art`, { scale: 1 }, { duration: d(0.1), ease: "easeOutBack" })),
  ];
  if (o.ripple !== false) {
    out.push(seq(
      tween(`${id}-ripple`, { scale: 0.2, opacity: 0.55 }, { duration: 0.001 }),
      par(
        tween(`${id}-ripple`, { scale: 5 }, { duration: d(0.5), ease: "easeOutCubic" }),
        tween(`${id}-ripple`, { opacity: 0 }, { duration: d(0.5), ease: "easeOutQuad" }),
      ),
    ));
  }
  if (o.press) {
    out.push(seq(tween(o.press, { scale: 0.94 }, { duration: d(0.08), ease: "easeOutQuad" }), tween(o.press, { scale: 1 }, { duration: d(0.14), ease: "easeOutBack" })));
  }
  return out;
}

/** A click: the pointer taps, a ripple ring expands, and an optional target presses. */
export function cursorClick(id: string, opts: CursorClickOpts = {}): TimelineIR {
  return beat(opts.label ?? "cursor-click", {}, [par(...clickBody(id, opts))]);
}

/** Two quick clicks. */
export function cursorDouble(id: string, opts: CursorClickOpts = {}): TimelineIR {
  const sp = Math.max(0.25, opts.speed ?? 1);
  return beat(opts.label ?? "cursor-double", {}, [
    seq(par(...clickBody(id, { ...opts, ripple: false })), wait(0.12 / sp), par(...clickBody(id, opts))),
  ]);
}
