/**
 * Inspector panel: scene knobs, node tree, per-prop rows with state-scope
 * expansion, labeled timeline steps, behaviors, compose report, overlay IO.
 * Plain DOM; rebuilt on "structure" changes, report-only refresh on "value".
 */

import {
  EASE_NAMES,
  MOTION_OPS,
  PROPS_BY_TYPE,
  isColor,
  composeScene,
  compileScene,
  evaluate,
  type CompiledScene,
  type MotionOpName,
  type NodeIR,
  type OverlayDoc,
  type PropValue,
  type SceneIR,
  type TimelineIR,
} from "@reframe/core";
import type { EditorStore } from "./store.js";

const NUMERIC_DEFAULTS: Record<string, number> = { opacity: 1, scale: 1, rotation: 0 };
const RANGES: Record<string, [number, number, number]> = {
  opacity: [0, 1, 0.01],
  progress: [0, 1, 0.01],
  scale: [0, 3, 0.01],
  rotation: [-360, 360, 1],
  curviness: [0, 2, 0.05],
  amount: [0, 3, 0.1],
};
const ANCHORS = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function findNode(nodes: NodeIR[], id: string): NodeIR | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === "group") {
      const hit = findNode(node.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

type Bz = [number, number, number, number];
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const cubic = (t: number, a: number, b: number, c: number, d: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

/** A draggable cubic-bezier ease editor (GSAP CustomEase pattern). Dragging a
 *  control point writes {cubicBezier:[x1,y1,x2,y2]} via store.setTimelineEase. */
function buildEaseEditor(label: string, current: unknown, store: EditorStore): HTMLCanvasElement {
  const S = 150;
  const PAD = 22;
  const Y0 = -0.45;
  const Y1 = 1.45;
  const SPAN = Y1 - Y0;
  const bz: Bz =
    current && typeof current === "object" && "cubicBezier" in current
      ? ([...(current as { cubicBezier: number[] }).cubicBezier] as Bz)
      : [0.33, 0, 0.67, 1];
  const c = el("canvas", { style: "background:#0e0f15;border-radius:8px;cursor:grab;touch-action:none;display:block" });
  c.width = S;
  c.height = S;
  const cx = c.getContext("2d")!;
  const toPx = (ex: number, ey: number): [number, number] => [
    PAD + ex * (S - 2 * PAD),
    S - PAD - ((ey - Y0) / SPAN) * (S - 2 * PAD),
  ];
  const toEase = (px: number, py: number): [number, number] => [
    (px - PAD) / (S - 2 * PAD),
    Y0 + ((S - PAD - py) / (S - 2 * PAD)) * SPAN,
  ];
  function render() {
    cx.clearRect(0, 0, S, S);
    const [gx0, gy0] = toPx(0, 0);
    const [gx1, gy1] = toPx(1, 1);
    cx.strokeStyle = "#23252f";
    cx.lineWidth = 1;
    cx.strokeRect(Math.min(gx0, gx1), Math.min(gy0, gy1), Math.abs(gx1 - gx0), Math.abs(gy1 - gy0));
    const P1 = toPx(bz[0], bz[1]);
    const P2 = toPx(bz[2], bz[3]);
    cx.strokeStyle = "#3a3f55";
    cx.beginPath();
    cx.moveTo(gx0, gy0);
    cx.lineTo(P1[0], P1[1]);
    cx.moveTo(gx1, gy1);
    cx.lineTo(P2[0], P2[1]);
    cx.stroke();
    cx.strokeStyle = "#7d9aff";
    cx.lineWidth = 2;
    cx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const [px, py] = toPx(cubic(t, 0, bz[0], bz[2], 1), cubic(t, 0, bz[1], bz[3], 1));
      if (i) cx.lineTo(px, py);
      else cx.moveTo(px, py);
    }
    cx.stroke();
    for (const [hx, hy] of [P1, P2]) {
      cx.beginPath();
      cx.arc(hx, hy, 5, 0, Math.PI * 2);
      cx.fillStyle = "#fff";
      cx.fill();
      cx.strokeStyle = "#7d9aff";
      cx.lineWidth = 2;
      cx.stroke();
    }
  }
  let dragIdx = -1;
  const localPos = (ev: PointerEvent): [number, number] => {
    const r = c.getBoundingClientRect();
    return [((ev.clientX - r.left) * S) / r.width, ((ev.clientY - r.top) * S) / r.height];
  };
  c.addEventListener("pointerdown", (ev) => {
    const [mx, my] = localPos(ev);
    const P1 = toPx(bz[0], bz[1]);
    const P2 = toPx(bz[2], bz[3]);
    dragIdx = Math.hypot(P1[0] - mx, P1[1] - my) <= 11 ? 0 : Math.hypot(P2[0] - mx, P2[1] - my) <= 11 ? 1 : -1;
    if (dragIdx >= 0) c.setPointerCapture(ev.pointerId);
  });
  c.addEventListener("pointermove", (ev) => {
    if (dragIdx < 0) return;
    let [ex, ey] = toEase(...localPos(ev));
    ex = Math.max(0, Math.min(1, ex));
    ey = Math.max(Y0, Math.min(Y1, ey));
    if (dragIdx === 0) {
      bz[0] = ex;
      bz[1] = ey;
    } else {
      bz[2] = ex;
      bz[3] = ey;
    }
    render();
    store.setTimelineEase(label, [round3(bz[0]), round3(bz[1]), round3(bz[2]), round3(bz[3])]);
  });
  c.addEventListener("pointerup", () => {
    dragIdx = -1;
  });
  render();
  return c;
}

/** Value editor for one PropValue; numbers get ranges where it makes sense. */
function makeControl(
  prop: string,
  value: PropValue | undefined,
  edited: boolean,
  onChange: (v: PropValue) => void,
  onRevert: () => void,
): HTMLElement {
  let input: HTMLElement;
  if (prop === "anchor") {
    const select = el("select");
    for (const a of ANCHORS) select.append(el("option", { value: a }, a));
    select.value = String(value ?? "top-left");
    select.addEventListener("change", () => onChange(select.value));
    input = select;
  } else if (typeof value === "number" || (value === undefined && prop in NUMERIC_DEFAULTS)) {
    const v = typeof value === "number" ? value : NUMERIC_DEFAULTS[prop]!;
    const range = RANGES[prop];
    const number = el("input", { type: range ? "range" : "number", value: String(v) }) as HTMLInputElement;
    if (range) {
      number.min = String(range[0]);
      number.max = String(range[1]);
      number.step = String(range[2]);
    } else {
      number.step = "1";
    }
    number.addEventListener("input", () => {
      const parsed = Number(number.value);
      if (!Number.isNaN(parsed)) onChange(parsed);
    });
    input = number;
  } else if (typeof value === "string" && isColor(value)) {
    const color = el("input", { type: "color", value: value.slice(0, 7) }) as HTMLInputElement;
    color.addEventListener("input", () => onChange(color.value));
    input = color;
  } else {
    const text = el("input", { type: "text", value: String(value ?? "") }) as HTMLInputElement;
    text.addEventListener("change", () => onChange(text.value));
    input = text;
  }
  const revert = el("button", { class: "revert", title: "revert" }, "×");
  revert.addEventListener("click", onRevert);
  const row = el("div", { class: `prop-row${edited ? " edited" : ""}` }, input);
  if (edited) row.append(revert);
  return row;
}

// --- variation grid: seeded perturbations of the editable motion ---
function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function firstMotionPathTarget(tl: TimelineIR | undefined): string | null {
  let found: string | null = null;
  const walk = (s: TimelineIR) => {
    if (found) return;
    if (s.kind === "motionPath") found = s.target;
    if ("children" in s) s.children.forEach(walk);
  };
  if (tl) walk(tl);
  return found;
}

/** A seeded variation of the current motion (curviness + interior waypoints +
 *  ease curves jittered) as an overlay, built on top of the current draft. */
function makeVariant(draft: OverlayDoc, compiled: CompiledScene, seed: number): OverlayDoc {
  const rng = mulberry32(Math.imul(seed, 2654435761));
  const v: OverlayDoc = structuredClone(draft);
  const tl = (v.timeline ??= {});
  const walk = (s: TimelineIR) => {
    if (s.kind === "motionPath" && s.label) {
      const cur = tl[s.label] ?? {};
      const baseCurv = (cur.curviness ?? s.curviness ?? 1) as number;
      const basePts = (cur.points ?? s.points) as [number, number][];
      tl[s.label] = {
        ...cur,
        curviness: clampN(baseCurv + (rng() - 0.5) * 1.3, 0, 2),
        points: basePts.map((p, i, arr) =>
          i === 0 || i === arr.length - 1
            ? p
            : [Math.round(p[0] + (rng() - 0.5) * 130), Math.round(p[1] + (rng() - 0.5) * 130)],
        ),
      };
    } else if ((s.kind === "to" || s.kind === "tween") && s.label) {
      const cur = tl[s.label] ?? {};
      const curEase = cur.ease ?? ("ease" in s ? s.ease : undefined);
      const bz = (
        curEase && typeof curEase === "object" && "cubicBezier" in curEase
          ? [...curEase.cubicBezier]
          : [0.33, 0, 0.67, 1]
      ) as number[];
      tl[s.label] = {
        ...cur,
        ease: {
          cubicBezier: [
            clampN(bz[0]! + (rng() - 0.5) * 0.4, 0, 1),
            clampN(bz[1]! + (rng() - 0.5) * 1.2, -0.4, 1.5),
            clampN(bz[2]! + (rng() - 0.5) * 0.4, 0, 1),
            clampN(bz[3]! + (rng() - 0.5) * 1.2, -0.4, 1.5),
          ],
        },
      };
    }
    if ("children" in s) s.children.forEach(walk);
  };
  if (compiled.ir.timeline) walk(compiled.ir.timeline);
  return v;
}

/** Draw the target node's trail (position over time) into a thumbnail canvas. */
function renderThumb(c: HTMLCanvasElement, base: SceneIR, variant: OverlayDoc, target: string) {
  const cx = c.getContext("2d")!;
  cx.fillStyle = "#0e0f15";
  cx.fillRect(0, 0, c.width, c.height);
  let compiled: CompiledScene;
  try {
    compiled = compileScene(composeScene(base, variant).ir);
  } catch {
    return;
  }
  const D = compiled.duration;
  const W = compiled.ir.size.width;
  const H = compiled.ir.size.height;
  const sc = Math.min(c.width / W, c.height / H) * 0.9;
  const ox = (c.width - W * sc) / 2;
  const oy = (c.height - H * sc) / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 28; i++) {
    const op = evaluate(compiled, (i / 28) * D).find((o) => o.id === target);
    if (op) pts.push([ox + op.transform[4] * sc, oy + op.transform[5] * sc]);
  }
  if (pts.length < 2) return;
  cx.strokeStyle = "#7d9aff";
  cx.lineWidth = 1.5;
  cx.beginPath();
  pts.forEach((p, i) => (i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])));
  cx.stroke();
  for (const p of pts) {
    cx.beginPath();
    cx.arc(p[0], p[1], 1.4, 0, Math.PI * 2);
    cx.fillStyle = "#9db4ff";
    cx.fill();
  }
}

