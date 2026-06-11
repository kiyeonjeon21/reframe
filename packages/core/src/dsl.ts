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
  LineProps,
  NodeIR,
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
