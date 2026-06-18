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
  | "easeInOutBounce"
  // damped-spring presets (settle to rest within the tween's duration; overshoot
  // governed by the damping ratio). `springBouncy` rings, `springStiff` barely
  // overshoots. For custom physics use the `{ spring: {...} }` object form below.
  | "spring"
  | "springBouncy"
  | "springStiff";

/**
 * A custom spring: a damped harmonic oscillator sampled over the tween's normalized
 * 0..1 window (mass = 1). `stiffness`/`damping` set the damping ratio
 * ζ = damping / (2·√stiffness) — the SHAPE knob (low ζ ⇒ bouncy, high ζ ⇒ snappy);
 * `velocity` is an initial launch slope. Defaults: stiffness 100, damping 10
 * (ζ = 0.5), velocity 0.
 */
export interface SpringEase {
  spring: { stiffness?: number; damping?: number; velocity?: number };
}

export type Ease = EaseName | { cubicBezier: [number, number, number, number] } | SpringEase;

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
  scale?: number; // uniform, around the anchor point
  /** Per-axis scale multipliers on `scale` (default 1) — a 2.5D squash/tilt. */
  scaleX?: number;
  scaleY?: number;
  /** Shear angles in degrees (default 0) — a 2.5D lean. No true perspective. */
  skewX?: number;
  skewY?: number;
  /**
   * Projected depth + 3D tilt. ONLY take effect when the scene sets
   * `camera.perspective` (the activation switch); otherwise inert (absent ⇒
   * byte-identical). `z` places the node in front of (`-z`) or behind (`+z`) the
   * focal plane — the renderer scales it about the vanishing point (parallax,
   * dolly, depth convergence; exact in 2D affine). `rotateX`/`rotateY` (degrees)
   * tilt the node about its horizontal/vertical axis for card-flips and leaning
   * planes — an affine APPROXIMATION (cos foreshorten + keystone skew), not a
   * pixel-true trapezoid (a single rotated quad under perspective is non-affine,
   * which Canvas 2D can't draw; that needs WebGL). See `camera.perspective`.
   */
  z?: number;
  rotateX?: number;
  rotateY?: number;
  anchor?: Anchor;
  /**
   * Pin a TOP-LEVEL node to the screen so the scene `camera` does not move it —
   * for HUD / titles / watermark layers. No-op when the scene has no camera.
   */
  fixed?: boolean;
  /**
   * Paint effects (animatable scalars, in screen pixels — not transformed by the
   * node's rotation/scale or the camera, so a shadow keeps a consistent light
   * direction). `shadowColor` enables a drop shadow / outer glow (`glow`/`dropShadow`
   * helpers). On a `group` these apply to the WHOLE subtree as one composite (the
   * renderer renders it offscreen, then draws it back with the effect once).
   */
  blur?: number; // gaussian blur of the shape, px
  shadowColor?: string; // shadow/glow colour; presence turns the shadow on
  shadowBlur?: number; // shadow softness, px (default 0)
  shadowX?: number; // shadow offset px (glow = 0,0)
  shadowY?: number;
  /** How this node composites with what's already drawn (default "normal"). `screen`/
   *  `add` brighten (additive light/glow), `multiply` tints/deepens. On a `group` the
   *  whole subtree composites as one layer (offscreen) — true group blend. */
  blend?: BlendMode;
}

/** Compositing modes (Canvas `globalCompositeOperation`; `add` maps to `lighter`). */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "lighten"
  | "darken"
  | "add"
  | "color-dodge"
  | "soft-light"
  | "hard-light"
  | "difference";

/**
 * A paint is a solid color string OR a gradient. Coordinates are normalized to the
 * node's bounding box (0..1, SVG `objectBoundingBox` style) so a gradient is just an
 * angle + stops, size-independent. Applied in node-local space, so animating the
 * node's transform (rotation/scale) moves the gradient with it. Build with
 * `linearGradient`/`radialGradient`/`conicGradient` (`gradient.ts`).
 */
export interface ColorStop {
  offset: number; // 0..1 along the gradient
  color: string;
}
export type Gradient =
  | { kind: "linear"; angle?: number; stops: ColorStop[] } // angle deg: 0 = L→R, 90 = T→B
  | { kind: "radial"; cx?: number; cy?: number; r?: number; stops: ColorStop[] } // centre/radius 0..1 of the box
  | { kind: "conic"; angle?: number; cx?: number; cy?: number; stops: ColorStop[] };