/** "vary ×4" → seeded motion variations as adoptable trail thumbnails
 *  (recognition over recall). Click one to adopt; click vary again to branch. */
function renderVariations(root: HTMLElement, store: EditorStore) {
  const target = firstMotionPathTarget(store.compiled.ir.timeline);
  if (!target) return; // a trail needs a motionPath to preview
  root.append(el("h3", {}, "Variations"));
  const grid = el("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin:4px 0" });
  let round = 0;
  const btn = el("button", { title: "generate motion variations" }, "vary ×4");
  btn.addEventListener("click", () => {
    grid.replaceChildren();
    for (let k = 1; k <= 4; k++) {
      const variant = makeVariant(store.draft, store.compiled, k + round * 4 + 1);
      const c = el("canvas", { title: "click to adopt this motion", style: "border-radius:6px;cursor:pointer;border:1px solid #333" });
      c.width = 150;
      c.height = 92;
      renderThumb(c, store.base, variant, target);
      c.addEventListener("click", () => store.importDraft(variant));
      grid.append(c);
    }
    round++;
  });
  root.append(btn, grid);
}

/** "Add motion ▸ <op>" on the selected node + a list of added ops (amount + remove). */
function renderMotionOps(root: HTMLElement, store: EditorStore) {
  if (store.selectedId) {
    root.append(el("h3", {}, "Add motion"));
    const sel = el("select");
    for (const op of MOTION_OPS) sel.append(el("option", { value: op }, op));
    const add = el("button", { title: "add this motion to the selected node" }, "+ add");
    add.addEventListener("click", () => store.addMotionOp(sel.value as MotionOpName, store.selectedId!));
    root.append(el("div", { class: "prop-row" }, el("label", {}, `▸ ${store.selectedId}`), sel, add));
  }
  if (store.addedOps.size > 0) {
    root.append(el("h3", {}, "Added motion"));
    for (const [label, op] of store.addedOps) {
      const head = el("div", {}, `${op.name} `, el("span", { class: "kind" }, `→ ${op.target}`));
      const rm = el("button", { class: "revert", title: "remove" }, "✕");
      rm.addEventListener("click", () => store.removeMotionOp(label));
      head.append(rm);
      const card = el("div", { class: "step-card" }, head);
      const amtRow = makeControl(
        "amount",
        op.opts.amount ?? 1,
        false,
        (v) => store.setOpAmount(label, Number(v)),
        () => undefined,
      );
      amtRow.prepend(el("label", {}, "amount"));
      card.append(amtRow);
      root.append(card);
    }
  }
}

