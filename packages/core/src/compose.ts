/**
 * USD-style non-destructive layer composition: human edits live in overlay
 * documents that re-apply on top of a regenerated base scene.
 *
 * Contract: composeScene never throws because the base drifted (a renamed or
 * retyped node) — those edits are skipped and reported as orphans, loudly.
 * Defects in the overlay itself (duplicate ids, invalid values) surface as
 * validation errors on the composed result. Silent failure is the one
 * behavior this module must never have.
 */

import { compileScene } from "./compile.js";
import type { BehaviorIR, Ease, NodeIR, PropValue, SceneIR, TimelineIR } from "./ir.js";
import { PROPS_BY_TYPE, validateScene } from "./validate.js";
import { brand, getDeepPath, setDeepPath } from "./theme.js";

export interface OverlayDoc {
  reframeOverlay: 1;
  /** Shown in reports; falls back to "overlay-<index>". */
  name?: string;
  /** Scene id this overlay was authored against — mismatch is a warning. */
  target?: string;
  scene?: { background?: string; duration?: number; fps?: number };
  /**
   * Design-token patch: dotted token path -> value (e.g. `{ "color.accent": "#1E90FF" }`).
   * Re-skins the scene's `design` so every `token()` ref resolves to the new value on
   * recompile. Addressed by token NAME, so it survives an AI regen of the base; an
   * unknown token path is reported as an orphan.
   */
  design?: Record<string, PropValue>;
  /** nodeId -> prop -> value; null deletes the prop key (USD "block"). */
  nodes?: Record<string, Record<string, PropValue | null>>;
  /** stateName -> nodeId -> prop -> value/null. */
  states?: Record<string, Record<string, Record<string, PropValue | null>>>;
  behaviors?: {
    /** Upsert keyed by (target, prop): replaces a matching behavior or appends. */
    set?: BehaviorIR[];
    remove?: { target: string; prop: string }[];
  };
  /** Complete nodes appended at the scene root, owned by this overlay. */
  addNodes?: NodeIR[];
  /**
   * Remove nodes by id. Only nodes added by an overlay (via `addNodes`) can be
   * removed — a node owned by the BASE scene is refused and reported as an
   * orphan (hide it with `opacity: 0` instead, so the regenerated design is
   * never silently dropped). An unknown id is likewise an orphan.
   */
  removeNodes?: string[];
  /**
   * Motion fragments (e.g. `motionOp(...)` beats) APPENDED to the scene
   * timeline — composed in `par` with the base under their own beat labels, so
   * the editor can ADD motion to a node, not just patch existing motion. A
   * fragment whose target id is gone is skipped and reported as an orphan.
   */
  addTimeline?: TimelineIR[];
  /**
   * Parameter patches on labeled timeline steps (or beats by name). Patchable
   * per kind: to -> duration/ease/stagger, tween -> duration/ease,
   * wait -> duration, motionPath -> points/duration/ease, beat ->
   * at/gap/scale/duration/order. A beat move is rigid, so child labels inside
   * it keep their relative timing and any overlay edits on those children
   * survive. A dragged motionPath waypoint is a `points` patch — it survives a
   * knob-driven base regen because the step label is stable.
   */
  timeline?: Record<
    string,
    {
      duration?: number;
      ease?: Ease;
      stagger?: number;
      at?: number;
      gap?: number;
      scale?: number;
      order?: number;
      points?: [number, number][];
      curviness?: number;
      autoRotate?: boolean;
    }
  >;
  /**
   * Remove timeline steps/beats by stable label (or beat name) — splice them out
   * of their parent group. The STRUCTURAL complement of a `timeline` retiming
   * patch: drop a montage shot (`removeTimeline: ["shot-2"]`), cut a beat, etc.
   * The surrounding `seq` re-accumulates, so later steps ripple up and any
   * label-anchored dependents follow. An unknown label is an orphan (did the base
   * regen drop it?). Reorder is the existing `timeline.<beat>.order` patch; this
   * is its delete counterpart. NB a node that still anchors to a removed label
   * (e.g. a video `start: "shot-2"`) must also be neutralised — patch its `start`
   * to a number — or post-compose validation rejects the dangling anchor.
   */
  removeTimeline?: string[];
  /**
   * Insert complete nodes at a POSITION (vs `addNodes`, which only appends at the
   * root end / paints on top). Owned by this overlay. Position is `before`/`after`
   * a sibling root-node id, or a numeric `index`; absent = append. Lets an inserted
   * layer land UNDER later nodes — e.g. a new montage shot below the vignette/scrim
   * grade (`{ node, before: "shot-vignette" }`). An unknown `before`/`after` id is an
   * orphan; a duplicate id surfaces via post-compose validation.
   */
  insertNodes?: { node: NodeIR; before?: string; after?: string; index?: number }[];
  /**
   * Insert a timeline step/beat at a POSITION inside a named beat (vs `addTimeline`,
   * which appends a fragment in `par`). `into` = a beat NAME (the only addressable
   * timeline container); position is `before`/`after` a child's label/beat-name, or a
   * numeric `index`; absent = append. The STRUCTURAL insert complement of
   * `removeTimeline` — e.g. splice a hand-authored shot beat into a montage:
   * `{ into: "montage", after: "shot-1", step }`. The step's tween/motionPath targets
   * must exist (orphan otherwise), as must `into` and any `before`/`after`.
   */
  insertTimeline?: { into: string; before?: string; after?: string; index?: number; step: TimelineIR }[];
}

