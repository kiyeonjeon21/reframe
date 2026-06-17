/**
 * evaluate(compiled, t) -> DisplayList. The pure function at the heart of the
 * determinism contract: same compiled scene + same t = same display list,
 * always. Renderers only draw; they never compute animation.
 */

import { sampleBehavior } from "./behaviors.js";
import { cameraMatrix } from "./camera.js";
import type { CompiledScene, MotionDriver, PropertySegment } from "./compile.js";
import { isGradient } from "./gradient.js";
import type { Anchor, BlendMode, ClipShape, ImageFit, NodeIR, Paint, PropValue } from "./ir.js";
import { lerpValue, resolveEase } from "./interpolate.js";
import { pathBBox, pathPoint, pathTangentAngle } from "./path.js";

/** Canvas-style 2D affine matrix [a, b, c, d, e, f]. */
export type Mat2D = [number, number, number, number, number, number];

/** A clip from an ancestor group: its shape in the group's coordinate space,
 *  plus the matrix mapping that space to the scene. The renderer intersects it. */
export interface ClipRegion {
  transform: Mat2D;
  shape: ClipShape;
}

export type TextAlign = "left" | "center" | "right";
export type TextBaseline = "top" | "middle" | "bottom";

interface OpBase {
  /** Source node id — lets editors map ops back to the scene graph. */
  id: string;
  /** Maps local coords (origin = anchor point) to scene coords. */
  transform: Mat2D;
  /** Cumulative opacity, parent-multiplied. */
  opacity: number;
  /** Clip regions from ancestor groups (intersected by the renderer). */
  clips?: ClipRegion[];
  /** Paint effects (screen-pixel space). Present only when authored. */
  blur?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
  /** Compositing mode (discrete; present only when authored and not "normal"). */
  blend?: BlendMode;
}

