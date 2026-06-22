/**
 * evaluate(compiled, t) -> DisplayList. The pure function at the heart of the
 * determinism contract: same compiled scene + same t = same display list,
 * always. Renderers only draw; they never compute animation.
 */

import { sampleBehavior } from "./behaviors.js";
import { cameraMatrix } from "./camera.js";
import type { CompiledScene, MotionDriver, PropertySegment } from "./compile.js";
import { isGradient } from "./gradient.js";
import type { Anchor, BackdropIR, BlendMode, ClipShape, ImageFit, MatteMode, NodeIR, Paint, PropValue } from "./ir.js";
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
  /** Live backdrop ("liquid glass") — sample + blur what's behind the shape. Emitted
   *  only for rect/ellipse that authored it; absent ⇒ no field ⇒ byte-identical. */
  backdrop?: BackdropIR;
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
    })
  // Track-matte boundary markers (emitted only for `matte` groups; the renderer brackets
  // the matte child + content children into offscreen buffers and composites them).
  | (OpBase & { type: "matte-push"; mode: MatteMode })
  | (OpBase & { type: "matte-sep" })
  | (OpBase & { type: "matte-pop" })
  // Group composite-effect boundary markers (emitted only for a group with blur / shadow /
  // blend on the group itself; the renderer renders the subtree to an offscreen buffer and
  // draws it back with the effect applied to the whole group — see OpBase blur/shadow/blend).
  | (OpBase & { type: "group-fx-push" })
  | (OpBase & { type: "group-fx-pop" });

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

const DEG = Math.PI / 180;
/** Collapse -0 → +0 so a projected matrix is byte-stable in the golden JSON round-trip. */
const z0 = (x: number): number => (x === 0 ? 0 : x);

/**
 * Perspective projection of a world matrix at accumulated depth `z` about the
 * vanishing point `(vx,vy)`, focal distance `d`. Factor `p = d/(d+z)` scales the
 * whole drawn shape about the VP — parallax, vanishing-point convergence, dolly,
 * all EXACT in 2D affine. `z=0 ⇒ p=1 ⇒` exact passthrough (no -0). A node behind
 * the camera (`d+z<=0`) collapses to the VP (`p≈0`, invisible) instead of mirroring.
 */
function projectDepth(m: Mat2D, z: number, vx: number, vy: number, d: number): Mat2D {
  if (z === 0) return m;
  const p = d + z > 0 ? d / (d + z) : 1e-6;
  return [
    z0(m[0] * p), z0(m[1] * p), z0(m[2] * p), z0(m[3] * p),
    z0(vx + (m[4] - vx) * p), z0(vy + (m[5] - vy) * p),
  ];
}

/**
 * Keystone shear for a `rotateX`/`rotateY` card-flip — the AFFINE APPROXIMATION
 * of perspective on a single quad (a true rotated quad is a non-affine trapezoid
 * Canvas 2D can't draw). cos-foreshortening is folded into scaleX/scaleY by the
 * caller; this adds the depth shear so the near edge grows: shear ∝ sin(angle)·
 * half-extent/d. Zero extent (text/path) ⇒ no shear, just the cos foreshorten.
 */