/** "Add node ▸ text / rect / ellipse" — appends an overlay-owned node at centre. */
function renderAddNode(root: HTMLElement, store: EditorStore) {
  root.append(el("h3", {}, "Add node"));
  const row = el("div", { class: "prop-row" }, el("label", {}, "▸ new"));
  for (const type of ["text", "rect", "ellipse"] as const) {
    const b = el("button", { title: `add a ${type} at scene centre` }, type);
    b.addEventListener("click", () => store.addNode(type));
    row.append(b);
  }
  root.append(row);
}

export function buildPanel(store: EditorStore, root: HTMLElement) {
  let reportBox: HTMLElement | null = null;

  function rebuild() {
    root.replaceChildren();
    const ir = store.compiled.ir;

    // --- scene ---
    root.append(el("h3", {}, "Scene"));
    const bg = makeControl(
      "background",
      ir.background ?? "#000000",
      store.draft.scene?.background !== undefined,
      (v) => store.setSceneProp("background", v),
      () => store.unsetSceneProp("background"),
    );
    bg.prepend(el("label", {}, "background"));
    root.append(bg);
    const dur = makeControl(
      "duration",
      ir.duration ?? 0,
      store.draft.scene?.duration !== undefined,
      (v) => store.setSceneProp("duration", Number(v)),
      () => store.unsetSceneProp("duration"),
    );
    dur.prepend(el("label", {}, "duration (s)"));
    root.append(dur);

    // --- variations + add-node + add-motion (motion ops) ---
    renderVariations(root, store);
    renderAddNode(root, store);
    renderMotionOps(root, store);

    // --- node tree ---
    root.append(el("h3", {}, "Nodes"));
    const renderTree = (nodes: NodeIR[], depth: number) => {
      for (const node of nodes) {
        const edits = store.nodeEditCount(node.id);
        const item = el(
          "div",
          { class: `tree-item${store.selectedId === node.id ? " selected" : ""}` },
          el("span", { style: `padding-left:${depth * 14}px` }, `${node.id} `),
          el("span", { class: "badge" }, edits > 0 ? `●${edits}` : ""),
        );
        item.addEventListener("click", () => store.select(node.id));
        root.append(item);
        if (node.type === "group") renderTree(node.children, depth + 1);
      }
    };
    renderTree(ir.nodes, 0);

    // --- selected node props with scope expansion ---
    if (store.selectedId) {
      const node = findNode(ir.nodes, store.selectedId);
      if (node) {
        const id = node.id;
        root.append(el("h3", {}, `Props: ${id} (${node.type})`));
        const added = store.isAddedNode(id);
        const actions = el("div", { class: "prop-row" });
        const dup = el("button", { title: "duplicate this node" }, "duplicate");
        dup.addEventListener("click", () => store.duplicateNode(id));
        actions.append(dup);
        if (added) {
          const del = el("button", { title: "remove this overlay-added node" }, "delete");
          del.addEventListener("click", () => store.removeNode(id));
          actions.append(del);
        } else {
          const hide = el("button", { title: "base node — hide it (opacity 0) instead of deleting" }, "hide");
          hide.addEventListener("click", () => store.hideNode(id));
          actions.append(hide);
        }
        root.append(actions);
        const props = node.props as unknown as Record<string, PropValue | undefined>;
        const states = ir.states ?? {};
        const initial = ir.initial;

        for (const prop of PROPS_BY_TYPE[node.type]) {
          const baseValue = props[prop] ?? (prop in NUMERIC_DEFAULTS ? NUMERIC_DEFAULTS[prop] : undefined);
          if (baseValue === undefined && !(prop in NUMERIC_DEFAULTS)) continue; // unset optional prop
          const touchingStates = Object.keys(states).filter(
            (s) => states[s]?.[id]?.[prop] !== undefined,
          );
          const deadBase = initial !== undefined && touchingStates.includes(initial);

          const baseRow = makeControl(
            prop,
            baseValue,
            store.hasNodeEdit(id, prop),
            (v) => store.setNodeProp(id, prop, v),
            () => store.unsetNodeProp(id, prop),
          );
          baseRow.prepend(
            el("label", {}, touchingStates.length > 0 ? `${prop} (base)` : prop),
          );
          if (deadBase) {
            baseRow.classList.add("dead");
            baseRow.querySelectorAll("input,select").forEach((i) => i.setAttribute("disabled", ""));
          }
          root.append(baseRow);
          if (deadBase) {
            root.append(el("div", { class: "hint" }, `overridden by initial "${initial}" — edit the state rows below`));
          }

          for (const s of touchingStates) {
            const row = makeControl(
              prop,
              states[s]![id]![prop],
              store.hasStateEdit(s, id, prop),
              (v) => store.setStateProp(s, id, prop, v),
              () => store.unsetStateProp(s, id, prop),
            );
            const label = el("label", {}, `${prop} `);
            label.append(el("span", { class: "scope" }, `@${s}`));
            row.prepend(label);
            root.append(row);
          }
        }
      }
    }

    // --- beats (semantic groups) ---
    const beats: Extract<TimelineIR, { kind: "beat" }>[] = [];
    const beatOf = new Map<string, string>();
    const walkBeats = (tl: TimelineIR, owner?: string) => {
      if (tl.kind === "beat") {
        beats.push(tl);
        tl.children.forEach((c) => walkBeats(c, tl.name));
        return;
      }
      if ("label" in tl && tl.label !== undefined && owner) beatOf.set(tl.label, owner);
      if ("children" in tl) tl.children.forEach((c) => walkBeats(c, owner));
    };
    if (ir.timeline) walkBeats(ir.timeline);
    if (beats.length > 0) {
      root.append(el("h3", {}, "Beats"));
      for (const b of beats) {
        const card = el("div", { class: "step-card beat-card" },
          el("div", {}, `${b.name} `, el("span", { class: "kind" }, "(beat)")),
        );
        const gapRow = makeControl("gap", b.gap ?? 0, store.hasTimelineEdit(b.name, "gap"),
          (v) => store.setTimelineParam(b.name, "gap", Number(v)),
          () => store.unsetTimelineParam(b.name, "gap"));
        gapRow.prepend(el("label", {}, "gap"));
        card.append(gapRow);
        const scaleRow = makeControl("scale", b.scale ?? 1, store.hasTimelineEdit(b.name, "scale"),
          (v) => store.setTimelineParam(b.name, "scale", Number(v)),
          () => store.unsetTimelineParam(b.name, "scale"));
        scaleRow.prepend(el("label", {}, "scale"));
        card.append(scaleRow);

        // the intent graph: nodes this beat OWNS (track group) + its member
        // labels (the motion-graph lanes under it) as markers.
        if ((b.nodes ?? []).length > 0) {
          const group = el("div", { class: "beat-group" });
          for (const id of b.nodes!) {
            const known = findNode(ir.nodes, id) !== null;
            const lane = el("div", { class: `beat-lane${known ? "" : " missing"}${store.selectedId === id ? " selected" : ""}` }, `◢ ${id}`);
            if (known) lane.addEventListener("click", () => store.select(id));
            group.append(lane);
          }
          card.append(group);
        }
        const memberLabels: string[] = [];
        const collectLabels = (tl: TimelineIR) => {
          if ("label" in tl && tl.label !== undefined) memberLabels.push(tl.label);
          if ("children" in tl) tl.children.forEach(collectLabels);
        };
        b.children.forEach(collectLabels);
        if (memberLabels.length > 0) {
          card.append(el("div", { class: "beat-markers" }, memberLabels.map((l) => `▸${l}`).join("  ")));
        }
        root.append(card);
      }
    }

    // --- labeled timeline steps ---
    const steps: Extract<TimelineIR, { label?: string }>[] = [];
    const walkTl = (tl: TimelineIR) => {
      if ("label" in tl && tl.label !== undefined) steps.push(tl);
      if ("children" in tl) tl.children.forEach(walkTl);
    };
    if (ir.timeline) walkTl(ir.timeline);
    if (steps.length > 0) {
      root.append(el("h3", {}, "Timeline"));
      for (const step of steps) {
        const label = step.label!;
        const beatName = beatOf.get(label);
        const head = el("div", {}, `${label} `, el("span", { class: "kind" }, `(${step.kind})`));
        if (beatName) head.append(el("span", { class: "badge" }, ` ↳ ${beatName}`));
        const card = el("div", { class: "step-card" }, head);
        const durRow = makeControl(
          "duration",
          "duration" in step ? (step.duration ?? 0.5) : 0.5,
          store.hasTimelineEdit(label, "duration"),
          (v) => store.setTimelineParam(label, "duration", Number(v)),
          () => store.unsetTimelineParam(label, "duration"),
        );
        durRow.prepend(el("label", {}, "duration"));
        card.append(durRow);
        if (step.kind === "motionPath") {
          const cvRow = makeControl(
            "curviness",
            step.curviness ?? 1,
            store.hasTimelineEdit(label, "curviness"),
            (v) => store.setTimelineParam(label, "curviness", Number(v)),
            () => store.unsetTimelineParam(label, "curviness"),
          );
          cvRow.prepend(el("label", {}, "curviness"));
          card.append(cvRow);
        }
        if (step.kind === "to" || step.kind === "tween") {
          const easeSelect = el("select");
          const current = "ease" in step ? step.ease : undefined;
          for (const name of EASE_NAMES) easeSelect.append(el("option", { value: name }, name));
          if (typeof current === "object") easeSelect.append(el("option", { value: "__custom" }, "custom bezier"));
          easeSelect.value = typeof current === "string" ? current : typeof current === "object" ? "__custom" : "linear";
          easeSelect.addEventListener("change", () => {
            if (easeSelect.value !== "__custom") store.setTimelineParam(label, "ease", easeSelect.value);
          });
          // ✎ toggles an inline draggable cubic-bezier curve editor for this step
          const curveBtn = el("button", { class: "mini", title: "edit ease curve" }, "✎");
          const editorBox = el("div", { style: "display:none;margin-top:6px" });
          curveBtn.addEventListener("click", () => {
            if (editorBox.style.display === "none") {
              editorBox.replaceChildren(buildEaseEditor(label, "ease" in step ? step.ease : undefined, store));
              editorBox.style.display = "block";
            } else {
              editorBox.replaceChildren();
              editorBox.style.display = "none";
            }
          });
          const easeRow = el("div", { class: `prop-row${store.hasTimelineEdit(label, "ease") ? " edited" : ""}` }, el("label", {}, "ease"), easeSelect, curveBtn);
          card.append(easeRow, editorBox);
        }
        if (step.kind === "to") {
          const stRow = makeControl(
            "stagger",
            step.stagger ?? 0,
            store.hasTimelineEdit(label, "stagger"),
            (v) => store.setTimelineParam(label, "stagger", Number(v)),
            () => store.unsetTimelineParam(label, "stagger"),
          );
          stRow.prepend(el("label", {}, "stagger"));
          card.append(stRow);
        }
        root.append(card);
      }
    }

    // --- behaviors ---
    if ((ir.behaviors ?? []).length > 0) {
      root.append(el("h3", {}, "Behaviors"));
      for (const b of ir.behaviors!) {
        const card = el("div", { class: "behavior-card" },
          el("div", {}, `${b.target}.${b.prop} `, el("span", { class: "kind" }, b.behavior.name)),
        );
        for (const [param, value] of Object.entries(b.behavior.params)) {
          const row = makeControl(
            param,
            value,
            store.hasBehaviorEdit(b.target, b.prop),
            (v) => store.setBehaviorParam(b.target, b.prop, param, Number(v)),
            () => store.unsetBehavior(b.target, b.prop),
          );
          row.prepend(el("label", {}, param));
          card.append(row);
        }
        root.append(card);
      }
    }

    // --- report ---
    root.append(el("h3", {}, "Compose"));
    reportBox = el("div", { id: "report" });
    root.append(reportBox);
    refreshReport();

    // --- io ---
    root.append(el("h3", {}, "Overlay"));
    const name = el("input", { type: "text", id: "overlay-name", value: store.overlayName }) as HTMLInputElement;
    name.addEventListener("change", () => (store.overlayName = name.value));
    const download = el("button", {}, "download");
    download.addEventListener("click", () => {
      const json = JSON.stringify(store.exportDraft(), null, 2);
      const a = el("a", {
        href: URL.createObjectURL(new Blob([json], { type: "application/json" })),
        download: `${store.overlayName}.json`,
      });
      a.click();
    });
    const copy = el("button", {}, "copy");
    copy.addEventListener("click", () => {
      void navigator.clipboard.writeText(JSON.stringify(store.exportDraft(), null, 2));
      copy.textContent = "copied!";
      setTimeout(() => (copy.textContent = "copy"), 1200);
    });
    const load = el("button", {}, "load…");
    const file = el("input", { type: "file", accept: ".json", style: "display:none" }) as HTMLInputElement;
    load.addEventListener("click", () => file.click());
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const doc = JSON.parse(await f.text()) as OverlayDoc;
        if (doc.reframeOverlay !== 1) throw new Error("not a reframe overlay (reframeOverlay: 1 missing)");
        store.importDraft(doc);
      } catch (err) {
        alert(`could not load overlay: ${err instanceof Error ? err.message : err}`);
      }
      file.value = "";
    });
    const reset = el("button", {}, "reset");
    reset.addEventListener("click", () => {
      if (!store.dirty || confirm("Discard all edits?")) store.resetDraft();
    });
    root.append(name, el("div", { id: "io" }, download, copy, load, file, reset));
  }

  function refreshReport() {
    if (!reportBox) return;
    reportBox.replaceChildren();
    if (store.composeError) {
      reportBox.append(el("div", { class: "error" }, store.composeError));
    }
    const report = store.report;
    if (!report) return;
    reportBox.append(
      el("div", {}, `${report.applied.length} applied, ${report.orphans.length} orphaned, ${report.warnings.length} warnings`),
    );
    for (const o of report.orphans) {
      reportBox.append(el("div", { class: "orphan" }, `✗ ${o.address}: ${o.reason}`));
    }
    for (const w of report.warnings) {
      reportBox.append(el("div", { class: "warning" }, `! ${w}`));
    }
    if (report.applied.length > 0) {
      const details = el("details", {}, el("summary", {}, "applied"));
      for (const a of report.applied) details.append(el("div", {}, `✓ ${a.address}`));
      reportBox.append(details);
    }
  }

  return { rebuild, refreshReport };
}