export interface ComposeReport {
  applied: {
    layer: string;
    address: string;
    action:
      | "set"
      | "unset"
      | "add-node"
      | "remove-node"
      | "behavior-set"
      | "behavior-remove"
      | "add-timeline"
      | "remove-timeline"
      | "insert-node"
      | "insert-timeline";
  }[];
  orphans: { layer: string; address: string; reason: string }[];
  warnings: string[];
}

const SCENE_PATCHABLE = ["background", "duration", "fps"] as const;

/**
 * Which params an overlay may patch on a labeled timeline step, per kind — the
 * single source of truth for both `applyOverlay` (what it accepts) and
 * `sceneManifest` (what it advertises as patchable). Keep them from drifting.
 */
export const TIMELINE_PATCHABLE: Record<string, string[]> = {
  to: ["duration", "ease", "stagger"],
  tween: ["duration", "ease"],
  wait: ["duration"],
  motionPath: ["points", "duration", "ease", "curviness", "autoRotate"],
  beat: ["at", "gap", "scale", "duration", "order"],
};

export function composeScene(
  base: SceneIR,
  ...overlays: OverlayDoc[]
): { ir: SceneIR; report: ComposeReport } {
  const ir = structuredClone(base);
  const report: ComposeReport = { applied: [], orphans: [], warnings: [] };

  // Ids the BASE scene owns (computed before any overlay runs) — removeNodes may
  // only drop overlay-added nodes, never these.
  const baseNodeIds = new Set<string>();
  const collectBase = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      baseNodeIds.add(node.id);
      if (node.type === "group") collectBase(node.children);
    }
  };
  collectBase(base.nodes);

  overlays.forEach((overlay, index) => {
    const layer = overlay.name ?? `overlay-${index}`;
    if (overlay.target !== undefined && overlay.target !== ir.id) {
      report.warnings.push(
        `${layer}: authored against scene "${overlay.target}" but composing onto "${ir.id}"`,
      );
    }
    applyOverlay(ir, overlay, layer, report, baseNodeIds);
  });

  validateScene(ir);
  return { ir, report };
}

