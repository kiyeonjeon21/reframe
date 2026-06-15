/**
 * Editor state: one draft OverlayDoc per scene. Every edit writes a key into
 * the draft (keyed merge — re-editing the same control can never duplicate),
 * then the scene is recomposed. Validation failures keep the last good
 * compiled scene so live typing never blanks the canvas.
 */

import {
  composeScene,
  compileScene,
  motionOp,
  motionOpLabel,
  SceneValidationError,
  type BehaviorIR,
  type CompiledScene,
  type ComposeReport,
  type MotionOpName,
  type MotionOpOpts,
  type NodeIR,
  type OverlayDoc,
  type PropValue,
  type SceneIR,
  type TimelineIR,
} from "@reframe/core";

export type ChangeKind = "value" | "structure";
type Listener = (kind: ChangeKind) => void;

interface AddedOp {
  name: MotionOpName;
  target: string;
  opts: MotionOpOpts;
}

export class EditorStore {
  base: SceneIR;
  draft: OverlayDoc;
  compiled: CompiledScene;
  report: ComposeReport | null = null;
  /** Set when the last recompose threw (overlay defect); compiled stays last-good. */
  composeError: string | null = null;
  selectedId: string | null = null;
  overlayName: string;
  /** Motion ops added in the editor, keyed by their beat label (the source of
   *  truth that regenerates draft.addTimeline + the ops' setup base props). */
  addedOps = new Map<string, AddedOp>();
  private opSetupKeys = new Set<string>();

  private listeners = new Set<Listener>();

