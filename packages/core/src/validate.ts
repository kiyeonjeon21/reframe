/**
 * Scene validation with actionable error messages — these errors are the
 * feedback loop for LLM-generated scenes, so they name the exact location
 * and suggest what valid input looks like.
 */

import type { CompositionIR, NodeIR, SceneIR, TimelineIR } from "./ir.js";
import { BGM_SYNTHS, SFX_NAMES } from "./ir.js";
import { EASE_NAMES } from "./interpolate.js";

const EASE_SET = new Set<string>(EASE_NAMES);
const FX_PROPS = ["blur", "shadowColor", "shadowBlur", "shadowX", "shadowY", "blend"]; // paint effects (blend is discrete)
const BLEND_MODES = new Set([
  "normal", "multiply", "screen", "overlay", "lighten", "darken",
  "add", "color-dodge", "soft-light", "hard-light", "difference",
]);
const IMAGE_FITS = new Set(["fill", "cover"]);
const COMMON_PROPS = ["x", "y", "opacity", "rotation", "scale", "scaleX", "scaleY", "skewX", "skewY", "z", "rotateX", "rotateY", "anchor", "fixed", ...FX_PROPS];
/** Animatable props of the reserved "camera" target (look-at + zoom + rotation + perspective). */
const CAMERA_PROPS = ["x", "y", "zoom", "rotation", "perspective", "focus", "aperture"];
export const PROPS_BY_TYPE: Record<NodeIR["type"], string[]> = {
  rect: [...COMMON_PROPS, "width", "height", "fill", "stroke", "strokeWidth", "radius"],
  ellipse: [...COMMON_PROPS, "width", "height", "fill", "stroke", "strokeWidth"],
  line: ["x1", "y1", "x2", "y2", "stroke", "strokeWidth", "opacity", "progress", ...FX_PROPS],
  text: [...COMMON_PROPS, "content", "contentDecimals", "contentThousands", "prefix", "suffix", "fontFamily", "fontSize", "fontWeight", "fill", "letterSpacing"],
  image: [...COMMON_PROPS, "src", "width", "height", "fit"],
  video: [...COMMON_PROPS, "src", "width", "height", "fit", "start", "rate", "clipStart", "volume", "fadeIn", "pan"],
  path: [...COMMON_PROPS, "d", "fill", "stroke", "strokeWidth", "progress", "originX", "originY"],
  group: COMMON_PROPS,
};

/**
 * One validation problem, structured so a UI can point at the offending element
 * (`path`) and a consumer can categorize (`code`) without parsing prose. `message`
 * is the human string (unchanged). Codes are stable kebab strings; see the `add(...)`
 * call sites in `validateScene`/`validateComposition`.
 */
export interface ValidationIssue {
  code: string;
  /** Locator for the offending element, e.g. `nodes.box`, `timeline.beat(in)[0]`, `camera.zoom`, `audio.cues[0]`. */
  path: string;
  message: string;
}

export class SceneValidationError extends Error {
  /** Structured form of the problems (code + path + message). */
  readonly issues: ValidationIssue[];
  /** Back-compat: the human messages, one per issue. */
  readonly problems: string[];
  constructor(issues: ValidationIssue[]) {
    super(`Scene validation failed:\n${issues.map((i) => `  - ${i.message}`).join("\n")}`);
    this.name = "SceneValidationError";
    this.issues = issues;
    this.problems = issues.map((i) => i.message);
  }
}

