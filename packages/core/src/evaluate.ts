/**
 * evaluate(compiled, t) -> DisplayList. The pure function at the heart of the
 * determinism contract: same compiled scene + same t = same display list,
 * always. Renderers only draw; they never compute animation.
 */

import { sampleBehavior } from "./behaviors.js";
import type { CompiledScene, MotionDriver, PropertySegment } from "./compile.js";
import type { Anchor, NodeIR, PropValue } from "./ir.js";
import { lerpValue, resolveEase } from "./interpolate.js";
import { pathPoint, pathTangentAngle } from "./path.js";

/** Canvas-style 2D affine matrix [a, b, c, d, e, f]. */
export type Mat2D = [number, number, number, number, number, number];

export type TextAlign = "left" | "center" | "right";
export type TextBaseline = "top" | "middle" | "bottom";

interface OpBase {
  /** Source node id — lets editors map ops back to the scene graph. */
  id: string;
  /** Maps local coords (origin = anchor point) to scene coords. */
  transform: Mat2D;
  /** Cumulative opacity, parent-multiplied. */
  opacity: number;
}

export type DisplayOp =
  | (OpBase & {
      type: "rect";
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      radius?: number;
    })
  | (OpBase & {
      type: "ellipse";
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    })
  | (OpBase & {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
    })
  | (OpBase & {
      type: "text";
      content: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      fill: string;
      letterSpacing: number;
      align: TextAlign;
      baseline: TextBaseline;
    })
  | (OpBase & {
      type: "image";
      /** Raw src string as authored in the IR — consumers resolve it. */
      src: string;
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
    });

export type DisplayList = DisplayOp[];

const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

function multiply(m: Mat2D, n: Mat2D): Mat2D {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function localMatrix(x: number, y: number, rotationDeg: number, scale: number): Mat2D {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r) * scale;
  const sin = Math.sin(r) * scale;
  return [cos, sin, -sin, cos, x, y];
}

const ANCHOR_FACTORS: Record<Anchor, [number, number]> = {
  "top-left": [0, 0],
  "top-center": [0.5, 0],
  "top-right": [1, 0],
  "center-left": [0, 0.5],
  center: [0.5, 0.5],
  "center-right": [1, 0.5],
  "bottom-left": [0, 1],
  "bottom-center": [0.5, 1],
  "bottom-right": [1, 1],
};

const TEXT_ALIGN: Record<number, TextAlign> = { 0: "left", 0.5: "center", 1: "right" };
const TEXT_BASELINE: Record<number, TextBaseline> = { 0: "top", 0.5: "middle", 1: "bottom" };

/** 0 outside the behavior's [from, until] window, with a linear ramp at each bound. */
function behaviorEnvelope(b: { from?: number; until?: number; ramp?: number }, t: number): number {
  const from = b.from ?? Number.NEGATIVE_INFINITY;
  const until = b.until ?? Number.POSITIVE_INFINITY;
  if (t < from || t > until) return 0;
  const ramp = b.ramp ?? 0.2;
  let envelope = 1;
  if (Number.isFinite(from) && ramp > 0) envelope = Math.min(envelope, (t - from) / ramp);
  if (Number.isFinite(until) && ramp > 0) envelope = Math.min(envelope, (until - t) / ramp);
  return Math.max(0, Math.min(1, envelope));
}

