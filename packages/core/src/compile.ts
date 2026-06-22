/**
 * Compile the authored structure (states + timeline tree) into a flat list of
 * property segments with absolute times and baked `from` values.
 *
 * The tree is the canonical IR; segments are a derived runtime artifact.
 * Baking `from` at compile time is what makes `to("state")` synthesize
 * "current value -> target" transitions deterministically (Gemini-style
 * start/end synthesis): everything is data, so "current value" is computable
 * without running anything.
 */

import type { NodeIR, PropValue, SceneIR, TimelineIR, Ease } from "./ir.js";
import {
  DEFAULT_MOTIONPATH_DURATION,
  DEFAULT_STILL_DURATION,
  DEFAULT_TO_DURATION,
  DEFAULT_TWEEN_DURATION,
} from "./ir.js";
import { pathPoint, pathTangentAngle } from "./path.js";
import { brand, theme, getDeepPath, type Theme } from "./theme.js";

export interface PropertySegment {
  target: string;
  prop: string;
  t0: number;
  t1: number;
  from: PropValue;
  to: PropValue;
  ease?: Ease;
}

/** A path driver overrides a node's x/y (and rotation, if autoRotate) over [t0, t1], holding the end. */
export interface MotionDriver {
  t0: number;
  t1: number;
  ease?: Ease;
  points: [number, number][];
  closed: boolean;
  curviness: number;
  autoRotate: boolean;
  rotateOffset: number;
}

export interface LabelSpan {
  t0: number;
  t1: number;
}

export interface CompiledScene {
  ir: SceneIR;
  duration: number;
  /** Keyed by `${target}.${prop}`, sorted by t0. */
  segments: Map<string, PropertySegment[]>;
  /** Path drivers per target node, sorted by t0 — override x/y/rotation. */
  motionPaths: Map<string, MotionDriver[]>;
  /** Base props merged with the initial state, keyed by `${target}.${prop}`. */
  initialValues: Map<string, PropValue>;
  nodeById: Map<string, NodeIR>;
  /** Declaration order — defines stagger order. */
  nodeOrder: string[];
  /** Absolute [start, end] of every labeled timeline step (beat names included). */
  labelTimes: Map<string, LabelSpan>;
  /** The subset of label spans that come from beat nodes — keyed by beat name. */
  beatTimes: Map<string, LabelSpan>;
  /** True iff the scene declares or animates a `camera` (gates the camera matrix). */
  hasCamera: boolean;
  /** True iff the scene sets/animates `camera.perspective` (gates depth projection). */
  hasPerspective: boolean;
  /** True iff `camera.zSort` is on (gates depth-ordered paint; needs perspective). */
  zSort: boolean;
  /** True iff the scene sets `design` or any color prop resolves a `token()` ref. */
  hasDesign: boolean;
}

const key = (target: string, prop: string) => `${target}.${prop}`;

/** Props on which a `$token` ref resolves to a design-token value (color props only). */
const COLOR_PROPS = new Set(["fill", "stroke", "shadowColor"]);

/** Deep time-stretch: multiply every duration/interval/offset by k. Used to
 * realise a beat's `scale`/`duration` without threading scale through the walk. */
function scaleTimeline(tl: TimelineIR, k: number): TimelineIR {
  switch (tl.kind) {
    case "seq":
    case "par":
      return { ...tl, children: tl.children.map((c) => scaleTimeline(c, k)) };
    case "stagger":
      return { ...tl, interval: tl.interval * k, children: tl.children.map((c) => scaleTimeline(c, k)) };
    case "wait":
      return { ...tl, duration: tl.duration * k };
    case "tween":
      return { ...tl, duration: (tl.duration ?? DEFAULT_TWEEN_DURATION) * k };
    case "motionPath":
      return { ...tl, duration: (tl.duration ?? DEFAULT_MOTIONPATH_DURATION) * k };
    case "to":
      return {
        ...tl,
        duration: (tl.duration ?? DEFAULT_TO_DURATION) * k,
        ...(tl.stagger !== undefined && { stagger: tl.stagger * k }),
      };
    case "beat":
      return {
        ...tl,
        children: tl.children.map((c) => scaleTimeline(c, k)),
        ...(tl.gap !== undefined && { gap: tl.gap * k }),
      };
  }
}