export function validateScene(ir: SceneIR): void {
  const issues: ValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const nodeById = new Map<string, NodeIR>();
  // video `start: "<label>"` anchors — collected during the node walk, checked
  // after all timeline labels are known.
  const startAnchors: { id: string; at: string }[] = [];

  // a fill/stroke is a color string (unchecked, as today) OR a gradient object
  const checkPaint = (where: string, path: string, value: unknown) => {
    if (typeof value !== "object" || value === null) return;
    const g = value as { kind?: unknown; stops?: unknown };
    if (g.kind !== "linear" && g.kind !== "radial" && g.kind !== "conic") {
      add("bad-gradient", path, `${where}: a paint object must be a gradient with kind "linear" / "radial" / "conic"`);
      return;
    }
    if (!Array.isArray(g.stops) || g.stops.length === 0) {
      add("bad-gradient", path, `${where}: gradient "${g.kind}" needs at least one color stop`);
      return;
    }
    g.stops.forEach((s: unknown, i: number) => {
      const st = s as { offset?: unknown; color?: unknown };
      if (typeof st?.color !== "string") add("gradient-stop", path, `${where}: gradient stop ${i} needs a color string`);
      if (typeof st?.offset !== "number" || st.offset < 0 || st.offset > 1) {
        add("gradient-stop", path, `${where}: gradient stop ${i} "offset" must be a number in 0..1`);
      }
    });
  };

  const collect = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      const np = `nodes.${node.id}`;
      if (nodeById.has(node.id)) {
        add("duplicate-node-id", np, `duplicate node id "${node.id}" — every node id must be unique`);
      }
      nodeById.set(node.id, node);
      const props = node.props as unknown as Record<string, unknown>;
      checkPaint(`node "${node.id}" fill`, np, props.fill);
      checkPaint(`node "${node.id}" stroke`, np, props.stroke);
      if (typeof props.blur === "number" && props.blur < 0) add("negative-effect", np, `node "${node.id}": blur must be >= 0`);
      if (typeof props.shadowBlur === "number" && props.shadowBlur < 0) add("negative-effect", np, `node "${node.id}": shadowBlur must be >= 0`);
      if (typeof props.blend === "string" && !BLEND_MODES.has(props.blend)) add("unknown-blend", np, `node "${node.id}": unknown blend "${props.blend}" — use ${[...BLEND_MODES].join(", ")}`);
      if (typeof props.fit === "string" && !IMAGE_FITS.has(props.fit)) add("unknown-fit", np, `node "${node.id}": unknown fit "${props.fit}" — use ${[...IMAGE_FITS].join(", ")}`);
      if (node.type === "video" && typeof node.props.start === "string") startAnchors.push({ id: node.id, at: node.props.start });
      if (node.type === "group") {
        const clip = node.props.clip;
        if (clip) {
          if (clip.kind !== "rect" && clip.kind !== "ellipse") {
            add("unknown-clip-kind", np, `group "${node.id}" clip: unknown kind "${(clip as { kind: string }).kind}" — use "rect" or "ellipse"`);
          }
          if (!(clip.width > 0) || !(clip.height > 0)) {
            add("clip-size", np, `group "${node.id}" clip: width and height must be > 0`);
          }
        }
        const matte = (node.props as { matte?: unknown }).matte;
        if (matte !== undefined) {
          if (matte !== "alpha" && matte !== "luma") {
            add("unknown-matte-mode", np, `group "${node.id}" matte: unknown mode "${String(matte)}" — use "alpha" or "luma"`);
          } else if (node.children.length < 2) {
            add("matte-children", np, `group "${node.id}" matte: needs ≥2 children (first masks the rest)`);
          }
        }
        collect(node.children);
      }
    }
  };
  collect(ir.nodes);

  const checkProps = (where: string, nodeId: string, props: Record<string, unknown>) => {
    // "camera" addresses the scene camera ONLY when no node squats the id (a node
    // named "camera" wins, for back-compat with hand-rolled pseudo-cameras).
    if (nodeId === "camera" && !nodeById.has("camera")) {
      for (const key of Object.keys(props)) {
        if (!CAMERA_PROPS.includes(key)) {
          add("unknown-camera-prop", `camera.${key}`, `${where}: "${key}" is not a camera prop — valid props: ${CAMERA_PROPS.join(", ")}`);
        }
      }
      return;
    }
    const node = nodeById.get(nodeId);
    if (!node) {
      add("unknown-node", `nodes.${nodeId}`, `${where} targets unknown node "${nodeId}" — known ids: ${[...nodeById.keys()].join(", ")}`);
      return;
    }
    const allowed = PROPS_BY_TYPE[node.type];
    for (const key of Object.keys(props)) {
      if (!allowed.includes(key)) {
        add("unknown-prop", `nodes.${nodeId}.${key}`, `${where}: "${key}" is not a prop of ${node.type} "${nodeId}" — valid props: ${allowed.join(", ")}`);
      }
    }
  };

  const states = ir.states ?? {};
  for (const [stateName, overrides] of Object.entries(states)) {
    for (const [nodeId, props] of Object.entries(overrides)) {
      checkProps(`state "${stateName}"`, nodeId, props);
    }
  }

  if (ir.initial !== undefined && !(ir.initial in states)) {
    add("undefined-initial", "initial", `initial state "${ir.initial}" is not defined — defined states: ${Object.keys(states).join(", ") || "(none)"}`);
  }

  const labels = new Set<string>();
  // beat label-anchors (`at: "<label>"`) — checked after all labels are collected.
  const beatAnchors: { name: string; at: string; path: string }[] = [];
  const checkEase = (path: string, ease: unknown) => {
    if (ease === undefined) return;
    if (typeof ease === "string") {
      if (!EASE_SET.has(ease)) {
        add("unknown-ease", path, `${path}: unknown ease "${ease}" — valid: ${EASE_NAMES.join(", ")} (note: there are no *Sine eases)`);
      }
      return;
    }
    if (typeof ease === "object" && ease !== null) {
      const o = ease as Record<string, unknown>;
      if ("spring" in o) return;
      if ("cubicBezier" in o) {
        if (!Array.isArray(o.cubicBezier) || o.cubicBezier.length !== 4) {
          add("bad-ease", path, `${path}: ease cubicBezier must be [x1, y1, x2, y2]`);
        }
        return;
      }
    }
    add("bad-ease", path, `${path}: invalid ease — use a name, { spring }, or { cubicBezier: [x1,y1,x2,y2] }`);
  };

  const checkTimeline = (tl: TimelineIR, path: string) => {
    if ("label" in tl && tl.label !== undefined) {
      if (labels.has(tl.label)) {
        add("duplicate-label", path, `${path}: duplicate timeline label "${tl.label}" — labels are overlay addresses and must be unique`);
      }
      labels.add(tl.label);
    }
    switch (tl.kind) {
      case "seq":
      case "par":
        tl.children.forEach((c, i) => checkTimeline(c, `${path}.${tl.kind}[${i}]`));
        break;
      case "stagger":
        if (tl.interval < 0) add("bad-duration", path, `${path}: stagger interval must be >= 0`);
        tl.children.forEach((c, i) => checkTimeline(c, `${path}.stagger[${i}]`));
        break;
      case "to":
        if (!(tl.state in states)) {
          add("unknown-state", path, `${path}: to("${tl.state}") references an undefined state — defined states: ${Object.keys(states).join(", ") || "(none)"}`);
        }
        if (tl.duration !== undefined && tl.duration <= 0) {
          add("bad-duration", path, `${path}: to("${tl.state}") duration must be > 0`);
        }
        checkEase(path, (tl as { ease?: unknown }).ease);
        for (const id of tl.filter ?? []) {
          if (!nodeById.has(id)) add("unknown-node", path, `${path}: filter contains unknown node "${id}"`);
        }
        break;
      case "tween":
        checkProps(path, tl.target, tl.props);
        if (tl.duration !== undefined && tl.duration <= 0) {
          add("bad-duration", path, `${path}: tween duration must be > 0`);
        }
        checkEase(path, (tl as { ease?: unknown }).ease);
        break;
      case "motionPath": {
        const node = nodeById.get(tl.target);
        const isSceneCamera = tl.target === "camera" && !node;
        if (!isSceneCamera) {
          if (!node) {
            add("unknown-node", path, `${path}: motionPath targets unknown node "${tl.target}" — known ids: ${[...nodeById.keys()].join(", ")}`);
          } else if (node.type === "line") {
            add("motionpath-target", path, `${path}: motionPath cannot target a line (no x/y) — "${tl.target}"`);
          }
        }
        if (tl.points.length < 1) add("motionpath-points", path, `${path}: motionPath "${tl.target}" needs at least 1 point`);
        if (tl.duration !== undefined && tl.duration <= 0) {
          add("bad-duration", path, `${path}: motionPath "${tl.target}" duration must be > 0`);
        }
        if (tl.curviness !== undefined && tl.curviness < 0) {
          add("motionpath-curviness", path, `${path}: motionPath "${tl.target}" curviness must be >= 0`);
        }
        checkEase(path, (tl as { ease?: unknown }).ease);
        break;
      }
      case "wait":
        if (tl.duration < 0) add("bad-duration", path, `${path}: wait duration must be >= 0`);
        break;
      case "beat":
        if (labels.has(tl.name)) {
          add("duplicate-label", path, `${path}: duplicate timeline label "${tl.name}" (beat name) — labels are overlay addresses and must be unique`);
        }
        labels.add(tl.name);
        if (typeof tl.at === "string") beatAnchors.push({ name: tl.name, at: tl.at, path });
        if (tl.duration !== undefined && tl.duration <= 0) {
          add("bad-duration", path, `${path}: beat "${tl.name}" duration must be > 0`);
        }
        if (tl.scale !== undefined && tl.scale <= 0) {
          add("beat-scale", path, `${path}: beat "${tl.name}" scale must be > 0`);
        }
        for (const id of tl.nodes ?? []) {
          if (!nodeById.has(id)) {
            add("beat-owns-unknown", path, `${path}: beat "${tl.name}" owns unknown node "${id}" — known ids: ${[...nodeById.keys()].join(", ")}`);
          }
        }
        tl.children.forEach((c, i) => checkTimeline(c, `${path}.beat(${tl.name})[${i}]`));
        break;
    }
  };
  if (ir.timeline) checkTimeline(ir.timeline, "timeline");

  // beat label-anchors: the target label must exist and not be the beat itself.
  for (const a of beatAnchors) {
    if (a.at === a.name) {
      add("beat-self-anchor", a.path, `${a.path}: beat "${a.name}" at: "${a.at}" cannot anchor to itself`);
    } else if (!labels.has(a.at)) {
      add("unknown-timeline-label", a.path, `${a.path}: beat "${a.name}" at: "${a.at}" — unknown timeline label — known labels: ${[...labels].join(", ") || "(none)"}`);
    }
  }
  for (const a of startAnchors) {
    if (!labels.has(a.at)) {
      add("unknown-timeline-label", `nodes.${a.id}.start`, `video "${a.id}" start: "${a.at}" — unknown timeline label — known labels: ${[...labels].join(", ") || "(none)"}`);
    }
  }

  for (const [i, b] of (ir.behaviors ?? []).entries()) {
    checkProps(`behaviors[${i}]`, b.target, { [b.prop]: 0 });
  }

  if (ir.duration !== undefined && ir.duration <= 0) {
    add("bad-duration", "scene.duration", "scene duration must be > 0");
  }

  if (ir.camera) {
    if (nodeById.has("camera")) {
      add("camera-node-conflict", "camera", `camera: a node is already named "camera" — rename that node or drop the scene camera (the id "camera" can't be both)`);
    }
    for (const [key, value] of Object.entries(ir.camera)) {
      if (key === "zSort") {
        // discrete, non-animatable flag (kept out of the numeric CAMERA_PROPS)
        if (typeof value !== "boolean") add("camera-type", "camera.zSort", `camera.zSort must be a boolean`);
      } else if (!CAMERA_PROPS.includes(key)) {
        add("unknown-camera-prop", `camera.${key}`, `camera: "${key}" is not a camera prop — valid props: ${CAMERA_PROPS.join(", ")}, zSort`);
      } else if (typeof value !== "number") {
        add("camera-type", `camera.${key}`, `camera.${key} must be a number`);
      } else if (key === "perspective" && value <= 0) {
        add("camera-perspective", "camera.perspective", `camera.perspective must be > 0 (focal distance in px) — drop it to disable perspective`);
      } else if (key === "aperture" && value < 0) {
        add("camera-aperture", "camera.aperture", `camera.aperture must be >= 0 (blur px per unit depth) — 0 disables depth of field`);
      }
    }
  }

  for (const [i, cue] of (ir.audio?.cues ?? []).entries()) {
    const cp = `audio.cues[${i}]`;
    if (typeof cue.at === "string" && !labels.has(cue.at)) {
      add("unknown-timeline-label", cp, `${cp}: unknown timeline label "${cue.at}" — known labels: ${[...labels].join(", ") || "(none)"}`);
    }
    if (typeof cue.at === "number" && cue.at < 0) {
      add("bad-duration", cp, `${cp}: "at" must be >= 0`);
    }
    if ((cue.sfx === undefined) === (cue.file === undefined)) {
      add("audio-cue-source", cp, `${cp}: exactly one of "sfx" or "file" is required`);
    }
    if (cue.sfx !== undefined && !(SFX_NAMES as readonly string[]).includes(cue.sfx)) {
      add("unknown-sfx", cp, `${cp}: unknown sfx "${cue.sfx}" — valid: ${SFX_NAMES.join(", ")}`);
    }
    if (cue.gain !== undefined && cue.gain < 0) {
      add("audio-range", cp, `${cp}: gain must be >= 0`);
    }
    if (cue.fadeIn !== undefined && cue.fadeIn < 0) {
      add("audio-range", cp, `${cp}: fadeIn must be >= 0`);
    }
    if (cue.fadeOut !== undefined && cue.fadeOut < 0) {
      add("audio-range", cp, `${cp}: fadeOut must be >= 0`);
    }
    if (cue.pan !== undefined && (cue.pan < -1 || cue.pan > 1)) {
      add("audio-range", cp, `${cp}: pan must be in [-1, 1] (-1 left … +1 right)`);
    }
  }
  for (const [i, line] of (ir.audio?.narration ?? []).entries()) {
    const np = `audio.narration[${i}]`;
    if (typeof line.at === "string" && !labels.has(line.at)) {
      add("unknown-timeline-label", np, `${np}: unknown timeline label "${line.at}" — known labels: ${[...labels].join(", ") || "(none)"}`);
    }
    if (typeof line.at === "number" && line.at < 0) {
      add("bad-duration", np, `${np}: "at" must be >= 0`);
    }
    if (typeof line.text !== "string" || line.text.trim() === "") {
      add("narration-text", np, `${np}: "text" is required and must be non-empty`);
    }
    if (line.gain !== undefined && line.gain < 0) {
      add("audio-range", np, `${np}: gain must be >= 0`);
    }
    if (line.speed !== undefined && line.speed <= 0) {
      add("narration-speed", np, `${np}: speed must be > 0`);
    }
  }

  const duck = ir.audio?.bgm?.duck;
  if (typeof duck === "object" && duck !== null && duck.depth !== undefined && (duck.depth < 0 || duck.depth > 1)) {
    add("audio-range", "audio.bgm.duck.depth", "audio.bgm.duck.depth must be in [0, 1]");
  }
  if (ir.audio?.bgm?.file !== undefined && ir.audio.bgm.synth !== undefined) {
    add("bgm-both", "audio.bgm", 'audio.bgm: use either "file" or "synth", not both');
  }
  const bgmSynth = ir.audio?.bgm?.synth;
  if (bgmSynth !== undefined && !(BGM_SYNTHS as readonly string[]).includes(bgmSynth)) {
    add("unknown-synth", "audio.bgm.synth", `audio.bgm.synth: unknown synth "${bgmSynth}" — valid: ${BGM_SYNTHS.join(", ")}`);
  }

  if (issues.length > 0) throw new SceneValidationError(issues);
}

