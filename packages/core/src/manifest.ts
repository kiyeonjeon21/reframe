/**
 * Scene manifest + addressability lint — make the override namespace queryable.
 *
 * Both override stacks (authoring `composeScene`, runtime `sampleProp`) can only
 * find anything through the node-id / timeline-label namespace. That namespace is
 * the entire edit API, but it's implicit. `sceneManifest` enumerates it — every
 * editable address a human or an AI editor can patch — and `lintScene` flags the
 * surface that ISN'T addressable (motion with no label can't be retimed by an
 * overlay). Pure reads over a CompiledScene; no IR/evaluate changes.
 */

import type { CompiledScene } from "./compile.js";
import type { NodeIR, Size, TimelineIR } from "./ir.js";
import { TIMELINE_PATCHABLE } from "./compose.js";
import { PROPS_BY_TYPE } from "./validate.js";
import { brand, theme, type Theme } from "./theme.js";

export interface NodeAddress {
  id: string;
  type: NodeIR["type"];
  /** Enclosing group id (absent for a top-level node). */
  parent?: string;
  /** Overlay address for base-prop patches: `nodes.<id>`. */
  address: string;
  /** Props an overlay may set on this node (PROPS_BY_TYPE for its type). */
  editableProps: string[];
  /** Props this node actually animates (has a tween/to segment or a motion path). */
  animatedProps: string[];
  /** State names that override this node (`states.<name>.<id>` addresses). */
  inStates: string[];
}

export interface StateAddress {
  name: string;
  address: string; // `states.<name>`
  touches: { id: string; props: string[] }[];
}

export interface TimelineAddress {
  label: string;
  kind: TimelineIR["kind"];
  t0: number;
  t1: number;
  /** Params an overlay may patch on this step (TIMELINE_PATCHABLE for its kind). */
  patchable: string[];
  address: string; // `timeline.<label>`
}

export interface BeatAddress {
  name: string;
  t0: number;
  t1: number;
  /** Node ids the beat semantically owns (its `nodes` field). */
  ownsNodes: string[];
  address: string; // `timeline.<name>`
}

export interface BehaviorAddress {
  target: string;
  prop: string;
  kind: string; // "oscillate" | "wiggle"
  address: string; // `behaviors.<target>.<prop>`
}

export interface ManifestSummary {
  nodeCount: number;
  /** Labeled timeline steps + named beats (addressable timing). */
  labeledSteps: number;
  /** Motion steps (tween/to/motionPath) with NO label — unaddressable timing. */
  unlabeledMotionSteps: number;
  /** labeled motion steps / total motion steps (1 when there is no motion). */
  motionAddressableRatio: number;
}

/** A patchable design token: its dotted path, current effective value, and overlay address. */
export interface DesignTokenAddress {
  path: string; // e.g. "color.accent"
  value: string | number;
  address: string; // `design.<path>`
}

export interface SceneManifest {
  scene: { id: string; duration: number; fps: number; size: Size; background?: string };
  nodes: NodeAddress[];
  states: StateAddress[];
  timeline: TimelineAddress[];
  beats: BeatAddress[];
  behaviors: BehaviorAddress[];
  /** Patchable design tokens (the scene's `design` merged onto the house brand). */
  design: DesignTokenAddress[];
  summary: ManifestSummary;
}

/** Dotted paths to every scalar (string/number) leaf in a theme — the patchable token set. */
function designTokenAddresses(effective: Theme): DesignTokenAddress[] {
  const out: DesignTokenAddress[] = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string" || typeof v === "number") {
        out.push({ path, value: v, address: `design.${path}` });
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, path);
      }
    }
  };
  walk(effective as unknown as Record<string, unknown>, "");
  return out;
}

export interface LintFinding {
  rule: string;
  severity: "warn" | "error";
  message: string;
  /** Present when the finding refers to an existing address. */
  address?: string;
}

/** Props a node animates: each `${id}.<prop>` segment, plus motion-path x/y(/rotation). */
function animatedPropsOf(compiled: CompiledScene, id: string): string[] {
  const props = new Set<string>();
  const prefix = `${id}.`;
  for (const key of compiled.segments.keys()) {
    if (key.startsWith(prefix)) props.add(key.slice(prefix.length));
  }
  const drivers = compiled.motionPaths.get(id);
  if (drivers && drivers.length > 0) {
    props.add("x");
    props.add("y");
    if (drivers.some((d) => d.autoRotate)) props.add("rotation");
  }
  return [...props].sort();
}

/** label/beat-name → its TimelineIR node (mirrors compose.ts walkTimeline). */
function indexTimeline(tl: TimelineIR | undefined): Map<string, TimelineIR> {
  const byLabel = new Map<string, TimelineIR>();
  const walk = (t: TimelineIR) => {
    if ("label" in t && t.label !== undefined) byLabel.set(t.label, t);
    if (t.kind === "beat") byLabel.set(t.name, t);
    if ("children" in t) t.children.forEach(walk);
  };
  if (tl) walk(tl);
  return byLabel;
}

