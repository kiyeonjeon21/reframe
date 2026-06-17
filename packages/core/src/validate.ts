/**
 * Scene validation with actionable error messages — these errors are the
 * feedback loop for LLM-generated scenes, so they name the exact location
 * and suggest what valid input looks like.
 */

import type { CompositionIR, NodeIR, SceneIR, TimelineIR } from "./ir.js";

const COMMON_PROPS = ["x", "y", "opacity", "rotation", "scale", "scaleX", "scaleY", "skewX", "skewY", "anchor", "fixed"];
/** Animatable props of the reserved "camera" target (look-at point + zoom + rotation). */
const CAMERA_PROPS = ["x", "y", "zoom", "rotation"];
export const PROPS_BY_TYPE: Record<NodeIR["type"], string[]> = {
  rect: [...COMMON_PROPS, "width", "height", "fill", "stroke", "strokeWidth", "radius"],
  ellipse: [...COMMON_PROPS, "width", "height", "fill", "stroke", "strokeWidth"],
  line: ["x1", "y1", "x2", "y2", "stroke", "strokeWidth", "opacity", "progress"],
  text: [...COMMON_PROPS, "content", "contentDecimals", "contentThousands", "fontFamily", "fontSize", "fontWeight", "fill", "letterSpacing"],
  image: [...COMMON_PROPS, "src", "width", "height"],
  path: [...COMMON_PROPS, "d", "fill", "stroke", "strokeWidth", "progress", "originX", "originY"],
  group: COMMON_PROPS,
};

