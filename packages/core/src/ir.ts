/**
 * reframe IR — the serialized scene graph.
 *
 * Invariant: every value in the IR is plain JSON data. No functions, ever.
 * Easing is a name or bezier params, dynamic motion is a named behavior with
 * params. `JSON.stringify(scene)` IS the serialization format.
 *
 * Semantics: a scene is evaluated as a pure function of continuous time
 * `evaluate(scene, tSeconds) -> DisplayList`. `fps` is a render hint only.
 */

export type EaseName =
  | "linear"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInQuart"
  | "easeOutQuart"
  | "easeInOutQuart"
  | "easeInExpo"
  | "easeOutExpo"
  | "easeInOutExpo"
  | "easeInBack"
  | "easeOutBack"
  | "easeInOutBack"
  | "easeInElastic"
  | "easeOutElastic"
  | "easeInOutElastic"
  | "easeInBounce"
  | "easeOutBounce"
  | "easeInOutBounce";

export type Ease = EaseName | { cubicBezier: [number, number, number, number] };

export type Anchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Size {
  width: number;
  height: number;
}

/** Props shared by every node. All numeric props are animatable. */
export interface BaseProps {
  x: number;
  y: number;
  opacity?: number;
  rotation?: number; // degrees, around the anchor point
  scale?: number; // around the anchor point
  anchor?: Anchor;
}

export interface RectProps extends BaseProps {
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number; // corner radius
}

export interface EllipseProps extends BaseProps {
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface LineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  /** 0..1 — how much of the line is drawn (for draw-on effects). */
  progress?: number;
}

export interface TextProps extends BaseProps {
  /** Numbers interpolate (count-up) and render via toFixed(contentDecimals). */
  content: string | number;
  /** Decimal places when content is numeric (default 0). */
  contentDecimals?: number;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fill?: string;
  letterSpacing?: number;
}

export interface GroupProps extends BaseProps {}

export interface PathProps extends BaseProps {
  /** SVG path data (the `d` attribute). Drawn as a true vector — crisp at any zoom. */
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /**
   * 0..1 — fraction of the OUTLINE drawn, for a self-drawing "draw-on" effect
   * (animate 0→1). Applies to the stroke; pair a stroke path (draw-on) with a
   * separate fill path (fade-in) for the classic logo reveal. Default 1.
   */
  progress?: number;
  /**
   * Local pivot in the path's own coordinate space — scale/rotation happen
   * around this point. Set it to the art's centre (e.g. the viewBox centre) so
   * a logo zooms/spins about its middle. Default (0,0).
   */
  originX?: number;
  originY?: number;
}

export interface ImageProps extends BaseProps {
  /**
   * Image file path: absolute, or relative to the scene file. Drawn
   * stretched to width×height. As a string prop it switches discretely at
   * segment start (no crossfade) — for hard-cut sequences stack image
   * nodes and step their opacity instead.
   */
  src: string;
  width: number;
  height: number;
}

export type NodeIR =
  | { type: "rect"; id: string; props: RectProps }
  | { type: "ellipse"; id: string; props: EllipseProps }
  | { type: "line"; id: string; props: LineProps }
  | { type: "text"; id: string; props: TextProps }
  | { type: "image"; id: string; props: ImageProps }
  | { type: "path"; id: string; props: PathProps }
  | { type: "group"; id: string; props: GroupProps; children: NodeIR[] };

export type PropValue = number | string;

/**
 * A state is a sparse override: only the props it mentions differ from base.
 * This shape is isomorphic to a USD-style override layer — future
 * human-edit layers compose with the same merge.
 */
export type StateOverride = Record<string, Record<string, PropValue>>;