/** Visit every MOTION step (tween/to/motionPath) with whether it carries a label. */
function walkMotion(tl: TimelineIR | undefined, visit: (kind: string, labeled: boolean, target: string) => void): void {
  const walk = (t: TimelineIR) => {
    if (t.kind === "tween" || t.kind === "motionPath") {
      visit(t.kind, "label" in t && t.label !== undefined, t.target);
    } else if (t.kind === "to") {
      visit("to", t.label !== undefined, t.state);
    }
    if ("children" in t) t.children.forEach(walk);
  };
  if (tl) walk(tl);
}

/** Enumerate a scene's full addressable / editable surface. Pure + deterministic. */
export function sceneManifest(compiled: CompiledScene): SceneManifest {
  const ir = compiled.ir;

  // which state names touch each node id
  const statesByNode = new Map<string, string[]>();
  for (const [name, override] of Object.entries(ir.states ?? {})) {
    for (const id of Object.keys(override)) {
      const list = statesByNode.get(id) ?? [];
      list.push(name);
      statesByNode.set(id, list);
    }
  }

  const nodes: NodeAddress[] = [];
  const walkNodes = (list: NodeIR[], parent: string | undefined) => {
    for (const node of list) {
      nodes.push({
        id: node.id,
        type: node.type,
        ...(parent !== undefined ? { parent } : {}),
        address: `nodes.${node.id}`,
        editableProps: [...PROPS_BY_TYPE[node.type]],
        animatedProps: animatedPropsOf(compiled, node.id),
        inStates: statesByNode.get(node.id) ?? [],
      });
      if (node.type === "group") walkNodes(node.children, node.id);
    }
  };
  walkNodes(ir.nodes, undefined);

  const states: StateAddress[] = Object.entries(ir.states ?? {}).map(([name, override]) => ({
    name,
    address: `states.${name}`,
    touches: Object.entries(override).map(([id, props]) => ({ id, props: Object.keys(props) })),
  }));

  const byLabel = indexTimeline(ir.timeline);
  const timeline: TimelineAddress[] = [];
  const beats: BeatAddress[] = [];
  for (const [label, span] of compiled.labelTimes) {
    const step = byLabel.get(label);
    const kind = step?.kind ?? "seq";
    if (compiled.beatTimes.has(label) && step?.kind === "beat") {
      beats.push({ name: label, t0: span.t0, t1: span.t1, ownsNodes: step.nodes ?? [], address: `timeline.${label}` });
    } else {
      timeline.push({ label, kind, t0: span.t0, t1: span.t1, patchable: TIMELINE_PATCHABLE[kind] ?? [], address: `timeline.${label}` });
    }
  }
  timeline.sort((a, b) => a.t0 - b.t0 || a.label.localeCompare(b.label));
  beats.sort((a, b) => a.t0 - b.t0 || a.name.localeCompare(b.name));

  const behaviors: BehaviorAddress[] = (ir.behaviors ?? []).map((b) => ({
    target: b.target,
    prop: b.prop,
    kind: b.behavior.name,
    address: `behaviors.${b.target}.${b.prop}`,
  }));

  let motionTotal = 0;
  let motionLabeled = 0;
  walkMotion(ir.timeline, (_kind, labeled) => {
    motionTotal++;
    if (labeled) motionLabeled++;
  });

  return {
    scene: {
      id: ir.id,
      duration: compiled.duration,
      fps: ir.fps ?? 30,
      size: ir.size,
      ...(ir.background !== undefined ? { background: ir.background } : {}),
    },
    nodes,
    states,
    timeline,
    beats,
    behaviors,
    design: designTokenAddresses(ir.design ? theme(ir.design) : brand),
    summary: {
      nodeCount: nodes.length,
      labeledSteps: timeline.length + beats.length,
      unlabeledMotionSteps: motionTotal - motionLabeled,
      motionAddressableRatio: motionTotal === 0 ? 1 : motionLabeled / motionTotal,
    },
  };
}

/** Flag the surface that ISN'T overlay-addressable. Static, no render. */
export function lintScene(compiled: CompiledScene): LintFinding[] {
  const findings: LintFinding[] = [];
  walkMotion(compiled.ir.timeline, (kind, labeled, target) => {
    if (labeled) return;
    const what = kind === "to" ? `to("${target}")` : `${kind} on "${target}"`;
    findings.push({
      rule: "unlabeled-motion",
      severity: "warn",
      message: `${what} has no label — its timing can't be retimed or redirected by an overlay, and a base regeneration can silently drop it. Add a stable label.`,
    });
  });
  return findings;
}