export function evaluate(compiled: CompiledScene, t: number): DisplayList {
  const ops: DisplayList = [];

  const valueAt = (target: string, prop: string, fallback: PropValue): PropValue => {
    let value = compiled.initialValues.get(`${target}.${prop}`) ?? fallback;
    let segStart = Number.NEGATIVE_INFINITY; // authored start of the active tween segment
    const segs = compiled.segments.get(`${target}.${prop}`);
    if (segs) {
      let active: PropertySegment | undefined;
      for (const seg of segs) {
        if (seg.t0 <= t) active = seg;
        else break;
      }
      if (active) {
        segStart = active.t0;
        if (t >= active.t1) {
          value = active.to;
        } else {
          const u = resolveEase(active.ease)((t - active.t0) / (active.t1 - active.t0));
          value = lerpValue(active.from, active.to, u);
        }
      }
    }
    // A motion path overrides x/y (and rotation, if autoRotate) within its
    // window, holding the end after it completes. Whichever driver was authored
    // LATER wins (compare start times), so a tween placed after the path takes
    // over in its own window while gaps still hold the path's end. Applied
    // before behaviors so a wiggle/oscillate can still ride on top.
    if (prop === "x" || prop === "y" || prop === "rotation") {
      const drivers = compiled.motionPaths.get(target);
      if (drivers) {
        let active: MotionDriver | undefined;
        for (const d of drivers) {
          if (d.t0 <= t) active = d;
          else break;
        }
        if (active && active.t0 >= segStart && (prop !== "rotation" || active.autoRotate) && active.points.length > 0) {
          const span = active.t1 - active.t0;
          const u = span <= 0 ? 1 : resolveEase(active.ease)(Math.max(0, Math.min(1, (t - active.t0) / span)));
          if (prop === "x") value = pathPoint(active.points, active.closed, u)[0];
          else if (prop === "y") value = pathPoint(active.points, active.closed, u)[1];
          else value = pathTangentAngle(active.points, active.closed, u) + active.rotateOffset;
        }
      }
    }
    for (const b of compiled.ir.behaviors ?? []) {
      if (b.target === target && b.prop === prop && typeof value === "number") {
        const envelope = behaviorEnvelope(b, t);
        if (envelope > 0) value = value + envelope * sampleBehavior(b.behavior, t);
      }
    }
    return value;
  };

  const num = (target: string, prop: string, fallback: number): number => {
    const v = valueAt(target, prop, fallback);
    return typeof v === "number" ? v : fallback;
  };
  const str = (target: string, prop: string, fallback: string): string => {
    const v = valueAt(target, prop, fallback);
    return typeof v === "string" ? v : String(v);
  };
  const opt = (target: string, prop: string, base: string | undefined): string | undefined => {
    const v = valueAt(target, prop, base ?? "");
    return v === "" && base === undefined ? undefined : String(v);
  };

  const walk = (node: NodeIR, parent: Mat2D, parentOpacity: number) => {
    const id = node.id;

    if (node.type === "line") {
      const opacity = parentOpacity * num(id, "opacity", node.props.opacity ?? 1);
      if (opacity <= 0) return;
      const progress = Math.max(0, Math.min(1, num(id, "progress", node.props.progress ?? 1)));
      const x1 = num(id, "x1", node.props.x1);
      const y1 = num(id, "y1", node.props.y1);
      ops.push({
        type: "line",
        id,
        transform: parent,
        opacity,
        x1,
        y1,
        x2: x1 + (num(id, "x2", node.props.x2) - x1) * progress,
        y2: y1 + (num(id, "y2", node.props.y2) - y1) * progress,
        stroke: str(id, "stroke", node.props.stroke),
        strokeWidth: num(id, "strokeWidth", node.props.strokeWidth ?? 1),
      });
      return;
    }

    const opacity = parentOpacity * num(id, "opacity", node.props.opacity ?? 1);
    if (opacity <= 0) return;
    const matrix = multiply(
      parent,
      localMatrix(
        num(id, "x", node.props.x),
        num(id, "y", node.props.y),
        num(id, "rotation", node.props.rotation ?? 0),
        num(id, "scale", node.props.scale ?? 1),
      ),
    );

    switch (node.type) {
      case "group":
        for (const child of node.children) walk(child, matrix, opacity);
        return;
      case "rect":
      case "ellipse": {
        const width = num(id, "width", node.props.width);
        const height = num(id, "height", node.props.height);
        const [ax, ay] = ANCHOR_FACTORS[node.props.anchor ?? "top-left"];
        const strokeWidth = num(id, "strokeWidth", node.props.strokeWidth ?? 1);
        const fill = opt(id, "fill", node.props.fill);
        const stroke = opt(id, "stroke", node.props.stroke);
        ops.push({
          type: node.type,
          id,
          transform: matrix,
          opacity,
          width,
          height,
          offsetX: -width * ax,
          offsetY: -height * ay,
          ...(fill !== undefined && { fill }),
          ...(stroke !== undefined && { stroke, strokeWidth }),
          ...(node.type === "rect" && { radius: num(id, "radius", node.props.radius ?? 0) }),
        });
        return;
      }
      case "image": {
        const width = num(id, "width", node.props.width);
        const height = num(id, "height", node.props.height);
        const [ax, ay] = ANCHOR_FACTORS[node.props.anchor ?? "top-left"];
        ops.push({
          type: "image",
          id,
          transform: matrix,
          opacity,
          src: str(id, "src", node.props.src),
          width,
          height,
          offsetX: -width * ax,
          offsetY: -height * ay,
        });
        return;
      }
      case "text": {
        const [ax, ay] = ANCHOR_FACTORS[node.props.anchor ?? "top-left"];
        const raw = valueAt(id, "content", node.props.content);
        const decimals = Math.max(
          0,
          Math.round(num(id, "contentDecimals", node.props.contentDecimals ?? 0)),
        );
        ops.push({
          type: "text",
          id,
          transform: matrix,
          opacity,
          content: typeof raw === "number" ? raw.toFixed(decimals) : raw,
          fontFamily: str(id, "fontFamily", node.props.fontFamily),
          fontSize: num(id, "fontSize", node.props.fontSize),
          fontWeight: num(id, "fontWeight", node.props.fontWeight ?? 400),
          fill: str(id, "fill", node.props.fill ?? "#ffffff"),
          letterSpacing: num(id, "letterSpacing", node.props.letterSpacing ?? 0),
          align: TEXT_ALIGN[ax] ?? "left",
          baseline: TEXT_BASELINE[ay] ?? "top",
        });
        return;
      }
    }
  };

  for (const node of compiled.ir.nodes) walk(node, IDENTITY, 1);
  return ops;
}