function applyOverlay(
  ir: SceneIR,
  overlay: OverlayDoc,
  layer: string,
  report: ComposeReport,
  baseNodeIds: Set<string>,
) {
  const nodeById = new Map<string, NodeIR>();
  const collect = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      nodeById.set(node.id, node);
      if (node.type === "group") collect(node.children);
    }
  };
  collect(ir.nodes);
  const knownIds = () => [...nodeById.keys()].join(", ");

  const orphan = (address: string, reason: string) =>
    report.orphans.push({ layer, address, reason });
  const applied = (address: string, action: ComposeReport["applied"][number]["action"]) =>
    report.applied.push({ layer, address, action });

  // Patch a node's props map (used for both base props and state overrides).
  const patchProps = (
    address: string,
    node: NodeIR,
    target: Record<string, unknown>,
    patch: Record<string, PropValue | null>,
  ) => {
    const allowed = PROPS_BY_TYPE[node.type];
    for (const [prop, value] of Object.entries(patch)) {
      if (!allowed.includes(prop)) {
        orphan(
          `${address}.${prop}`,
          `"${prop}" is not a prop of ${node.type} "${node.id}" — the base may have changed this node's type; valid props: ${allowed.join(", ")}`,
        );
        continue;
      }
      if (value === null) {
        delete target[prop];
        applied(`${address}.${prop}`, "unset");
      } else {
        target[prop] = value;
        applied(`${address}.${prop}`, "set");
      }
    }
  };

  // --- scene-level (whitelisted keys only) ---
  if (overlay.scene) {
    for (const key of SCENE_PATCHABLE) {
      const value = overlay.scene[key];
      if (value !== undefined) {
        (ir as unknown as Record<string, unknown>)[key] = value;
        applied(`scene.${key}`, "set");
      }
    }
  }

  // --- design tokens (validated against the brand shape) ---
  if (overlay.design) {
    for (const [path, value] of Object.entries(overlay.design)) {
      if (getDeepPath(brand, path) === undefined) {
        orphan(`design.${path}`, `"${path}" is not a known design token`);
        continue;
      }
      setDeepPath((ir.design ??= {}) as Record<string, unknown>, path, value);
      applied(`design.${path}`, "set");
    }
  }

  // --- node base props ---
  for (const [id, patch] of Object.entries(overlay.nodes ?? {})) {
    const node = nodeById.get(id);
    if (!node) {
      orphan(
        `nodes.${id}`,
        `unknown node "${id}" — known ids: ${knownIds()}; did the base regeneration rename it?`,
      );
      continue;
    }
    patchProps(`nodes.${id}`, node, node.props as unknown as Record<string, unknown>, patch);
  }

  // --- state overrides (stateName -> nodeId -> prop) ---
  for (const [stateName, statePatch] of Object.entries(overlay.states ?? {})) {
    const state = ir.states?.[stateName];
    if (!state) {
      orphan(
        `states.${stateName}`,
        `unknown state "${stateName}" — defined states: ${Object.keys(ir.states ?? {}).join(", ") || "(none)"}`,
      );
      continue;
    }
    for (const [id, patch] of Object.entries(statePatch)) {
      const node = nodeById.get(id);
      if (!node) {
        orphan(
          `states.${stateName}.${id}`,
          `unknown node "${id}" — known ids: ${knownIds()}; did the base regeneration rename it?`,
        );
        continue;
      }
      const target = (state[id] ??= {});
      patchProps(`states.${stateName}.${id}`, node, target, patch);
    }
  }

  // --- behaviors: remove first, then upsert ---
  if (overlay.behaviors?.remove || overlay.behaviors?.set) {
    ir.behaviors ??= [];
    for (const { target, prop } of overlay.behaviors.remove ?? []) {
      const index = ir.behaviors.findIndex((b) => b.target === target && b.prop === prop);
      if (index < 0) {
        orphan(
          `behaviors.remove.${target}.${prop}`,
          `no behavior on "${target}.${prop}" to remove`,
        );
        continue;
      }
      ir.behaviors.splice(index, 1);
      applied(`behaviors.${target}.${prop}`, "behavior-remove");
    }
    for (const behavior of overlay.behaviors.set ?? []) {
      if (!nodeById.has(behavior.target)) {
        orphan(
          `behaviors.set.${behavior.target}.${behavior.prop}`,
          `unknown node "${behavior.target}" — known ids: ${knownIds()}`,
        );
        continue;
      }
      const index = ir.behaviors.findIndex(
        (b) => b.target === behavior.target && b.prop === behavior.prop,
      );
      if (index >= 0) ir.behaviors[index] = structuredClone(behavior);
      else ir.behaviors.push(structuredClone(behavior));
      applied(`behaviors.${behavior.target}.${behavior.prop}`, "behavior-set");
    }
  }

  // --- timeline patches addressed by stable step labels ---
  if (overlay.timeline) {
    const byLabel = new Map<string, TimelineIR>();
    const walkTimeline = (tl: TimelineIR) => {
      if ("label" in tl && tl.label !== undefined) byLabel.set(tl.label, tl);
      if (tl.kind === "beat") byLabel.set(tl.name, tl); // beats addressed by name
      if ("children" in tl) tl.children.forEach(walkTimeline);
    };
    if (ir.timeline) walkTimeline(ir.timeline);

    let timingPatched = false;
    for (const [label, patch] of Object.entries(overlay.timeline)) {
      const step = byLabel.get(label);
      if (!step) {
        orphan(
          `timeline.${label}`,
          `unknown timeline label "${label}" — known labels: ${[...byLabel.keys()].join(", ") || "(none)"}; did the base regeneration drop it?`,
        );
        continue;
      }
      const allowed = TIMELINE_PATCHABLE[step.kind] ?? [];
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (!allowed.includes(key)) {
          orphan(
            `timeline.${label}.${key}`,
            `"${key}" is not patchable on a ${step.kind} step — patchable: ${allowed.join(", ")}`,
          );
          continue;
        }
        (step as unknown as Record<string, unknown>)[key] = value;
        applied(`timeline.${label}.${key}`, "set");
        if (["duration", "stagger", "at", "gap", "scale", "order"].includes(key)) timingPatched = true;
      }
    }
    // scene() bakes the inferred duration into ir.duration, so a patched step
    // duration leaves it stale. Re-infer unless this overlay pins it explicitly.
    if (timingPatched && overlay.scene?.duration === undefined) {
      delete ir.duration;
      ir.duration = compileScene(ir).duration;
    }
  }

  // --- removed timeline steps/beats: spliced from their parent by stable label ---
  if (overlay.removeTimeline && overlay.removeTimeline.length > 0) {
    // walk recording each labelled step / named beat with its parent + the child ref
    // (splice by identity, not index, so removing siblings can't shift positions out
    // from under each other).
    const located = new Map<string, { parent: TimelineIR; child: TimelineIR }>();
    const walkParents = (tl: TimelineIR) => {
      if (!("children" in tl)) return;
      for (const child of tl.children) {
        if ("label" in child && child.label !== undefined) located.set(child.label, { parent: tl, child });
        if (child.kind === "beat") located.set(child.name, { parent: tl, child });
        walkParents(child);
      }
    };
    if (ir.timeline) walkParents(ir.timeline);

    const toRemove = new Map<TimelineIR, Set<TimelineIR>>();
    let removed = false;
    for (const label of overlay.removeTimeline) {
      const hit = located.get(label);
      if (!hit) {
        orphan(
          `removeTimeline.${label}`,
          `unknown timeline label "${label}" — known labels: ${[...located.keys()].join(", ") || "(none)"}; did the base regeneration drop it?`,
        );
        continue;
      }
      let set = toRemove.get(hit.parent);
      if (!set) toRemove.set(hit.parent, (set = new Set()));
      set.add(hit.child);
      applied(`removeTimeline.${label}`, "remove-timeline");
      removed = true;
    }
    for (const [parent, children] of toRemove) {
      const p = parent as { children: TimelineIR[] };
      p.children = p.children.filter((c) => !children.has(c));
    }
    // removal shifts later steps (the seq re-accumulates) → re-infer the duration.
    if (removed && overlay.scene?.duration === undefined) {
      delete ir.duration;
      ir.duration = compileScene(ir).duration;
    }
  }

  // --- added nodes: appended at root, painted on top. Duplicate ids are an
  // overlay authoring defect and surface via validateScene after composition.
  for (const node of overlay.addNodes ?? []) {
    ir.nodes.push(structuredClone(node));
    nodeById.set(node.id, node);
    applied(`addNodes.${node.id}`, "add-node");
  }

  // --- removed nodes: overlay-added only; a base node is refused (hide it). ---
  for (const id of overlay.removeNodes ?? []) {
    if (baseNodeIds.has(id)) {
      orphan(
        `removeNodes.${id}`,
        `"${id}" is a base scene node — the scene owns it; hide it with opacity: 0 instead of removing`,
      );
      continue;
    }
    const index = ir.nodes.findIndex((n) => n.id === id);
    if (index < 0) {
      orphan(
        `removeNodes.${id}`,
        `unknown overlay-added node "${id}" — nothing to remove`,
      );
      continue;
    }
    ir.nodes.splice(index, 1);
    nodeById.delete(id);
    applied(`removeNodes.${id}`, "remove-node");
  }

  // --- inserted nodes: positioned at root (vs addNodes which only appends on top) ---
  for (const spec of overlay.insertNodes ?? []) {
    const node = spec.node;
    let at = ir.nodes.length; // default = append
    if (spec.before !== undefined || spec.after !== undefined) {
      const refId = spec.before ?? spec.after!;
      const refIdx = ir.nodes.findIndex((n) => n.id === refId);
      if (refIdx < 0) {
        orphan(
          `insertNodes.${node.id}`,
          `unknown ${spec.before !== undefined ? "before" : "after"} node "${refId}" — known root ids: ${ir.nodes.map((n) => n.id).join(", ") || "(none)"}`,
        );
        continue;
      }
      at = spec.before !== undefined ? refIdx : refIdx + 1;
    } else if (spec.index !== undefined) {
      at = Math.max(0, Math.min(ir.nodes.length, spec.index));
    }
    ir.nodes.splice(at, 0, structuredClone(node));
    nodeById.set(node.id, node);
    applied(`insertNodes.${node.id}`, "insert-node");
  }

  // --- added timeline fragments (motion ops): appended in par with the base ---
  if (overlay.addTimeline && overlay.addTimeline.length > 0) {
    const collectTargets = (tl: TimelineIR, out: Set<string>) => {
      if (tl.kind === "tween" || tl.kind === "motionPath") out.add(tl.target);
      if ("children" in tl) tl.children.forEach((c) => collectTargets(c, out));
    };
    const valid: TimelineIR[] = [];
    overlay.addTimeline.forEach((frag, i) => {
      const targets = new Set<string>();
      collectTargets(frag, targets);
      const missing = [...targets].filter((id) => !nodeById.has(id));
      if (missing.length > 0) {
        orphan(`addTimeline[${i}]`, `targets unknown node(s) ${missing.join(", ")} — known ids: ${knownIds()}`);
        return;
      }
      valid.push(structuredClone(frag));
      applied(`addTimeline[${i}]`, "add-timeline");
    });
    if (valid.length > 0) {
      ir.timeline = ir.timeline
        ? { kind: "par", children: [ir.timeline, ...valid] }
        : valid.length === 1
          ? valid[0]!
          : { kind: "par", children: valid };
      delete ir.duration;
      ir.duration = compileScene(ir).duration;
    }
  }

  // --- inserted timeline steps/beats: positioned inside a named beat ---
  if (overlay.insertTimeline && overlay.insertTimeline.length > 0) {
    // beats are the only addressable timeline containers (seq/par have no name)
    const beatByName = new Map<string, TimelineIR & { children: TimelineIR[] }>();
    const walkBeats = (tl: TimelineIR) => {
      if (!("children" in tl)) return;
      if (tl.kind === "beat") beatByName.set(tl.name, tl as TimelineIR & { children: TimelineIR[] });
      tl.children.forEach(walkBeats);
    };
    if (ir.timeline) walkBeats(ir.timeline);
    // a child's stable handle: a beat by name, any other step by its label
    const childKey = (c: TimelineIR): string | undefined =>
      c.kind === "beat" ? c.name : "label" in c && c.label !== undefined ? c.label : undefined;
    const collectTargets = (tl: TimelineIR, out: Set<string>) => {
      if (tl.kind === "tween" || tl.kind === "motionPath") out.add(tl.target);
      if ("children" in tl) tl.children.forEach((c) => collectTargets(c, out));
    };

    let inserted = false;
    overlay.insertTimeline.forEach((spec, i) => {
      const parent = beatByName.get(spec.into);
      if (!parent) {
        orphan(`insertTimeline[${i}]`, `unknown beat "${spec.into}" — known beats: ${[...beatByName.keys()].join(", ") || "(none)"}`);
        return;
      }
      const targets = new Set<string>();
      collectTargets(spec.step, targets);
      const missing = [...targets].filter((id) => !nodeById.has(id));
      if (missing.length > 0) {
        orphan(`insertTimeline[${i}]`, `step targets unknown node(s) ${missing.join(", ")} — known ids: ${knownIds()}`);
        return;
      }
      let at = parent.children.length; // default = append
      if (spec.before !== undefined || spec.after !== undefined) {
        const refKey = spec.before ?? spec.after!;
        const refIdx = parent.children.findIndex((c) => childKey(c) === refKey);
        if (refIdx < 0) {
          orphan(
            `insertTimeline[${i}]`,
            `unknown ${spec.before !== undefined ? "before" : "after"} step "${refKey}" in beat "${spec.into}" — children: ${parent.children.map(childKey).filter(Boolean).join(", ") || "(none)"}`,
          );
          return;
        }
        at = spec.before !== undefined ? refIdx : refIdx + 1;
      } else if (spec.index !== undefined) {
        at = Math.max(0, Math.min(parent.children.length, spec.index));
      }
      parent.children.splice(at, 0, structuredClone(spec.step));
      applied(`insertTimeline[${i}]`, "insert-timeline");
      inserted = true;
    });
    if (inserted && overlay.scene?.duration === undefined) {
      delete ir.duration;
      ir.duration = compileScene(ir).duration;
    }
  }
}

export function formatComposeReport(report: ComposeReport): string {
  const lines: string[] = [];
  lines.push(
    `compose: ${report.applied.length} applied, ${report.orphans.length} orphaned, ${report.warnings.length} warnings`,
  );
  for (const a of report.applied) lines.push(`  ✓ [${a.layer}] ${a.address} (${a.action})`);
  for (const o of report.orphans) lines.push(`  ✗ [${o.layer}] ${o.address}: ${o.reason}`);
  for (const w of report.warnings) lines.push(`  ! ${w}`);
  return lines.join("\n");
}