/** Stable reorder of a seq's beat children by their `order` (default = index). */
function orderBeats(children: TimelineIR[]): TimelineIR[] {
  return children
    .map((c, i) => ({ c, i, key: c.kind === "beat" && c.order !== undefined ? c.order : i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.c);
}

export function compileScene(ir: SceneIR): CompiledScene {
  const nodeById = new Map<string, NodeIR>();
  const nodeOrder: string[] = [];
  const collect = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      nodeById.set(node.id, node);
      nodeOrder.push(node.id);
      if (node.type === "group") collect(node.children);
    }
  };
  collect(ir.nodes);

  // Design tokens: a `token("color.accent")` ref is the string "$color.accent" on a
  // color prop. Resolve it against the scene's `design` (merged onto the house brand)
  // at compile time, so evaluate/interpolate only ever see resolved hex. Scoped to
  // color props so a text `content: "$5M"` is never touched. A no-op (byte-identical)
  // when no token refs exist; `usedDesign` records whether any actually resolved.
  const effectiveTheme: Theme = ir.design ? theme(ir.design) : brand;
  let usedDesign = false;
  const resolveToken = (value: PropValue, prop: string): PropValue => {
    if (typeof value !== "string" || !value.startsWith("$") || !COLOR_PROPS.has(prop)) return value;
    const resolved = getDeepPath(effectiveTheme, value.slice(1));
    if (typeof resolved === "string") {
      usedDesign = true;
      return resolved;
    }
    return value; // unknown token: render the literal, never crash
  };

  const initialValues = new Map<string, PropValue>();
  for (const [id, node] of nodeById) {
    for (const [prop, value] of Object.entries(node.props)) {
      if (typeof value === "number" || typeof value === "string") {
        initialValues.set(key(id, prop), resolveToken(value, prop));
      }
    }
  }
  if (ir.initial !== undefined) {
    const override = ir.states?.[ir.initial] ?? {};
    for (const [id, props] of Object.entries(override)) {
      for (const [prop, value] of Object.entries(props)) {
        initialValues.set(key(id, prop), resolveToken(value, prop));
      }
    }
  }
  // Reserved "camera" pseudo-target: seed base look-at/zoom/rotation so a
  // tween("camera",…) can chain from a known value (currentValue() has no default
  // for zoom/x/y) and so evaluate samples a defined base. Skipped when a node
  // squats the id "camera" (that node wins, for back-compat) — so its own base
  // values are untouched and existing scenes stay byte-identical.
  const cameraIsNode = nodeById.has("camera");
  if (!cameraIsNode) {
    const cam = ir.camera ?? {};
    initialValues.set(key("camera", "x"), cam.x ?? ir.size.width / 2);
    initialValues.set(key("camera", "y"), cam.y ?? ir.size.height / 2);
    initialValues.set(key("camera", "zoom"), cam.zoom ?? 1);
    initialValues.set(key("camera", "rotation"), cam.rotation ?? 0);
    // Only seed perspective when declared — there's no sensible default focal
    // distance, and seeding it would not change evaluate (it reads it only when
    // hasPerspective). A dolly (tween camera.perspective) chains from this base.
    if (cam.perspective !== undefined) initialValues.set(key("camera", "perspective"), cam.perspective);
    // Depth of field bases (read only when hasPerspective). Seed so a static
    // focus/aperture resolves and a rack focus / iris pull chains from it.
    if (cam.focus !== undefined) initialValues.set(key("camera", "focus"), cam.focus);
    if (cam.aperture !== undefined) initialValues.set(key("camera", "aperture"), cam.aperture);
  }

  const segments = new Map<string, PropertySegment[]>();
  const motionPaths = new Map<string, MotionDriver[]>();
  const current = new Map(initialValues);

  const pushSegment = (seg: PropertySegment) => {
    seg.from = resolveToken(seg.from, seg.prop);
    seg.to = resolveToken(seg.to, seg.prop);
    const k = key(seg.target, seg.prop);
    let list = segments.get(k);
    if (!list) segments.set(k, (list = []));
    list.push(seg);
    current.set(k, seg.to);
  };

  const currentValue = (target: string, prop: string): PropValue => {
    const v = current.get(key(target, prop));
    if (v !== undefined) return v;
    // Animatable prop that has a numeric default and was never set explicitly.
    if (prop === "opacity" || prop === "scale" || prop === "progress" || prop === "scaleX" || prop === "scaleY") return 1;
    if (prop === "rotation" || prop === "skewX" || prop === "skewY") return 0;
    throw new Error(`cannot animate "${prop}" of "${target}": no base value to start from`);
  };

  const labelTimes = new Map<string, LabelSpan>();
  const beatTimes = new Map<string, LabelSpan>();

  /** Side-effect-free duration of a subtree (mirrors walkInner timing). */
  const durationOf = (tl: TimelineIR, start: number): number => {
    switch (tl.kind) {
      case "seq": {
        let t = start;
        for (const child of orderBeats(tl.children)) t = durationOf(child, t);
        return t;
      }
      case "par": {
        let end = start;
        for (const child of tl.children) end = Math.max(end, durationOf(child, start));
        return end;
      }
      case "stagger": {
        let end = start;
        tl.children.forEach((child, i) => {
          end = Math.max(end, durationOf(child, start + i * tl.interval));
        });
        return end;
      }
      case "wait":
        return start + tl.duration;
      case "tween":
        return start + (tl.duration ?? DEFAULT_TWEEN_DURATION);
      case "motionPath":
        return start + (tl.duration ?? DEFAULT_MOTIONPATH_DURATION);
      case "to": {
        const override = ir.states?.[tl.state] ?? {};
        const duration = tl.duration ?? DEFAULT_TO_DURATION;
        const si = tl.stagger ?? 0;
        const targets = nodeOrder.filter(
          (id) => id in override && (tl.filter === undefined || tl.filter.includes(id)),
        );
        return start + duration + Math.max(0, targets.length - 1) * si;
      }
      case "beat": {
        const grouping: TimelineIR = { kind: tl.parallel ? "par" : "seq", children: tl.children };
        const natural = durationOf(grouping, 0);
        const k = tl.scale ?? (tl.duration !== undefined ? tl.duration / Math.max(1e-9, natural) : 1);
        // a string `at` (label anchor) is resolved in the real walk; here it's
        // treated as sequential (its real placement drives `inferredEnd` instead).
        const at = typeof tl.at === "number" ? tl.at : undefined;
        const beatStart = at ?? start + (tl.gap ?? 0);
        return beatStart + k * natural;
      }
    }
  };

  // Pre-pass: provisional times for every label + beat, so a `beat({ at: "<label>" })`
  // anchor can resolve to a target defined anywhere (mirrors the real walk's timing;
  // string-`at` beats are placed sequentially here). Built ONLY when some beat carries
  // a string `at` → numeric/absent scenes skip it and stay byte-identical.
  let labelClock: Map<string, LabelSpan> | undefined;
  const anyAnchor = (tl: TimelineIR): boolean =>
    (tl.kind === "beat" && typeof tl.at === "string") || ("children" in tl && tl.children.some(anyAnchor));
  if (ir.timeline && anyAnchor(ir.timeline)) {
    const clock = new Map<string, LabelSpan>();
    const clockWalk = (tl: TimelineIR, start: number): number => {
      let end = start;
      switch (tl.kind) {
        case "seq": { let t = start; for (const c of orderBeats(tl.children)) t = clockWalk(c, t); end = t; break; }
        case "par": { for (const c of tl.children) end = Math.max(end, clockWalk(c, start)); break; }
        case "stagger": { tl.children.forEach((c, i) => { end = Math.max(end, clockWalk(c, start + i * tl.interval)); }); break; }
        case "wait": end = start + tl.duration; break;
        case "tween": end = start + (tl.duration ?? DEFAULT_TWEEN_DURATION); break;
        case "motionPath": end = start + (tl.duration ?? DEFAULT_MOTIONPATH_DURATION); break;
        case "to": {
          const override = ir.states?.[tl.state] ?? {};
          const si = tl.stagger ?? 0;
          const targets = nodeOrder.filter((id) => id in override && (tl.filter === undefined || tl.filter.includes(id)));
          end = start + (tl.duration ?? DEFAULT_TO_DURATION) + Math.max(0, targets.length - 1) * si;
          break;
        }
        case "beat": {
          const grouping: TimelineIR = { kind: tl.parallel ? "par" : "seq", children: tl.children };
          const k = tl.scale ?? (tl.duration !== undefined ? tl.duration / Math.max(1e-9, durationOf(grouping, 0)) : 1);
          const inner = k === 1 ? grouping : scaleTimeline(grouping, k);
          const at = typeof tl.at === "number" ? tl.at : undefined; // provisional: string → sequential
          const beatStart = at ?? start + (tl.gap ?? 0);
          end = clockWalk(inner, beatStart);
          clock.set(tl.name, { t0: beatStart, t1: end });
          break;
        }
      }
      if ("label" in tl && tl.label !== undefined) clock.set(tl.label, { t0: start, t1: end });
      return end;
    };
    clockWalk(ir.timeline, 0);
    labelClock = clock;
  }

  /** Walks a timeline node starting at `start`, returns its end time. */
  const walk = (tl: TimelineIR, start: number): number => {
    const end = walkInner(tl, start);
    if ("label" in tl && tl.label !== undefined) labelTimes.set(tl.label, { t0: start, t1: end });
    return end;
  };

  const walkInner = (tl: TimelineIR, start: number): number => {
    switch (tl.kind) {
      case "seq": {
        let t = start;
        for (const child of orderBeats(tl.children)) t = walk(child, t);
        return t;
      }
      case "beat": {
        // lower to the grouping, time-stretch the interior, place rigidly
        const grouping: TimelineIR = { kind: tl.parallel ? "par" : "seq", children: tl.children };
        const k = tl.scale ?? (tl.duration !== undefined ? tl.duration / Math.max(1e-9, durationOf(grouping, 0)) : 1);
        const inner = k === 1 ? grouping : scaleTimeline(grouping, k);
        // string `at` anchors to a label's start (+ `gap` offset); number is absolute;
        // absent is sequential. Unknown label (shouldn't pass validation) → sequential.
        const anchored = typeof tl.at === "string" ? labelClock?.get(tl.at)?.t0 : tl.at;
        const beatStart = anchored !== undefined
          ? anchored + (typeof tl.at === "string" ? (tl.gap ?? 0) : 0)
          : start + (tl.gap ?? 0);
        const end = walk(inner, beatStart);
        beatTimes.set(tl.name, { t0: beatStart, t1: end });
        labelTimes.set(tl.name, { t0: beatStart, t1: end });
        return end;
      }
      case "par": {
        let end = start;
        for (const child of tl.children) end = Math.max(end, walk(child, start));
        return end;
      }
      case "stagger": {
        let end = start;
        tl.children.forEach((child, i) => {
          end = Math.max(end, walk(child, start + i * tl.interval));
        });
        return end;
      }
      case "wait":
        return start + tl.duration;
      case "tween": {
        const duration = tl.duration ?? DEFAULT_TWEEN_DURATION;
        for (const [prop, toValue] of Object.entries(tl.props)) {
          pushSegment({
            target: tl.target,
            prop,
            t0: start,
            t1: start + duration,
            from: currentValue(tl.target, prop),
            to: toValue,
            ...(tl.ease !== undefined && { ease: tl.ease }),
          });
        }
        return start + duration;
      }
      case "motionPath": {
        const duration = tl.duration ?? DEFAULT_MOTIONPATH_DURATION;
        const points = tl.points;
        const closed = tl.closed ?? false;
        const curviness = tl.curviness ?? 1;
        const autoRotate = tl.autoRotate ?? false;
        const rotateOffset = tl.rotateOffset ?? 0;
        let list = motionPaths.get(tl.target);
        if (!list) motionPaths.set(tl.target, (list = []));
        list.push({ t0: start, t1: start + duration, points, closed, curviness, autoRotate, rotateOffset, ...(tl.ease !== undefined && { ease: tl.ease }) });
        // bake the end position into `current` so a later tween chains from it
        if (points.length > 0) {
          const [ex, ey] = pathPoint(points, closed, 1, curviness);
          current.set(key(tl.target, "x"), ex);
          current.set(key(tl.target, "y"), ey);
          if (autoRotate) current.set(key(tl.target, "rotation"), pathTangentAngle(points, closed, 1, curviness) + rotateOffset);
        }
        return start + duration;
      }
      case "to": {
        const override = ir.states?.[tl.state] ?? {};
        const duration = tl.duration ?? DEFAULT_TO_DURATION;
        const staggerInterval = tl.stagger ?? 0;
        const targets = nodeOrder.filter(
          (id) => id in override && (tl.filter === undefined || tl.filter.includes(id)),
        );
        targets.forEach((id, i) => {
          const t0 = start + i * staggerInterval;
          for (const [prop, toValue] of Object.entries(override[id]!)) {
            pushSegment({
              target: id,
              prop,
              t0,
              t1: t0 + duration,
              from: currentValue(id, prop),
              to: toValue,
              ...(tl.ease !== undefined && { ease: tl.ease }),
            });
          }
        });
        const last = Math.max(0, targets.length - 1);
        return start + duration + last * staggerInterval;
      }
    }
  };

  // A static scene (no timeline, or a timeline that produces no spans) still needs
  // a positive duration to render a frame — fall back to DEFAULT_STILL_DURATION
  // rather than 0/undefined. Existing animated scenes always infer > 0, so this is
  // golden-safe (the fallback only fires when nothing animates).
  const inferredEnd = (ir.timeline ? walk(ir.timeline, 0) : 0) || 0;
  for (const list of segments.values()) list.sort((a, b) => a.t0 - b.t0);
  for (const list of motionPaths.values()) list.sort((a, b) => a.t0 - b.t0);

  // A camera is "active" iff the scene declares or animates one AND no node squats
  // the id "camera" (legacy hand-rolled "camera" groups keep their node semantics).
  // Only then does evaluate apply the camera matrix — keeps no-camera scenes
  // byte-identical.
  const hasCamera =
    !cameraIsNode &&
    (ir.camera !== undefined ||
      motionPaths.has("camera") ||
      [...segments.keys()].some((k) => k.startsWith("camera.")));

  // Perspective projection is "active" iff the scene declares or animates
  // camera.perspective (and no node squats "camera"). Gates the depth-projection
  // path in evaluate — scenes without it stay byte-identical.
  const hasPerspective =
    !cameraIsNode &&
    (ir.camera?.perspective !== undefined || segments.has("camera.perspective"));

  // Depth-ordered paint. Only meaningful with perspective (depth lives in the
  // projection path); off ⇒ paint stays array order ⇒ byte-identical.
  const zSort = !cameraIsNode && ir.camera?.zSort === true && hasPerspective;

  return {
    ir,
    duration: ir.duration ?? (inferredEnd > 0 ? inferredEnd : DEFAULT_STILL_DURATION),
    segments,
    motionPaths,
    initialValues,
    nodeById,
    nodeOrder,
    labelTimes,
    beatTimes,
    hasCamera,
    hasPerspective,
    zSort,
    hasDesign: ir.design !== undefined || usedDesign,
  };
}
