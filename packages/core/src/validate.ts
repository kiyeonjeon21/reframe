/**
 * Scene validation with actionable error messages — these errors are the
 * feedback loop for LLM-generated scenes, so they name the exact location
 * and suggest what valid input looks like.
 */

import type { NodeIR, SceneIR, TimelineIR } from "./ir.js";

const COMMON_PROPS = ["x", "y", "opacity", "rotation", "scale", "anchor"];
export const PROPS_BY_TYPE: Record<NodeIR["type"], string[]> = {
  rect: [...COMMON_PROPS, "width", "height", "fill", "stroke", "strokeWidth", "radius"],
  ellipse: [...COMMON_PROPS, "width", "height", "fill", "stroke", "strokeWidth"],
  line: ["x1", "y1", "x2", "y2", "stroke", "strokeWidth", "opacity", "progress"],
  text: [...COMMON_PROPS, "content", "contentDecimals", "fontFamily", "fontSize", "fontWeight", "fill", "letterSpacing"],
  image: [...COMMON_PROPS, "src", "width", "height"],
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

  const collect = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      if (nodeById.has(node.id)) {
        problems.push(`duplicate node id "${node.id}" — every node id must be unique`);
      }
      nodeById.set(node.id, node);
      if (node.type === "group") collect(node.children);
    }
  };
  collect(ir.nodes);

  const checkProps = (where: string, nodeId: string, props: Record<string, unknown>) => {
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
        if (!node) {
          problems.push(
            `${path}: motionPath targets unknown node "${tl.target}" — known ids: ${[...nodeById.keys()].join(", ")}`,
          );
        } else if (node.type === "line") {
          problems.push(`${path}: motionPath cannot target a line (no x/y) — "${tl.target}"`);
        }
        if (tl.points.length < 1) problems.push(`${path}: motionPath "${tl.target}" needs at least 1 point`);
        if (tl.duration !== undefined && tl.duration <= 0) {
          problems.push(`${path}: motionPath "${tl.target}" duration must be > 0`);
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