  constructor(base: SceneIR) {
    this.base = base;
    this.overlayName = `${base.id}-edits`;
    this.draft = { reframeOverlay: 1 };
    this.compiled = compileScene(base);
    this.recompose("structure");
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get dirty(): boolean {
    const d = this.draft;
    return Boolean(
      Object.keys(d.nodes ?? {}).length ||
        Object.keys(d.states ?? {}).length ||
        Object.keys(d.timeline ?? {}).length ||
        d.behaviors?.set?.length ||
        d.scene,
    );
  }

  // --- setters (all keyed; re-edits overwrite) ---

  setNodeProp(id: string, prop: string, value: PropValue) {
    ((this.draft.nodes ??= {})[id] ??= {})[prop] = value;
    this.recompose("value");
  }

  unsetNodeProp(id: string, prop: string) {
    delete this.draft.nodes?.[id]?.[prop];
    this.prune();
    this.recompose("structure");
  }

  setStateProp(state: string, id: string, prop: string, value: PropValue) {
    (((this.draft.states ??= {})[state] ??= {})[id] ??= {})[prop] = value;
    this.recompose("value");
  }

  unsetStateProp(state: string, id: string, prop: string) {
    delete this.draft.states?.[state]?.[id]?.[prop];
    this.prune();
    this.recompose("structure");
  }

  setSceneProp(key: "background" | "duration" | "fps", value: string | number) {
    (this.draft.scene ??= {})[key] = value as never;
    this.recompose("value");
  }

  unsetSceneProp(key: "background" | "duration" | "fps") {
    delete this.draft.scene?.[key];
    this.prune();
    this.recompose("structure");
  }

  setTimelineParam(
    label: string,
    key: "duration" | "ease" | "stagger" | "at" | "gap" | "scale" | "order" | "curviness",
    value: number | string,
  ) {
    ((this.draft.timeline ??= {})[label] ??= {})[key] = value as never;
    this.recompose("value");
  }

  /** Labeled motionPath steps with their (possibly overlay-edited) waypoints —
   *  drives the preview's draggable handles and is exposed on window.__store. */
  motionPaths(): { label: string; points: [number, number][] }[] {
    const out: { label: string; points: [number, number][] }[] = [];
    const walk = (tl: TimelineIR) => {
      if (tl.kind === "motionPath" && tl.label) out.push({ label: tl.label, points: tl.points });
      if ("children" in tl) tl.children.forEach(walk);
    };
    if (this.compiled.ir.timeline) walk(this.compiled.ir.timeline);
    return out;
  }

  /** A dragged waypoint writes the whole points array as a timeline patch. */
  setMotionPathPoints(label: string, points: [number, number][]) {
    ((this.draft.timeline ??= {})[label] ??= {}).points = points;
    this.recompose("value");
  }

  /** A reshaped ease curve writes a cubic-bezier ease on a timeline step.
   *  (setTimelineParam only takes number|string, so eases need their own setter.) */
  setTimelineEase(label: string, bezier: [number, number, number, number]) {
    ((this.draft.timeline ??= {})[label] ??= {}).ease = { cubicBezier: bezier };
    this.recompose("value");
  }

  private findBaseNode(id: string): NodeIR | null {
    const walk = (nodes: NodeIR[]): NodeIR | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.type === "group") {
          const hit = walk(n.children);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(this.base.nodes);
  }

  /** Add a motion op to a node ("add motion ▸ <op>"). Captures the node's base
   *  transform so scale/position ops are correct; appended via addTimeline. */
  addMotionOp(name: MotionOpName, target: string, amount = 1) {
    const p = (this.findBaseNode(target)?.props ?? {}) as { scale?: number; x?: number; y?: number; rotation?: number };
    const opts: MotionOpOpts = { amount, base: { scale: p.scale ?? 1, x: p.x ?? 0, y: p.y ?? 0, rotation: p.rotation ?? 0 } };
    this.addedOps.set(motionOpLabel(name, target), { name, target, opts });
    this.regenerateOps();
  }

  setOpAmount(label: string, amount: number) {
    const op = this.addedOps.get(label);
    if (!op) return;
    op.opts = { ...op.opts, amount };
    this.regenerateOps();
  }

  removeMotionOp(label: string) {
    if (this.addedOps.delete(label)) this.regenerateOps();
  }

  /** Rebuild draft.addTimeline + the ops' setup base props from addedOps. */
  private regenerateOps() {
    for (const k of this.opSetupKeys) {
      const dot = k.lastIndexOf(".");
      const id = k.slice(0, dot);
      const prop = k.slice(dot + 1);
      if (this.draft.nodes?.[id]) delete this.draft.nodes[id]![prop];
    }
    this.opSetupKeys.clear();
    const frags: TimelineIR[] = [];
    for (const op of this.addedOps.values()) {
      const r = motionOp(op.name, op.target, op.opts);
      frags.push(r.timeline);
      for (const [id, props] of Object.entries(r.setup ?? {})) {
        for (const [prop, val] of Object.entries(props)) {
          ((this.draft.nodes ??= {})[id] ??= {})[prop] = val;
          this.opSetupKeys.add(`${id}.${prop}`);
        }
      }
    }
    if (frags.length > 0) this.draft.addTimeline = frags;
    else delete this.draft.addTimeline;
    this.recompose("structure");
  }

  unsetTimelineParam(
    label: string,
    key: "duration" | "ease" | "stagger" | "at" | "gap" | "scale" | "order" | "curviness",
  ) {
    delete this.draft.timeline?.[label]?.[key];
    this.prune();
    this.recompose("structure");
  }

  /** Clone the composed behavior, patch one param, upsert the whole thing. */
  setBehaviorParam(target: string, prop: string, param: string, value: number) {
    const current = this.compiled.ir.behaviors?.find(
      (b) => b.target === target && b.prop === prop,
    );
    if (!current) return;
    const patched = structuredClone(current) as BehaviorIR;
    (patched.behavior.params as Record<string, number>)[param] = value;
    const set = ((this.draft.behaviors ??= {}).set ??= []);
    const index = set.findIndex((b) => b.target === target && b.prop === prop);
    if (index >= 0) set[index] = patched;
    else set.push(patched);
    this.recompose("value");
  }

  unsetBehavior(target: string, prop: string) {
    const set = this.draft.behaviors?.set;
    if (set) {
      const index = set.findIndex((b) => b.target === target && b.prop === prop);
      if (index >= 0) set.splice(index, 1);
    }
    this.prune();
    this.recompose("structure");
  }

  select(id: string | null) {
    this.selectedId = id;
    this.notify("structure");
  }

  /** Replace the whole draft (import); orphans surface in the report. */
  importDraft(doc: OverlayDoc) {
    this.draft = doc;
    if (doc.name) this.overlayName = doc.name;
    this.recompose("structure");
  }

  resetDraft() {
    this.draft = { reframeOverlay: 1 };
    this.recompose("structure");
  }

  /** Pruned, named copy ready for download / the render CLI. */
  exportDraft(): OverlayDoc {
    this.prune();
    return {
      ...structuredClone(this.draft),
      name: this.overlayName,
      target: this.base.id,
    };
  }

  // --- edit lookups for the panel (badges, revert buttons) ---

  hasNodeEdit(id: string, prop: string): boolean {
    return this.draft.nodes?.[id]?.[prop] !== undefined;
  }
  hasStateEdit(state: string, id: string, prop: string): boolean {
    return this.draft.states?.[state]?.[id]?.[prop] !== undefined;
  }
  hasTimelineEdit(label: string, key: string): boolean {
    return (this.draft.timeline?.[label] as Record<string, unknown> | undefined)?.[key] !== undefined;
  }
  hasBehaviorEdit(target: string, prop: string): boolean {
    return Boolean(this.draft.behaviors?.set?.some((b) => b.target === target && b.prop === prop));
  }
  nodeEditCount(id: string): number {
    return (
      Object.keys(this.draft.nodes?.[id] ?? {}).length +
      Object.values(this.draft.states ?? {}).reduce(
        (sum, s) => sum + Object.keys(s[id] ?? {}).length,
        0,
      )
    );
  }

  private prune() {
    const d = this.draft;
    for (const [id, props] of Object.entries(d.nodes ?? {})) {
      if (Object.keys(props).length === 0) delete d.nodes![id];
    }
    if (d.nodes && Object.keys(d.nodes).length === 0) delete d.nodes;
    for (const [state, nodes] of Object.entries(d.states ?? {})) {
      for (const [id, props] of Object.entries(nodes)) {
        if (Object.keys(props).length === 0) delete nodes[id];
      }
      if (Object.keys(nodes).length === 0) delete d.states![state];
    }
    if (d.states && Object.keys(d.states).length === 0) delete d.states;
    for (const [label, patch] of Object.entries(d.timeline ?? {})) {
      if (Object.keys(patch).length === 0) delete d.timeline![label];
    }
    if (d.timeline && Object.keys(d.timeline).length === 0) delete d.timeline;
    if (d.behaviors?.set?.length === 0) delete d.behaviors.set;
    if (d.behaviors && !d.behaviors.set && !d.behaviors.remove) delete d.behaviors;
    if (d.scene && Object.keys(d.scene).length === 0) delete d.scene;
  }

  private recompose(kind: ChangeKind) {
    try {
      const { ir, report } = composeScene(this.base, this.draft);
      this.compiled = compileScene(ir);
      this.report = report;
      this.composeError = null;
    } catch (err) {
      // Keep last-good compiled; the user is mid-edit (e.g. typing a duration).
      this.composeError =
        err instanceof SceneValidationError ? err.message : String(err);
    }
    this.notify(kind);
  }

  private notify(kind: ChangeKind) {
    for (const fn of this.listeners) fn(kind);
  }
}