export type Paint = string | Gradient;

export interface RectProps extends BaseProps {
  width: number;
  height: number;
  fill?: Paint;
  stroke?: Paint;
  strokeWidth?: number;
  radius?: number; // corner radius
}

export interface EllipseProps extends BaseProps {
  width: number;
  height: number;
  fill?: Paint;
  stroke?: Paint;
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
  /** Pin to the screen so the scene `camera` does not move it (top-level only). */
  fixed?: boolean;
  /** Paint effects (px, screen-space) — see BaseProps. */
  blur?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
}

export interface TextProps extends BaseProps {
  /** Numbers interpolate (count-up) and render via toFixed(contentDecimals). */
  content: string | number;
  /** Decimal places when content is numeric (default 0). */
  contentDecimals?: number;
  /** Group the integer part with thousands separators (e.g. 35,786). */
  contentThousands?: boolean;
  /** Static affixes wrapped around the rendered content — so a count-up can read
   *  "$2.4M" or "+32%" from ONE node (prefix `"$"`, suffix `"M"`) instead of three
   *  hand-positioned ones. Absent ⇒ no change. */
  prefix?: string;
  suffix?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fill?: string;
  letterSpacing?: number;
}

/**
 * A clip region (in a group's local coordinate space) that masks its children —
 * e.g. a rounded-rect phone screen so content inside stays within it. A rect
 * with `radius` covers most cases; ellipse is a bonus.
 */
export type ClipShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius?: number }
  | { kind: "ellipse"; x: number; y: number; width: number; height: number };

export interface GroupProps extends BaseProps {
  /** Clip the group's children to this shape (group-local coords). */
  clip?: ClipShape;
  /**
   * Track matte: the group's FIRST child masks the rest. `"alpha"` masks by the
   * matte's alpha (e.g. video-filled text), `"luma"` by its luminance (e.g. a
   * gradient wipe). Needs ≥2 children; the renderer composites it offscreen.
   */
  matte?: MatteMode;
}

/** Track-matte mode: mask the content by the matte's `alpha` or `luma`. */
export type MatteMode = "alpha" | "luma";

export interface PathProps extends BaseProps {
  /** SVG path data (the `d` attribute). Drawn as a true vector — crisp at any zoom. */
  d: string;
  fill?: Paint;
  stroke?: Paint;
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
  /**
   * How the image maps into its width×height box. `"fill"` (default) stretches to
   * the box (today's behavior); `"cover"` crops the image to fill the box at its
   * natural aspect (centered) — no distortion, no pre-cropping. Discrete (not
   * keyframed); the cover crop is done by the renderer, which knows the decoded size.
   */
  fit?: ImageFit;
}

/** Image box-fit mode. `cover` = crop-to-fill at the image's aspect (centered). */
export type ImageFit = "fill" | "cover";

export interface VideoProps extends BaseProps {
  /** Video file path (absolute, or relative to the scene file). */
  src: string;
  width: number;
  height: number;
  /** Box-fit into width×height, like the image node. `"fill"` (default) | `"cover"`. */
  fit?: ImageFit;
  /**
   * Scene-time (seconds) at which playback begins. Before it, frame 0 (clipStart) shows;
   * the node's visibility is still controlled by opacity/timeline. Default 0.
   */
  start?: number;
  /** Playback speed multiplier (2 = double speed). Default 1. */
  rate?: number;
  /** Source in-point (seconds) shown at `start`. Default 0. */
  clipStart?: number;
  /**
   * Linear gain for the clip's own audio track, muxed into the output at `start`
   * (trimmed from `clipStart`, sped by `rate`). Default 1; `0` mutes the clip.
   */
  volume?: number;
}

