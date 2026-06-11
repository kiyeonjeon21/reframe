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
import { DEFAULT_TO_DURATION, DEFAULT_TWEEN_DURATION } from "./ir.js";

export interface PropertySegment {
  target: string;
  prop: string;
  t0: number;
  t1: number;
  from: PropValue;
  to: PropValue;
  ease?: Ease;
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
  /** Base props merged with the initial state, keyed by `${target}.${prop}`. */
  initialValues: Map<string, PropValue>;
  nodeById: Map<string, NodeIR>;
  /** Declaration order — defines stagger order. */
  nodeOrder: string[];
  /** Absolute [start, end] of every labeled timeline step. */
  labelTimes: Map<string, LabelSpan>;
}

const key = (target: string, prop: string) => `${target}.${prop}`;

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

  const initialValues = new Map<string, PropValue>();
  for (const [id, node] of nodeById) {
    for (const [prop, value] of Object.entries(node.props)) {
      if (typeof value === "number" || typeof value === "string") {
        initialValues.set(key(id, prop), value);
      }
    }
  }
  if (ir.initial !== undefined) {
    const override = ir.states?.[ir.initial] ?? {};
    for (const [id, props] of Object.entries(override)) {
      for (const [prop, value] of Object.entries(props)) {
        initialValues.set(key(id, prop), value);
      }
    }
  }

  const segments = new Map<string, PropertySegment[]>();
  const current = new Map(initialValues);

  const pushSegment = (seg: PropertySegment) => {
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
    if (prop === "opacity" || prop === "scale" || prop === "progress") return 1;
    if (prop === "rotation") return 0;
    throw new Error(`cannot animate "${prop}" of "${target}": no base value to start from`);
  };

  const labelTimes = new Map<string, LabelSpan>();

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
        for (const child of tl.children) t = walk(child, t);
        return t;
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

  const inferredEnd = ir.timeline ? walk(ir.timeline, 0) : 0;
  for (const list of segments.values()) list.sort((a, b) => a.t0 - b.t0);

  return {
    ir,
    duration: ir.duration ?? inferredEnd,
    segments,
    initialValues,
    nodeById,
    nodeOrder,
    labelTimes,
  };
}