const TRANSITIONS = ["cut", "crossfade"];

/** Validate a composition: each scene is valid, scene ids are unique, transitions
 *  are known, and `at` strings parse. Throws SceneValidationError on any problem. */
export function validateComposition(comp: CompositionIR): void {
  const issues: ValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  if (comp.scenes.length === 0) add("empty-composition", "scenes", "composition has no scenes");
  const seen = new Set<string>();
  for (const [i, entry] of comp.scenes.entries()) {
    const where = `scenes[${i}]`;
    try {
      validateScene(entry.scene);
    } catch (err) {
      if (err instanceof SceneValidationError) {
        // keep each child issue's code; nest its path + prefix its message
        for (const issue of err.issues) add(issue.code, `${where}.${issue.path}`, `${where} (scene "${entry.scene.id}"): ${issue.message}`);
      } else throw err;
    }
    if (seen.has(entry.scene.id)) {
      add("duplicate-scene-id", where, `${where}: duplicate scene id "${entry.scene.id}" — scene ids must be unique in a composition`);
    }
    seen.add(entry.scene.id);
    if (entry.transition !== undefined && !TRANSITIONS.includes(entry.transition)) {
      add("unknown-transition", where, `${where}: unknown transition "${entry.transition}" — valid: ${TRANSITIONS.join(", ")}`);
    }
    if (typeof entry.at === "string" && Number.isNaN(Number(entry.at))) {
      add("bad-at", where, `${where}: "at" string "${entry.at}" is not a number (use "-0.5"/"+0.5" or a number)`);
    }
    if (typeof entry.at === "number" && entry.at < 0) {
      add("bad-at", where, `${where}: absolute "at" must be >= 0`);
    }
  }
  if (issues.length > 0) throw new SceneValidationError(issues);
}