export type DisplayOp =
  | (OpBase & {
      type: "rect";
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      fill?: Paint;
      stroke?: Paint;
      strokeWidth?: number;
      radius?: number;
    })
  | (OpBase & {
      type: "ellipse";
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      fill?: Paint;
      stroke?: Paint;
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
      /** Box-fit; present only when authored and not "fill". */
      fit?: ImageFit;
    })
  | (OpBase & {
      type: "video";
      /** Raw src string as authored in the IR — consumers resolve it. */
      src: string;
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      /** Source frame index at scene-time t (renderer clamps to the extracted count). */
      frame: number;
      /** Box-fit; present only when authored and not "fill". */
      fit?: ImageFit;
    })
  | (OpBase & {
      type: "path";
      /** SVG path data, drawn via Path2D. */
      d: string;
      /** 0..1 fraction of the stroke outline drawn (draw-on). */
      progress: number;
      fill?: Paint;
      stroke?: Paint;
      strokeWidth?: number;
      /** Local-space bbox [x,y,w,h] for mapping a gradient paint (set only when one is used). */
      bbox?: [number, number, number, number];
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

/**
 * The node's local affine matrix: Translate(x,y) ∘ Rotate ∘ Skew ∘ Scale, around
 * the anchor. `scaleX/scaleY` are per-axis multipliers on `scale`; `skewX/skewY`
 * are shear angles in degrees (a 2.5D "tilt" — no true perspective). The fast
 * path returns the exact uniform formula at defaults, so existing scenes stay
 * byte-identical (the determinism/golden contract).
 */
export function localMatrix(
  x: number,
  y: number,
  rotationDeg: number,
  scale: number,
  scaleX = 1,
  scaleY = 1,
  skewXDeg = 0,
  skewYDeg = 0,
): Mat2D {
  const r = (rotationDeg * Math.PI) / 180;
  if (scaleX === 1 && scaleY === 1 && skewXDeg === 0 && skewYDeg === 0) {
    const cos = Math.cos(r) * scale;
    const sin = Math.sin(r) * scale;
    return [cos, sin, -sin, cos, x, y];
  }
  const c = Math.cos(r);
  const s = Math.sin(r);
  const tx = Math.tan((skewXDeg * Math.PI) / 180);
  const ty = Math.tan((skewYDeg * Math.PI) / 180);
  const R: Mat2D = [c, s, -s, c, 0, 0];
  const K: Mat2D = [1, ty, tx, 1, 0, 0]; // x' = x + tx·y, y' = ty·x + y
  const S: Mat2D = [scale * scaleX, 0, 0, scale * scaleY, 0, 0];
  const m = multiply(R, multiply(K, S)); // R ∘ K ∘ S (scale, then skew, then rotate)
  return [m[0], m[1], m[2], m[3], x, y];
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

/** Render a numeric content value, optionally with thousands separators (deterministic, locale-free). */
function formatNumber(value: number, decimals: number, thousands: boolean): string {
  const fixed = value.toFixed(decimals);
  if (!thousands) return fixed;
  const neg = fixed.startsWith("-");
  const body = neg ? fixed.slice(1) : fixed;
  const dot = body.indexOf(".");
  const intPart = dot === -1 ? body : body.slice(0, dot);
  const frac = dot === -1 ? "" : body.slice(dot);
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + frac;
}

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

/**
 * Sample one node prop at time t — the single source of animated values shared
 * by `evaluate` (rendering) and `nodeParentMatrix` (editor hit/drag math), so
 * both agree to the last bit. Pure; the determinism contract rests on it.
 */
export function sampleProp(
  compiled: CompiledScene,
  t: number,
  target: string,
  prop: string,
  fallback: PropValue,
): PropValue {
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
        if (prop === "x") value = pathPoint(active.points, active.closed, u, active.curviness)[0];
        else if (prop === "y") value = pathPoint(active.points, active.closed, u, active.curviness)[1];
        else value = pathTangentAngle(active.points, active.closed, u, active.curviness) + active.rotateOffset;
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
}

/**
 * The accumulated transform of a node's ANCESTORS at time t — the coordinate
 * space its `x/y` live in (identity for a top-level node). The editor inverts
 * this to convert a scene-space drag delta into the node's parent space, so a
 * nested child can be dragged and the overlay still writes `nodes.<id>.x/y`.
 * Walks groups exactly as `evaluate` does (same sampler, no opacity culling so
 * an invisible-at-t node is still positionable). Returns null if id is unknown.
 */
export function nodeParentMatrix(compiled: CompiledScene, id: string, t: number): Mat2D | null {
  const num = (target: string, prop: string, fallback: number): number => {
    const v = sampleProp(compiled, t, target, prop, fallback);
    return typeof v === "number" ? v : fallback;
  };
  let result: Mat2D | null = null;
  const walk = (node: NodeIR, parent: Mat2D): boolean => {
    if (node.id === id) {
      result = parent;
      return true;
    }
    if (node.type === "group") {
      const m = multiply(
        parent,
        localMatrix(
          num(node.id, "x", node.props.x),
          num(node.id, "y", node.props.y),
          num(node.id, "rotation", node.props.rotation ?? 0),
          num(node.id, "scale", node.props.scale ?? 1),
          num(node.id, "scaleX", node.props.scaleX ?? 1),
          num(node.id, "scaleY", node.props.scaleY ?? 1),
          num(node.id, "skewX", node.props.skewX ?? 0),
          num(node.id, "skewY", node.props.skewY ?? 0),
        ),
      );
      for (const child of node.children) if (walk(child, m)) return true;
    }
    return false;
  };
  for (const node of compiled.ir.nodes) if (walk(node, IDENTITY)) break;
  return result;
}

export function evaluate(compiled: CompiledScene, t: number): DisplayList {
  const ops: DisplayList = [];

  const valueAt = (target: string, prop: string, fallback: PropValue): PropValue =>
    sampleProp(compiled, t, target, prop, fallback);

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

  // Sample blur + drop-shadow/glow into a partial spread onto the op. Only the
  // authored effects are included → absent ⇒ no op fields ⇒ byte-identical.
  type Fx = { blur?: number; shadowColor?: string; shadowBlur?: number; shadowX?: number; shadowY?: number; blend?: BlendMode };
  const effectFx = (id: string, p: { blur?: number; shadowColor?: string; shadowBlur?: number; shadowX?: number; shadowY?: number; blend?: BlendMode }): Fx => {
    const fx: Fx = {};
    if (p.blur !== undefined) fx.blur = num(id, "blur", p.blur);
    if (p.shadowColor !== undefined) {
      fx.shadowColor = str(id, "shadowColor", p.shadowColor);
      fx.shadowBlur = num(id, "shadowBlur", p.shadowBlur ?? 0);
      fx.shadowX = num(id, "shadowX", p.shadowX ?? 0);
      fx.shadowY = num(id, "shadowY", p.shadowY ?? 0);
    }
    if (p.blend !== undefined && p.blend !== "normal") fx.blend = p.blend;
    return fx;
  };

  const walk = (node: NodeIR, parent: Mat2D, parentOpacity: number, clips: ClipRegion[]) => {
    const id = node.id;
    const clipSpread = clips.length > 0 ? { clips } : undefined;
    const fx = effectFx(id, node.props as { blur?: number; shadowColor?: string; shadowBlur?: number; shadowX?: number; shadowY?: number; blend?: BlendMode });

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
        ...fx,
        ...clipSpread,
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
        num(id, "scaleX", node.props.scaleX ?? 1),
        num(id, "scaleY", node.props.scaleY ?? 1),
        num(id, "skewX", node.props.skewX ?? 0),
        num(id, "skewY", node.props.skewY ?? 0),
      ),
    );

    switch (node.type) {
      case "group": {
        // a clip on this group masks its children, in the group's own space
        const childClips = node.props.clip ? [...clips, { transform: matrix, shape: node.props.clip }] : clips;
        for (const child of node.children) walk(child, matrix, opacity, childClips);
        return;
      }
      case "rect":
      case "ellipse": {
        const width = num(id, "width", node.props.width);
        const height = num(id, "height", node.props.height);
        const [ax, ay] = ANCHOR_FACTORS[node.props.anchor ?? "top-left"];
        const strokeWidth = num(id, "strokeWidth", node.props.strokeWidth ?? 1);
        // a gradient paint passes through as-is; a color string samples (animatable) via opt()
        const fillP = node.props.fill;
        const strokeP = node.props.stroke;
        const fill = isGradient(fillP) ? fillP : opt(id, "fill", fillP);
        const stroke = isGradient(strokeP) ? strokeP : opt(id, "stroke", strokeP);
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
          ...fx,
          ...clipSpread,
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
          ...(node.props.fit && node.props.fit !== "fill" ? { fit: node.props.fit } : {}),
          ...fx,
          ...clipSpread,
        });
        return;
      }
      case "video": {
        const width = num(id, "width", node.props.width);
        const height = num(id, "height", node.props.height);
        const [ax, ay] = ANCHOR_FACTORS[node.props.anchor ?? "top-left"];
        // pure source-frame index at scene-time t (renderer clamps to extracted count)
        const fps = compiled.ir.fps ?? 30;
        const start = node.props.start ?? 0;
        const rate = node.props.rate ?? 1;
        const clipStart = node.props.clipStart ?? 0;
        const srcT = clipStart + Math.max(0, t - start) * rate;
        const frame = Math.max(0, Math.round(srcT * fps));
        ops.push({
          type: "video",
          id,
          transform: matrix,
          opacity,
          src: str(id, "src", node.props.src),
          width,
          height,
          offsetX: -width * ax,
          offsetY: -height * ay,
          frame,
          ...(node.props.fit && node.props.fit !== "fill" ? { fit: node.props.fit } : {}),
          ...fx,
          ...clipSpread,
        });
        return;
      }
      case "path": {
        // d is drawn in its own coords; shift by -origin so scale/rotation
        // (already in `matrix`) pivot around the art's centre, not (0,0).
        const ox = num(id, "originX", node.props.originX ?? 0);
        const oy = num(id, "originY", node.props.originY ?? 0);
        const fillP = node.props.fill;
        const strokeP = node.props.stroke;
        const fill = isGradient(fillP) ? fillP : opt(id, "fill", fillP);
        const stroke = isGradient(strokeP) ? strokeP : opt(id, "stroke", strokeP);
        const dStr = str(id, "d", node.props.d);
        const needsBox = isGradient(fill) || isGradient(stroke); // gradient maps to the path's bbox
        ops.push({
          type: "path",
          id,
          transform: ox === 0 && oy === 0 ? matrix : multiply(matrix, [1, 0, 0, 1, -ox, -oy]),
          opacity,
          d: dStr,
          progress: Math.max(0, Math.min(1, num(id, "progress", node.props.progress ?? 1))),
          ...(fill !== undefined && { fill }),
          ...(stroke !== undefined && { stroke, strokeWidth: num(id, "strokeWidth", node.props.strokeWidth ?? 1) }),
          ...(needsBox && { bbox: pathBBox(dStr) }),
          ...fx,
          ...clipSpread,
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
          content:
            typeof raw === "number"
              ? formatNumber(raw, decimals, node.props.contentThousands === true)
              : raw,
          fontFamily: str(id, "fontFamily", node.props.fontFamily),
          fontSize: num(id, "fontSize", node.props.fontSize),
          fontWeight: num(id, "fontWeight", node.props.fontWeight ?? 400),
          fill: str(id, "fill", node.props.fill ?? "#ffffff"),
          letterSpacing: num(id, "letterSpacing", node.props.letterSpacing ?? 0),
          align: TEXT_ALIGN[ax] ?? "left",
          baseline: TEXT_BASELINE[ay] ?? "top",
          ...fx,
          ...clipSpread,
        });
        return;
      }
    }
  };

  // The camera is one global transform at the root of the walk, so it moves the
  // whole scene; a top-level `fixed` node opts out (screen-pinned HUD/titles).
  // When the scene has no camera, the root is IDENTITY exactly as before — the
  // determinism/golden contract stays byte-identical.
  const cameraRoot = compiled.hasCamera
    ? cameraMatrix(
        {
          x: num("camera", "x", compiled.ir.size.width / 2),
          y: num("camera", "y", compiled.ir.size.height / 2),
          zoom: num("camera", "zoom", 1),
          rotation: num("camera", "rotation", 0),
        },
        compiled.ir.size,
      )
    : IDENTITY;
  for (const node of compiled.ir.nodes) {
    const root = compiled.hasCamera && node.props.fixed ? IDENTITY : cameraRoot;
    walk(node, root, 1, []);
  }
  return ops;
}