function tiltSkew(m: Mat2D, rotXdeg: number, rotYdeg: number, hw: number, hh: number, d: number): Mat2D {
  const ky = (Math.sin(rotYdeg * DEG) * hw) / d; // rotateY leans the vertical edges
  const kx = (Math.sin(rotXdeg * DEG) * hh) / d; // rotateX leans the horizontal edges
  if (ky === 0 && kx === 0) return m;
  return multiply(m, [1, kx, ky, 1, 0, 0]);
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

  // Perspective projection (gated by hasPerspective so non-perspective scenes take
  // the exact current path and stay byte-identical). Projection runs in POST-camera
  // screen space, where the vanishing point is always the frame centre — the camera
  // already maps its look-at there, so depth converges to the optical centre. `d` =
  // focal distance (smaller ⇒ stronger perspective).
  const persp = compiled.hasPerspective;
  const dPersp = persp ? num("camera", "perspective", 0) : 0;
  const vx = persp ? compiled.ir.size.width / 2 : 0;
  const vy = persp ? compiled.ir.size.height / 2 : 0;
  // Depth of field (only meaningful with perspective, since depth lives in the
  // projection path). `aperture` 0 ⇒ off ⇒ leaf ops keep their exact authored fx ⇒
  // byte-identical. A drawn op at depth `d` gains aperture·|d−focus| blur on top of
  // any authored blur; the focal plane stays sharp, near/far layers soften.
  const aperture = persp ? num("camera", "aperture", 0) : 0;
  const focus = persp ? num("camera", "focus", 0) : 0;
  const dofFx = (fx: Fx, depth: number, project: boolean): Fx => {
    if (!project || aperture <= 0) return fx;
    const extra = aperture * Math.abs(depth - focus);
    if (extra <= 0) return fx;
    return { ...fx, blur: z0((fx.blur ?? 0) + extra) };
  };

  // Depth-ordered paint: siblings drawn far→near (larger world z first) so nearer
  // nodes occlude farther ones. Off ⇒ array order ⇒ byte-identical. Array.sort is
  // stable, so equal-depth siblings keep their authored order.
  const zSort = compiled.zSort;
  const depthOf = (node: NodeIR, zAcc: number): number =>
    zAcc + num(node.id, "z", (node.props as { z?: number }).z ?? 0);
  const depthOrder = (children: NodeIR[], zAcc: number): NodeIR[] =>
    [...children].sort((a, b) => depthOf(b, zAcc) - depthOf(a, zAcc));

  // `zAcc` = accumulated parent depth; `project` = this subtree gets perspective
  // (false under a fixed HUD — perspective is part of the camera).
  const walk = (node: NodeIR, parent: Mat2D, parentOpacity: number, clips: ClipRegion[], zAcc: number, project: boolean) => {
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
        // a line carries no z/rotate of its own — it just inherits the subtree's depth
        transform: project ? projectDepth(parent, zAcc, vx, vy, dPersp) : parent,
        opacity,
        x1,
        y1,
        x2: x1 + (num(id, "x2", node.props.x2) - x1) * progress,
        y2: y1 + (num(id, "y2", node.props.y2) - y1) * progress,
        stroke: str(id, "stroke", node.props.stroke),
        strokeWidth: num(id, "strokeWidth", node.props.strokeWidth ?? 1),
        // a line carries no z of its own — DOF uses the inherited subtree depth
        ...dofFx(fx, zAcc, project),
        ...clipSpread,
      });
      return;
    }

    const opacity = parentOpacity * num(id, "opacity", node.props.opacity ?? 1);
    if (opacity <= 0) return;
    // depth + 3D tilt — only when this subtree is perspective-projected. cos-foreshortening
    // folds into scaleX/scaleY (so a tilted GROUP foreshortens its whole subtree); the keystone
    // shear + vanishing-point convergence are applied per drawn op below. When `project` is
    // false this is the exact prior computation ⇒ byte-identical.
    let effScaleX = num(id, "scaleX", node.props.scaleX ?? 1);
    let effScaleY = num(id, "scaleY", node.props.scaleY ?? 1);
    let depth = zAcc;
    let rotX = 0;
    let rotY = 0;
    if (project) {
      rotX = num(id, "rotateX", node.props.rotateX ?? 0);
      rotY = num(id, "rotateY", node.props.rotateY ?? 0);
      depth = zAcc + num(id, "z", node.props.z ?? 0);
      if (rotY !== 0) effScaleX *= Math.abs(Math.cos(rotY * DEG));
      if (rotX !== 0) effScaleY *= Math.abs(Math.cos(rotX * DEG));
    }
    const matrix = multiply(
      parent,
      localMatrix(
        num(id, "x", node.props.x),
        num(id, "y", node.props.y),
        num(id, "rotation", node.props.rotation ?? 0),
        num(id, "scale", node.props.scale ?? 1),
        effScaleX,
        effScaleY,
        num(id, "skewX", node.props.skewX ?? 0),
        num(id, "skewY", node.props.skewY ?? 0),
      ),
    );
    // A drawn op's final transform: keystone shear (per-op half-extent) + VP projection.
    // Identity when `project` is false. Groups pass the un-projected `matrix` to children.
    const projDraw = (m: Mat2D, hw: number, hh: number): Mat2D => {
      if (!project) return m;
      const tilted = rotX !== 0 || rotY !== 0 ? tiltSkew(m, rotX, rotY, hw, hh, dPersp) : m;
      return projectDepth(tilted, depth, vx, vy, dPersp);
    };
    // leaf draw ops fold depth-of-field blur into their fx (group composites don't —
    // their children already soften individually at their own depths). aperture 0 ⇒
    // leafFx === fx ⇒ byte-identical.
    const leafFx = dofFx(fx, depth, project);

    switch (node.type) {
      case "group": {
        // a clip on this group masks its children, in the group's own space — projected
        // by this group's depth so clip + perspective combine (parallax-window case).
        const clipTf = projDraw(matrix, 0, 0);
        const childClips = node.props.clip ? [...clips, { transform: clipTf, shape: node.props.clip }] : clips;
        // group-level composite effects (blur / shadow / blend on the GROUP) wrap the whole
        // subtree: render it offscreen, then draw it back once with the effect applied. Absent
        // ⇒ no markers ⇒ byte-identical. Wraps the matte sequence too (fx of a masked group).
        const hasFx = fx.blur !== undefined || fx.shadowColor !== undefined || fx.blend !== undefined;
        if (hasFx) ops.push({ type: "group-fx-push", id, transform: matrix, opacity, ...fx, ...clipSpread });
        // track matte: first child masks the rest (offscreen-composited by the renderer)
        if (node.props.matte && node.children.length >= 2) {
          ops.push({ type: "matte-push", id, transform: matrix, opacity, mode: node.props.matte, ...clipSpread });
          walk(node.children[0]!, matrix, opacity, childClips, depth, project);
          ops.push({ type: "matte-sep", id, transform: matrix, opacity });
          for (let i = 1; i < node.children.length; i++) walk(node.children[i]!, matrix, opacity, childClips, depth, project);
          ops.push({ type: "matte-pop", id, transform: matrix, opacity });
        } else {
          // depth-ordered paint (far→near) when zSort is on and this subtree projects;
          // a matte group is exempt above (its first child is the mask). Stable sort.
          const kids = zSort && project ? depthOrder(node.children, depth) : node.children;
          for (const child of kids) walk(child, matrix, opacity, childClips, depth, project);
        }
        if (hasFx) ops.push({ type: "group-fx-pop", id, transform: matrix, opacity });
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
          transform: projDraw(matrix, width / 2, height / 2),
          opacity,
          width,
          height,
          offsetX: -width * ax,
          offsetY: -height * ay,
          ...(fill !== undefined && { fill }),
          ...(stroke !== undefined && { stroke, strokeWidth }),
          ...(node.type === "rect" && { radius: num(id, "radius", node.props.radius ?? 0) }),
          ...(node.props.backdrop && { backdrop: node.props.backdrop }),
          ...leafFx,
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
          transform: projDraw(matrix, width / 2, height / 2),
          opacity,
          src: str(id, "src", node.props.src),
          width,
          height,
          offsetX: -width * ax,
          offsetY: -height * ay,
          ...(node.props.fit && node.props.fit !== "fill" ? { fit: node.props.fit } : {}),
          ...leafFx,
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
        // a string `start` anchors playback to a timeline label's t0 (ripples on retime)
        const startRaw = node.props.start;
        const start = typeof startRaw === "string" ? compiled.labelTimes.get(startRaw)?.t0 ?? 0 : startRaw ?? 0;
        const rate = node.props.rate ?? 1;
        const clipStart = node.props.clipStart ?? 0;
        const srcT = clipStart + Math.max(0, t - start) * rate;
        const frame = Math.max(0, Math.round(srcT * fps));
        ops.push({
          type: "video",
          id,
          transform: projDraw(matrix, width / 2, height / 2),
          opacity,
          src: str(id, "src", node.props.src),
          width,
          height,
          offsetX: -width * ax,
          offsetY: -height * ay,
          frame,
          ...(node.props.fit && node.props.fit !== "fill" ? { fit: node.props.fit } : {}),
          ...leafFx,
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
          // origin-shift in local space, then project (no per-op extent → cos + VP only)
          transform: projDraw(ox === 0 && oy === 0 ? matrix : multiply(matrix, [1, 0, 0, 1, -ox, -oy]), 0, 0),
          opacity,
          d: dStr,
          progress: Math.max(0, Math.min(1, num(id, "progress", node.props.progress ?? 1))),
          ...(fill !== undefined && { fill }),
          ...(stroke !== undefined && { stroke, strokeWidth: num(id, "strokeWidth", node.props.strokeWidth ?? 1) }),
          ...(needsBox && { bbox: pathBBox(dStr) }),
          ...leafFx,
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
        const body =
          typeof raw === "number"
            ? formatNumber(raw, decimals, node.props.contentThousands === true)
            : raw;
        ops.push({
          type: "text",
          id,
          transform: projDraw(matrix, 0, 0),
          opacity,
          // static affixes wrap the (possibly counting-up) body; absent ⇒ body unchanged
          content: (node.props.prefix ?? "") + body + (node.props.suffix ?? ""),
          fontFamily: str(id, "fontFamily", node.props.fontFamily),
          fontSize: num(id, "fontSize", node.props.fontSize),
          fontWeight: num(id, "fontWeight", node.props.fontWeight ?? 400),
          fill: str(id, "fill", node.props.fill ?? "#ffffff"),
          letterSpacing: num(id, "letterSpacing", node.props.letterSpacing ?? 0),
          align: TEXT_ALIGN[ax] ?? "left",
          baseline: TEXT_BASELINE[ay] ?? "top",
          ...leafFx,
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
  // depth-ordered paint reorders the top-level siblings too (far→near); a fixed HUD
  // is drawn last so it stays on top regardless of depth. Off ⇒ authored order.
  let roots = compiled.ir.nodes;
  if (zSort) {
    const isHud = (n: NodeIR): boolean => !!(n.props.fixed && compiled.hasCamera);
    roots = [...depthOrder(compiled.ir.nodes.filter((n) => !isHud(n)), 0), ...compiled.ir.nodes.filter(isHud)];
  }
  for (const node of roots) {
    const root = compiled.hasCamera && node.props.fixed ? IDENTITY : cameraRoot;
    // a fixed HUD opts out of perspective too (the vanishing point is part of the camera)
    const project = persp && !(node.props.fixed && compiled.hasCamera);
    walk(node, root, 1, [], 0, project);
  }
  return ops;
}