export type NodeIR =
  | { type: "rect"; id: string; props: RectProps }
  | { type: "ellipse"; id: string; props: EllipseProps }
  | { type: "line"; id: string; props: LineProps }
  | { type: "text"; id: string; props: TextProps }
  | { type: "image"; id: string; props: ImageProps }
  | { type: "video"; id: string; props: VideoProps }
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
      /** Tangent scale: 1 = smooth (default), 0 = sharp corners, >1 = loopier. */
      curviness?: number;
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
      /**
       * Node ids this beat semantically OWNS (the intent graph). Purely additive
       * metadata — compile/evaluate ignore it, so `beat(name, { nodes }, …)` is
       * byte-identical to `beat(name, {}, …)`. The preview groups these nodes'
       * lanes under the beat; overlay/regen address the beat by its stable name.
       */
      nodes?: string[];
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

/**
 * The scene camera: a viewport over the whole scene. `(x,y)` is the scene point
 * centered in frame (defaults to the frame centre), `zoom` scales about it,
 * `rotation` (degrees) turns about it. Defaults (`x=W/2, y=H/2, zoom=1, rotation=0`)
 * are the identity. Animate it by tweening the reserved target `"camera"`
 * (or the `cameraTo` helper); pin layers out of it with a node's `fixed` flag.
 */
export interface CameraIR {
  x?: number;
  y?: number;
  zoom?: number;
  rotation?: number;
  /**
   * Focal distance in px — the perspective activation switch. Absent ⇒ no
   * projection (nodes' `z`/`rotateX`/`rotateY` are inert, scene byte-identical).
   * When set, nodes project about the vanishing point (the camera look-at, or
   * screen centre): depth factor `p = perspective / (perspective + z)`. Smaller =
   * stronger perspective; larger = flatter. Keyframable (animate it for a dolly /
   * focal pull). A node BEHIND the camera (`perspective + z <= 0`) is culled.
   */
  perspective?: number;
  /**
   * Depth of field (requires `perspective`). `aperture` is the blur strength —
   * screen-pixels of gaussian blur added per unit of depth away from the focal
   * plane; absent / 0 ⇒ no DOF (byte-identical). `focus` is the in-focus depth
   * (same units as a node's world `z`, default 0 = the camera plane). A drawn op
   * at depth `d` gains `aperture · |d − focus|` blur on top of any authored blur,
   * so far (and near) layers soften while the focal plane stays sharp. Both are
   * keyframable — animate `focus` for a rack focus, `aperture` for an iris pull.
   */
  focus?: number;
  aperture?: number;
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
  /** A viewport over the scene, keyframable via the reserved target "camera". */
  camera?: CameraIR;
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

/**
 * Composition — the layer ABOVE a scene: an ordered list of independent scenes
 * with transitions, rendered to one deterministic mp4. Each `scene` stays a
 * normal SceneIR (renders/previews/overlays standalone, unchanged); the
 * composition only lays out their start times and concatenates. No single-scene
 * compile/evaluate path is touched.
 */
export type SceneTransition = "cut" | "crossfade";

export interface CompositionSceneEntry {
  scene: SceneIR;
  /** How this scene enters from the previous one. Default "cut". A crossfade
   *  overlaps the previous scene by `at` (or a default) and blends. */
  transition?: SceneTransition;
  /**
   * Placement relative to the sequential append point (the previous scene's
   * end): a number is an ABSOLUTE start (seconds); a string "-0.5"/"+0.5" shifts
   * the sequential point (overlap / gap). Omitted = sequential (or, for a
   * crossfade, overlap by the default crossfade duration).
   */
  at?: number | string;
}

export interface CompositionIR {
  version: 1;
  id: string;
  scenes: CompositionSceneEntry[];
  /** Composition-level sound: a bed spanning scenes (e.g. kokoro narration) +
   *  absolute-time cues, layered over each scene's own offset cues. */
  audio?: AudioIR;
  meta?: Record<string, unknown>;
}

/** Default crossfade/overlap length (s) when a crossfade gives no explicit `at`. */
export const DEFAULT_CROSSFADE = 0.5;

export const DEFAULT_TO_DURATION = 0.5;
export const DEFAULT_TWEEN_DURATION = 0.5;
export const DEFAULT_MOTIONPATH_DURATION = 1;
export const DEFAULT_FPS = 30;
/** Fallback length (seconds) for a scene with no animating timeline — a static
 *  frame still needs a positive duration to render. Override with scene `duration`. */
export const DEFAULT_STILL_DURATION = 1;
