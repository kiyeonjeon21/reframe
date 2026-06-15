/**
 * The eDSL surface: thin factories that build plain IR objects.
 * `scene()` validates and returns the IR — the return value is the document.
 */

import type {
  AudioIR,
  BehaviorIR,
  Ease,
  EllipseProps,
  GroupProps,
  ImageProps,
  LineProps,
  NodeIR,
  PathProps,
  PropValue,
  RectProps,
  SceneIR,
  Size,
  StateOverride,
  TextProps,
  TimelineIR,
} from "./ir.js";
import { compileScene } from "./compile.js";
import { validateScene } from "./validate.js";

export interface SceneInput {
  id: string;
  size: Size;
  fps?: number;
  duration?: number;
  background?: string;
  nodes: NodeIR[];
  states?: Record<string, StateOverride>;
  initial?: string;
  timeline?: TimelineIR;
  behaviors?: BehaviorIR[];
  audio?: AudioIR;
  meta?: Record<string, unknown>;
}

export function scene(input: SceneInput): SceneIR {
  const ir: SceneIR = { version: 1, ...input };
  validateScene(ir);
  if (ir.duration === undefined && ir.timeline) {
    ir.duration = compileScene(ir).duration;
  }
  return ir;
}

export function rect(props: { id: string } & RectProps): NodeIR {
  const { id, ...rest } = props;
  return { type: "rect", id, props: rest };
}

export function ellipse(props: { id: string } & EllipseProps): NodeIR {
  const { id, ...rest } = props;
  return { type: "ellipse", id, props: rest };
}

export function line(props: { id: string } & LineProps): NodeIR {
  const { id, ...rest } = props;
  return { type: "line", id, props: rest };
}

export function text(props: { id: string } & TextProps): NodeIR {
  const { id, ...rest } = props;
  return { type: "text", id, props: rest };
}

export function image(props: { id: string } & ImageProps): NodeIR {
  const { id, ...rest } = props;
  return { type: "image", id, props: rest };
}

export function path(props: { id: string } & PathProps): NodeIR {
  const { id, ...rest } = props;
  return { type: "path", id, props: rest };
}

export function group(props: { id: string } & GroupProps, children: NodeIR[]): NodeIR {
  const { id, ...rest } = props;
  return { type: "group", id, props: rest, children };
}

export function seq(...children: TimelineIR[]): TimelineIR {
  return { kind: "seq", children };
}

export function par(...children: TimelineIR[]): TimelineIR {
  return { kind: "par", children };
}

export function stagger(interval: number, ...children: TimelineIR[]): TimelineIR {
  return { kind: "stagger", interval, children };
}

export interface BeatOpts {
  /** Group children in parallel instead of sequence. */
  parallel?: boolean;
  /** Absolute start (rigid placement). */
  at?: number;
  /** Relative shift before the beat. */
  gap?: number;
  /** Interior time-stretch factor. */
  scale?: number;
  /** Target total duration (→ scale). */
  duration?: number;
  /** Sort key within a parent seq (reorder). */
  order?: number;
}

export function beat(name: string, opts: BeatOpts, children: TimelineIR[]): TimelineIR {
  return { kind: "beat", name, children, ...opts };
}

export function to(
  state: string,
  opts: { duration?: number; ease?: Ease; stagger?: number; filter?: string[]; label?: string } = {},
): TimelineIR {
  return { kind: "to", state, ...opts };
}

export function tween(
  target: string,
  props: Record<string, PropValue>,
  opts: { duration?: number; ease?: Ease; label?: string } = {},
): TimelineIR {
  return { kind: "tween", target, props, ...opts };
}

export function wait(duration: number, label?: string): TimelineIR {
  return { kind: "wait", duration, ...(label !== undefined && { label }) };
}

export function motionPath(
  target: string,
  points: [number, number][],
  opts: {
    duration?: number;
    ease?: Ease;
    closed?: boolean;
    autoRotate?: boolean;
    rotateOffset?: number;
    label?: string;
  } = {},
): TimelineIR {
  return { kind: "motionPath", target, points, ...opts };
}

export interface BehaviorWindow {
  from?: number;
  until?: number;
  ramp?: number;
}

export function oscillate(
  target: string,
  prop: string,
  params: { amplitude: number; frequency: number; phase?: number },
  window: BehaviorWindow = {},
): BehaviorIR {
  return { target, prop, ...window, behavior: { kind: "named", name: "oscillate", params } };
}

export function wiggle(
  target: string,
  prop: string,
  params: { amplitude: number; frequency: number; seed: number },
  window: BehaviorWindow = {},
): BehaviorIR {
  return { target, prop, ...window, behavior: { kind: "named", name: "wiggle", params } };
}