export class SceneValidationError extends Error {
  constructor(public problems: string[]) {
    super(`Scene validation failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "SceneValidationError";
  }
}

export function validateScene(ir: SceneIR): void {
  const problems: string[] = [];
  const nodeById = new Map<string, NodeIR>();

  // a fill/stroke is a color string (unchecked, as today) OR a gradient object
  const checkPaint = (where: string, value: unknown) => {
    if (typeof value !== "object" || value === null) return;
    const g = value as { kind?: unknown; stops?: unknown };
    if (g.kind !== "linear" && g.kind !== "radial" && g.kind !== "conic") {
      problems.push(`${where}: a paint object must be a gradient with kind "linear" / "radial" / "conic"`);
      return;
    }
    if (!Array.isArray(g.stops) || g.stops.length === 0) {
      problems.push(`${where}: gradient "${g.kind}" needs at least one color stop`);
      return;
    }
    g.stops.forEach((s: unknown, i: number) => {
      const st = s as { offset?: unknown; color?: unknown };
      if (typeof st?.color !== "string") problems.push(`${where}: gradient stop ${i} needs a color string`);
      if (typeof st?.offset !== "number" || st.offset < 0 || st.offset > 1) {
        problems.push(`${where}: gradient stop ${i} "offset" must be a number in 0..1`);
      }
    });
  };

  const collect = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      if (nodeById.has(node.id)) {
        problems.push(`duplicate node id "${node.id}" — every node id must be unique`);
      }
      nodeById.set(node.id, node);
      const props = node.props as unknown as Record<string, unknown>;
      checkPaint(`node "${node.id}" fill`, props.fill);
      checkPaint(`node "${node.id}" stroke`, props.stroke);
      if (node.type === "group") {
        const clip = node.props.clip;
        if (clip) {
          if (clip.kind !== "rect" && clip.kind !== "ellipse") {
            problems.push(`group "${node.id}" clip: unknown kind "${(clip as { kind: string }).kind}" — use "rect" or "ellipse"`);
          }
          if (!(clip.width > 0) || !(clip.height > 0)) {
            problems.push(`group "${node.id}" clip: width and height must be > 0`);
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
          problems.push(`${where}: "${key}" is not a camera prop — valid props: ${CAMERA_PROPS.join(", ")}`);
        }
      }
      return;
    }
    const node = nodeById.get(nodeId);
    if (!node) {
      problems.push(
        `${where} targets unknown node "${nodeId}" — known ids: ${[...nodeById.keys()].join(", ")}`,
      );
      return;
    }
    const allowed = PROPS_BY_TYPE[node.type];
    for (const key of Object.keys(props)) {
      if (!allowed.includes(key)) {
        problems.push(
          `${where}: "${key}" is not a prop of ${node.type} "${nodeId}" — valid props: ${allowed.join(", ")}`,
        );
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
    problems.push(
      `initial state "${ir.initial}" is not defined — defined states: ${Object.keys(states).join(", ") || "(none)"}`,
    );
  }

  const labels = new Set<string>();
  const checkTimeline = (tl: TimelineIR, path: string) => {
    if ("label" in tl && tl.label !== undefined) {
      if (labels.has(tl.label)) {
        problems.push(
          `${path}: duplicate timeline label "${tl.label}" — labels are overlay addresses and must be unique`,
        );
      }
      labels.add(tl.label);
    }
    switch (tl.kind) {
      case "seq":
      case "par":
        tl.children.forEach((c, i) => checkTimeline(c, `${path}.${tl.kind}[${i}]`));
        break;
      case "stagger":
        if (tl.interval < 0) problems.push(`${path}: stagger interval must be >= 0`);
        tl.children.forEach((c, i) => checkTimeline(c, `${path}.stagger[${i}]`));
        break;
      case "to":
        if (!(tl.state in states)) {
          problems.push(
            `${path}: to("${tl.state}") references an undefined state — defined states: ${Object.keys(states).join(", ") || "(none)"}`,
          );
        }
        if (tl.duration !== undefined && tl.duration <= 0) {
          problems.push(`${path}: to("${tl.state}") duration must be > 0`);
        }
        for (const id of tl.filter ?? []) {
          if (!nodeById.has(id)) problems.push(`${path}: filter contains unknown node "${id}"`);
        }
        break;
      case "tween":
        checkProps(path, tl.target, tl.props);
        if (tl.duration !== undefined && tl.duration <= 0) {
          problems.push(`${path}: tween duration must be > 0`);
        }
        break;
      case "motionPath": {
        const node = nodeById.get(tl.target);
        const isSceneCamera = tl.target === "camera" && !node;
        if (!isSceneCamera) {
          if (!node) {
            problems.push(
              `${path}: motionPath targets unknown node "${tl.target}" — known ids: ${[...nodeById.keys()].join(", ")}`,
            );
          } else if (node.type === "line") {
            problems.push(`${path}: motionPath cannot target a line (no x/y) — "${tl.target}"`);
          }
        }
        if (tl.points.length < 1) problems.push(`${path}: motionPath "${tl.target}" needs at least 1 point`);
        if (tl.duration !== undefined && tl.duration <= 0) {
          problems.push(`${path}: motionPath "${tl.target}" duration must be > 0`);
        }
        if (tl.curviness !== undefined && tl.curviness < 0) {
          problems.push(`${path}: motionPath "${tl.target}" curviness must be >= 0`);
        }
        break;
      }
      case "wait":
        if (tl.duration < 0) problems.push(`${path}: wait duration must be >= 0`);
        break;
      case "beat":
        if (labels.has(tl.name)) {
          problems.push(
            `${path}: duplicate timeline label "${tl.name}" (beat name) — labels are overlay addresses and must be unique`,
          );
        }
        labels.add(tl.name);
        if (tl.duration !== undefined && tl.duration <= 0) {
          problems.push(`${path}: beat "${tl.name}" duration must be > 0`);
        }
        if (tl.scale !== undefined && tl.scale <= 0) {
          problems.push(`${path}: beat "${tl.name}" scale must be > 0`);
        }
        for (const id of tl.nodes ?? []) {
          if (!nodeById.has(id)) {
            problems.push(
              `${path}: beat "${tl.name}" owns unknown node "${id}" — known ids: ${[...nodeById.keys()].join(", ")}`,
            );
          }
        }
        tl.children.forEach((c, i) => checkTimeline(c, `${path}.beat(${tl.name})[${i}]`));
        break;
    }
  };
  if (ir.timeline) checkTimeline(ir.timeline, "timeline");

  for (const [i, b] of (ir.behaviors ?? []).entries()) {
    checkProps(`behaviors[${i}]`, b.target, { [b.prop]: 0 });
  }

  if (ir.duration !== undefined && ir.duration <= 0) {
    problems.push("scene duration must be > 0");
  }

  if (ir.camera) {
    if (nodeById.has("camera")) {
      problems.push(`camera: a node is already named "camera" — rename that node or drop the scene camera (the id "camera" can't be both)`);
    }
    for (const [key, value] of Object.entries(ir.camera)) {
      if (!CAMERA_PROPS.includes(key)) {
        problems.push(`camera: "${key}" is not a camera prop — valid props: ${CAMERA_PROPS.join(", ")}`);
      } else if (typeof value !== "number") {
        problems.push(`camera.${key} must be a number`);
      }
    }
  }

  const SFX_NAMES = ["whoosh", "pop", "tick", "rise", "shimmer", "thud"];
  for (const [i, cue] of (ir.audio?.cues ?? []).entries()) {
    if (typeof cue.at === "string" && !labels.has(cue.at)) {
      problems.push(
        `audio.cues[${i}]: unknown timeline label "${cue.at}" — known labels: ${[...labels].join(", ") || "(none)"}`,
      );
    }
    if (typeof cue.at === "number" && cue.at < 0) {
      problems.push(`audio.cues[${i}]: "at" must be >= 0`);
    }
    if ((cue.sfx === undefined) === (cue.file === undefined)) {
      problems.push(`audio.cues[${i}]: exactly one of "sfx" or "file" is required`);
    }
    if (cue.sfx !== undefined && !SFX_NAMES.includes(cue.sfx)) {
      problems.push(`audio.cues[${i}]: unknown sfx "${cue.sfx}" — valid: ${SFX_NAMES.join(", ")}`);
    }
    if (cue.gain !== undefined && cue.gain < 0) {
      problems.push(`audio.cues[${i}]: gain must be >= 0`);
    }
  }
  const duck = ir.audio?.bgm?.duck;
  if (typeof duck === "object" && duck !== null && duck.depth !== undefined && (duck.depth < 0 || duck.depth > 1)) {
    problems.push("audio.bgm.duck.depth must be in [0, 1]");
  }
  if (ir.audio?.bgm?.file !== undefined && ir.audio.bgm.synth !== undefined) {
    problems.push('audio.bgm: use either "file" or "synth", not both');
  }

  if (problems.length > 0) throw new SceneValidationError(problems);
}

const TRANSITIONS = ["cut", "crossfade"];

/** Validate a composition: each scene is valid, scene ids are unique, transitions
 *  are known, and `at` strings parse. Throws SceneValidationError on any problem. */
export function validateComposition(comp: CompositionIR): void {
  const problems: string[] = [];
  if (comp.scenes.length === 0) problems.push("composition has no scenes");
  const seen = new Set<string>();
  for (const [i, entry] of comp.scenes.entries()) {
    const where = `scenes[${i}]`;
    try {
      validateScene(entry.scene);
    } catch (err) {
      if (err instanceof SceneValidationError) {
        for (const p of err.problems) problems.push(`${where} (scene "${entry.scene.id}"): ${p}`);
      } else throw err;
    }
    if (seen.has(entry.scene.id)) {
      problems.push(`${where}: duplicate scene id "${entry.scene.id}" — scene ids must be unique in a composition`);
    }
    seen.add(entry.scene.id);
    if (entry.transition !== undefined && !TRANSITIONS.includes(entry.transition)) {
      problems.push(`${where}: unknown transition "${entry.transition}" — valid: ${TRANSITIONS.join(", ")}`);
    }
    if (typeof entry.at === "string" && Number.isNaN(Number(entry.at))) {
      problems.push(`${where}: "at" string "${entry.at}" is not a number (use "-0.5"/"+0.5" or a number)`);
    }
    if (typeof entry.at === "number" && entry.at < 0) {
      problems.push(`${where}: absolute "at" must be >= 0`);
    }
  }
  if (problems.length > 0) throw new SceneValidationError(problems);
}