export type TimelineIR =
  | { kind: "seq"; children: TimelineIR[] }
  | { kind: "par"; children: TimelineIR[] }
  | { kind: "stagger"; interval: number; children: TimelineIR[] }
  | {
      kind: "to";
      state: string;
      duration?: number;
      ease?: Ease;
      /** Per-node offset (seconds), in node declaration order. */
      stagger?: number;
      /** Restrict the transition to these node ids. */
      filter?: string[];
      /** Stable address for overlay timeline patches; must be unique. */
      label?: string;
    }
  | {
      kind: "tween";
      target: string;
      props: Record<string, PropValue>;
      duration?: number;
      ease?: Ease;
      label?: string;
    }
  | { kind: "wait"; duration: number; label?: string }
  | {
      /**
       * Drive a node's x/y along a Catmull-Rom spline through `points`
       * (absolute coords in the node's parent space). With `autoRotate`, the
       * node's rotation tracks the path tangent (plus `rotateOffset`). The
       * position HOLDS at the final point after the path completes, so a swoop
       * is a positioning move, not a one-shot that snaps back.
       */
      kind: "motionPath";
      target: string;
      points: [number, number][];
      closed?: boolean;
      duration?: number;
      ease?: Ease;
      autoRotate?: boolean;
      /** Degrees added to the tangent angle (e.g. 90 if the art faces "up"). */
      rotateOffset?: number;
      label?: string;
    }
  | {
      /**
       * A named, retimable, reorderable span wrapping timeline steps — the
       * semantic unit ("brand-reveal", "feature-cascade") humans and AI revise.
       * Lowers to its grouping (seq, or par if `parallel`) before timing, so
       * `beat(name, {}, children)` is byte-identical to `seq(children)`.
       * Ops are RIGID: they translate/stretch the whole span, preserving the
       * interior's relative timing (so sub-beat overlay edits survive a move).
       */
      kind: "beat";
      name: string;
      parallel?: boolean;
      /** Absolute start (rigid placement). Overrides sequential flow. */
      at?: number;
      /** Relative shift: a leading delay before the beat (and everything after). */
      gap?: number;
      /** Interior time-stretch factor (every child offset and duration ×scale). */
      scale?: number;
      /** Target total duration → scale = duration / natural duration. */
      duration?: number;
      /** Sort key within a parent seq (reorder); default = declaration index. */
      order?: number;
      children: TimelineIR[];
    };

export interface BehaviorIR {
  target: string;
  prop: string;
  /** Active window in seconds; omit for the whole scene. */
  from?: number;
  until?: number;
  /** Linear fade length (s) at each window boundary, avoiding pops. Default 0.2. */
  ramp?: number;
  /** Composed additively on top of the timeline value. */
  behavior:
    | { kind: "named"; name: "oscillate"; params: { amplitude: number; frequency: number; phase?: number } }
    | { kind: "named"; name: "wiggle"; params: { amplitude: number; frequency: number; seed: number } };
}

export type SfxName = "whoosh" | "pop" | "tick" | "rise" | "shimmer" | "thud";

export interface AudioCueIR {
  /** Anchor: a timeline label (the step's start) or absolute seconds. */
  at: string | number;
  /** Seconds relative to the anchor (negative allowed; result clamps to 0). */
  offset?: number;
  /** Procedural SFX name — exactly one of sfx | file. */
  sfx?: SfxName;
  /** Audio file path (absolute, scene-relative, or assets/sfx-relative). */
  file?: string;
  /** Linear gain, default 1. */
  gain?: number;
  /** Synth parameter overrides (seed, duration, …) — numbers only. */
  params?: Record<string, number>;
}

export interface AudioIR {
  bgm?: {
    file?: string;
    /** License-free synthesized bed. */
    synth?: "ambient-pad";
    gain?: number;
    fadeIn?: number;
    fadeOut?: number;
    /** Dip the bed under cues. false disables. */
    duck?: { depth?: number; attack?: number; release?: number } | false;
  };
  cues?: AudioCueIR[];
}

export interface SceneIR {
  version: 1;
  id: string;
  size: Size;
  /** Render hint only — semantics are continuous-time. */
  fps?: number;
  /** Inferred from the timeline when omitted. */
  duration?: number;
  background?: string;
  nodes: NodeIR[];
  states?: Record<string, StateOverride>;
  /** State applied at t=0. */
  initial?: string;
  timeline?: TimelineIR;
  behaviors?: BehaviorIR[];
  /** Label-anchored sound design — cues survive retiming and regeneration. */
  audio?: AudioIR;
  /** Reserved for v2 (Madeus-style temporal constraints). */
  constraints?: unknown[];
  /** Editor-only data (Theatre.js state.json pattern). */
  meta?: Record<string, unknown>;
}

export const DEFAULT_TO_DURATION = 0.5;
export const DEFAULT_TWEEN_DURATION = 0.5;
export const DEFAULT_MOTIONPATH_DURATION = 1;
export const DEFAULT_FPS = 30;
