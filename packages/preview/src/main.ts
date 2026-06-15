/**
 * Preview + editor shell: scene picker, scrub/play, canvas, selection
 * highlight. Edits live in EditorStore as an OverlayDoc draft; everything
 * here only reads store.compiled. rAF lives ONLY in this file — the export
 * path never uses wall-clock time.
 */

import { collectImageSrcs, evaluate, nodeParentMatrix, type DisplayOp, type NodeIR, type SceneIR } from "@reframe/core";
import { renderFrame, drawDisplayList } from "@reframe/renderer-canvas";
import { userScenes } from "virtual:reframe-user-scenes";
import { buildPanel } from "./panel.js";
import { EditorStore } from "./store.js";

interface SceneEntry {
  label: string;
  /** Absolute directory of the scene file — relative image srcs resolve here. */
  dir: string;
  load: () => Promise<{ default: SceneIR }>;
}

const exampleModules = import.meta.glob<{ default: SceneIR }>("../../../examples/scenes/*.ts");
const modules: Record<string, SceneEntry> = {};
for (const path of Object.keys(exampleModules).sort()) {
  modules[path] = {
    label: path.split("/").pop()!.replace(".ts", ""),
    dir: __REFRAME_EXAMPLES_DIR__,
    load: exampleModules[path]!,
  };
}
// scenes from the directory `reframe preview` was invoked in
for (const { name, dir, load } of userScenes) {
  modules[`user:${name}`] ??= { label: `${name} (cwd)`, dir, load };
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const select = document.getElementById("scene-select") as HTMLSelectElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const scrub = document.getElementById("scrub") as HTMLInputElement;
const timeLabel = document.getElementById("time") as HTMLSpanElement;
const panelRoot = document.getElementById("panel") as HTMLDivElement;
const loopBtn = document.getElementById("loop") as HTMLButtonElement;
const markInBtn = document.getElementById("mark-in") as HTMLButtonElement;
const markOutBtn = document.getElementById("mark-out") as HTMLButtonElement;
const speedSel = document.getElementById("speed") as HTMLSelectElement;
const loopBand = document.getElementById("loop-band") as HTMLDivElement;

let store: EditorStore | null = null;
let panel: ReturnType<typeof buildPanel> | null = null;
let t = 0;
let playing = false;
let lastTick = 0;
let speed = 1;
let loopOn = false;
let tIn = 0;
let tOut = Infinity;

for (const [key, entry] of Object.entries(modules)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = entry.label;
  select.appendChild(option);
}

// decoded images keyed by raw src; missing entries render as a placeholder
const images = new Map<string, CanvasImageSource>();
const imageLoads = new Map<string, Promise<void>>();
let sceneDir = "";

/** Load any not-yet-loaded srcs of the current scene via /@fs. */
function ensureImages(): Promise<void> {
  if (!store) return Promise.resolve();
  const pending: Promise<void>[] = [];
  for (const src of collectImageSrcs(store.compiled.ir)) {
    if (images.has(src) || imageLoads.has(src)) continue;
    const url = `/@fs${src.startsWith("/") ? src : `${sceneDir}/${src}`}`;
    const load = new Promise<void>((done) => {
      const img = new Image();
      img.onload = () => {
        images.set(src, img);
        done();
        draw();
      };
      img.onerror = () => {
        console.warn(`image "${src}" failed to load (${url}) — rendering placeholder`);
        done();
      };
      img.src = url;
    });
    imageLoads.set(src, load);
    pending.push(load);
  }
  return Promise.all(pending).then(() => undefined);
}

async function loadScene(path: string) {
  const mod = await modules[path]!.load();
  store = new EditorStore(mod.default);
  sceneDir = modules[path]!.dir;
  images.clear();
  imageLoads.clear();
  (window as unknown as { __store: EditorStore }).__store = store; // debug/testing hook
  panel = buildPanel(store, panelRoot);
  canvas.width = store.compiled.ir.size.width;
  canvas.height = store.compiled.ir.size.height;
  store.subscribe((kind) => {
    t = Math.min(t, store!.compiled.duration);
    if (kind === "structure") panel!.rebuild();
    else panel!.refreshReport();
    void ensureImages(); // an edited src loads lazily, then redraws
    draw();
  });
  await document.fonts.ready;
  await ensureImages();
  t = 0;
  panel.rebuild();
  draw();
  syncUrl();
  tIn = 0;
  tOut = store.compiled.duration;
  updateLoopBand();
  (window as unknown as { __reframeReady: boolean }).__reframeReady = true;
}

function applyMat(m: number[], x: number, y: number): [number, number] {
  return [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
}

function opCorners(op: DisplayOp): [number, number][] {
  switch (op.type) {
    case "rect":
    case "ellipse":
    case "image": {
      const { offsetX: x, offsetY: y, width: w, height: h } = op;
      return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) =>
        applyMat(op.transform, px!, py!),
      );
    }
    case "line":
      return [applyMat(op.transform, op.x1, op.y1), applyMat(op.transform, op.x2, op.y2)];
    case "text": {
      ctx.font = `${op.fontWeight} ${op.fontSize}px ${op.fontFamily}`;
      const w = ctx.measureText(op.content).width;
      const h = op.fontSize * 1.2;
      const x0 = op.align === "right" ? -w : op.align === "center" ? -w / 2 : 0;
      const y0 = op.baseline === "bottom" ? -h : op.baseline === "middle" ? -h / 2 : 0;
      return [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]].map(([px, py]) =>
        applyMat(op.transform, px!, py!),
      );
    }
    case "path":
      // No cheap bbox for an arbitrary `d`; mark the origin for selection.
      return [applyMat(op.transform, 0, 0)];
  }
}

function centroid(corners: [number, number][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of corners) {
    sx += x;
    sy += y;
  }
  return [sx / corners.length, sy / corners.length];
}

/** Onion-skin the SELECTED node across time: faint ghosts of its shape + a
 *  trail line + dots at uniform time samples (so the spacing reveals the ease —
 *  closer dots = slower). Makes the motion visible while editing one frame. */
function drawMotionPreview() {
  if (!store || !store.selectedId) return;
  const id = store.selectedId;
  const D = store.compiled.duration;
  if (!(D > 0)) return;
  const N = 22;
  const pts: ([number, number] | null)[] = [];
  for (let i = 0; i <= N; i++) {
    const op = evaluate(store.compiled, (i / N) * D).find((o) => o.id === id);
    pts.push(op ? centroid(opCorners(op)) : null);
  }
  const real = pts.filter((p): p is [number, number] => !!p);
  if (real.length < 2) return;
  const xs = real.map((p) => p[0]);
  const ys = real.map((p) => p[1]);
  const spread = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (spread < 8) return; // a static node has no motion to preview

  // faint ghosts of the node's shape at a few sampled times
  for (let i = 0; i <= N; i += 4) {
    const ops = evaluate(store.compiled, (i / N) * D)
      .filter((o) => o.id === id)
      .map((o) => ({ ...o, opacity: o.opacity * 0.12 }));
    if (ops.length) drawDisplayList(ctx, ops, images);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = "rgba(125,154,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  for (const p of pts) {
    if (!p) continue;
    if (!started) {
      ctx.moveTo(p[0], p[1]);
      started = true;
    } else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  for (const p of real) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#9db4ff";
    ctx.fill();
  }
  const curOp = evaluate(store.compiled, t).find((o) => o.id === id);
  if (curOp) {
    const [cx, cy] = centroid(opCorners(curOp));
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  if (!store) return;
  renderFrame(ctx, store.compiled, t, images);
  drawMotionPreview();

  if (store.selectedId) {
    const selNode = findNodeById(store.compiled.ir.nodes, store.selectedId);
    const allOps = evaluate(store.compiled, t);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = "#7d9aff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if (selNode && selNode.type === "group") {
      // a group has no op of its own — box the union of its descendant ops
      const ids = new Set(descendantLeafIds(selNode));
      const pts = allOps.filter((op) => ids.has(op.id)).flatMap(opCorners);
      if (pts.length > 0) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        ctx.strokeRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
      }
    } else {
      for (const op of allOps.filter((op) => op.id === store!.selectedId)) {
        const corners = opCorners(op);
        ctx.beginPath();
        corners.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        if (corners.length > 2) ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // motionPath waypoint handles — drag to reshape the curve (writes a
  // timeline.<label>.points overlay patch that survives base regeneration).
  // Points are in the target's parent space; correct for top-level targets.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const mp of store.motionPaths()) {
    ctx.strokeStyle = "rgba(125,154,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    mp.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [x, y] of mp.points) {
      ctx.beginPath();
      ctx.arc(x, y, HANDLE_R, 0, Math.PI * 2);
      ctx.fillStyle = "#7d9aff";
      ctx.fill();
      ctx.strokeStyle = "#0b0b12";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();

  const duration = store.compiled.duration;
  scrub.value = String(duration ? t / duration : 0);
  timeLabel.textContent = `${t.toFixed(3)} / ${duration.toFixed(3)}`;
}

const HANDLE_R = 9;

/** Map a mouse event to scene coordinates (canvas is rendered at scene size, displayed scaled). */
function clientToScene(ev: MouseEvent): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((ev.clientX - r.left) * canvas.width) / r.width, ((ev.clientY - r.top) * canvas.height) / r.height];
}

/** Is (x,y) inside the op's outline? Polygon for shaped nodes, radius for a path origin. */
function hitOp(op: DisplayOp, x: number, y: number): boolean {
  const c = opCorners(op);
  if (c.length >= 3) {
    let inside = false;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const [xi, yi] = c[i]!;
      const [xj, yj] = c[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return c.some(([px, py]) => Math.hypot(px - x, py - y) <= 16);
}

type DragState =
  | { kind: "waypoint"; label: string; index: number; points: [number, number][] }
  // `inv` is the inverse of the node's parent-matrix linear part, mapping a
  // scene-space drag delta into the node's parent space (identity for a
  // top-level node, so the delta is 1:1; non-trivial for nested children).
  | { kind: "node"; id: string; startX: number; startY: number; px: number; py: number; inv: [number, number, number, number] };
let drag: DragState | null = null;

function findNodeById(nodes: NodeIR[], id: string): NodeIR | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === "group") {
      const hit = findNodeById(node.children, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Leaf (drawable) descendant ids of a node — the ops that form its hit area. */
function descendantLeafIds(node: NodeIR): string[] {
  if (node.type !== "group") return [node.id];
  return node.children.flatMap(descendantLeafIds);
}

/** Begin dragging a node's x/y, capturing the inverse parent-space mapping. */
function startNodeDrag(id: string, x: number, y: number) {
  if (!store) return;
  const node = findNodeById(store.compiled.ir.nodes, id);
  if (!node || !("x" in node.props)) return;
  const props = node.props as { x: number; y: number };
  const p = nodeParentMatrix(store.compiled, id, t) ?? [1, 0, 0, 1, 0, 0];
  const [a, b, c, d] = p;
  const det = a * d - b * c || 1;
  drag = { kind: "node", id, startX: props.x, startY: props.y, px: x, py: y, inv: [d / det, -b / det, -c / det, a / det] };
  playing = false;
  playBtn.textContent = "play";
}

canvas.addEventListener("mousedown", (ev) => {
  if (!store) return;
  const [x, y] = clientToScene(ev);
  // 1) motionPath waypoint handles take priority
  for (const mp of store.motionPaths()) {
    const i = mp.points.findIndex(([px, py]) => Math.hypot(px - x, py - y) <= HANDLE_R + 4);
    if (i >= 0) {
      drag = { kind: "waypoint", label: mp.label, index: i, points: mp.points.map((p) => [...p] as [number, number]) };
      playing = false;
      playBtn.textContent = "play";
      ev.preventDefault();
      return;
    }
  }
  const ops = evaluate(store.compiled, t);
  // 2) a SELECTED group moves as a whole when you press inside its content.
  //    (To grab a child instead, double-click it — enters the group.)
  const sel = store.selectedId ? findNodeById(store.compiled.ir.nodes, store.selectedId) : null;
  if (sel && sel.type === "group") {
    const ids = new Set(descendantLeafIds(sel));
    if (ops.some((op) => ids.has(op.id) && hitOp(op, x, y))) {
      startNodeDrag(sel.id, x, y);
      ev.preventDefault();
      return;
    }
  }
  // 3) drag the top-most leaf under the cursor (nested or top-level). The
  //    overlay address stays nodes.<id>.x/y; nested deltas are parent-corrected.
  //    Lines (x1/y1/x2/y2) are a separate gesture.
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]!;
    if (op.type === "line" || !hitOp(op, x, y)) continue;
    store.select(op.id);
    startNodeDrag(op.id, x, y);
    ev.preventDefault();
    return;
  }
});

window.addEventListener("mousemove", (ev) => {
  if (!drag || !store) return;
  const [x, y] = clientToScene(ev);
  if (drag.kind === "waypoint") {
    drag.points[drag.index] = [Math.round(x), Math.round(y)];
    store.setMotionPathPoints(drag.label, drag.points);
  } else {
    const dx = x - drag.px;
    const dy = y - drag.py;
    const [ia, ib, ic, id] = drag.inv;
    store.setNodeProp(drag.id, "x", Math.round(drag.startX + ia * dx + ic * dy));
    store.setNodeProp(drag.id, "y", Math.round(drag.startY + ib * dx + id * dy));
  }
  draw();
});
window.addEventListener("mouseup", () => {
  drag = null;
});

/** Distance from point p to segment a→b. */
function distToSeg(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let u = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  u = Math.max(0, Math.min(1, u));
  return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy));
}

// double-click: on a waypoint handle → remove it (keep ≥2); near a path
// segment → insert a new waypoint there (more bends). MotionPathHelper pattern.
canvas.addEventListener("dblclick", (ev) => {
  if (!store) return;
  const [x, y] = clientToScene(ev);
  for (const mp of store.motionPaths()) {
    const onHandle = mp.points.findIndex(([px, py]) => Math.hypot(px - x, py - y) <= HANDLE_R + 4);
    if (onHandle >= 0) {
      if (mp.points.length > 2) {
        store.setMotionPathPoints(mp.label, mp.points.filter((_, i) => i !== onHandle));
        draw();
      }
      ev.preventDefault();
      return;
    }
    for (let i = 0; i < mp.points.length - 1; i++) {
      if (distToSeg([x, y], mp.points[i]!, mp.points[i + 1]!) <= 14) {
        const next = mp.points.map((p) => [...p] as [number, number]);
        next.splice(i + 1, 0, [Math.round(x), Math.round(y)]);
        store.setMotionPathPoints(mp.label, next);
        draw();
        ev.preventDefault();
        return;
      }
    }
  }
  // not on a waypoint → dive in: select the top-most leaf under the cursor (so a
  // child inside a selected group becomes selectable for direct dragging).
  const ops = evaluate(store.compiled, t);
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]!;
    if (op.type === "line" || !hitOp(op, x, y)) continue;
    store.select(op.id);
    draw();
    ev.preventDefault();
    return;
  }
});

function tick(now: number) {
  if (playing && store) {
    t += ((now - lastTick) / 1000) * speed;
    const lo = loopOn ? tIn : 0;
    const hi = loopOn ? Math.min(tOut, store.compiled.duration) : store.compiled.duration;
    if (t > hi || t < lo) t = lo; // loop the [in, out] range (or the whole clip)
    draw();
  }
  lastTick = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/** Position the loop-range band over the scrubber. */
function updateLoopBand() {
  if (!store || !loopOn || !(store.compiled.duration > 0)) {
    loopBand.style.display = "none";
    return;
  }
  const D = store.compiled.duration;
  const a = Math.max(0, Math.min(1, tIn / D));
  const b = Math.max(a, Math.min(1, Math.min(tOut, D) / D));
  loopBand.style.display = "block";
  loopBand.style.left = `${a * 100}%`;
  loopBand.style.width = `${(b - a) * 100}%`;
}
markInBtn.addEventListener("click", () => {
  tIn = t;
  if (tOut <= tIn) tOut = store?.compiled.duration ?? Infinity;
  updateLoopBand();
});
markOutBtn.addEventListener("click", () => {
  tOut = t;
  if (tIn >= tOut) tIn = 0;
  updateLoopBand();
});
loopBtn.addEventListener("click", () => {
  loopOn = !loopOn;
  loopBtn.classList.toggle("on", loopOn);
  if (loopOn && tOut === Infinity) tOut = store?.compiled.duration ?? Infinity;
  updateLoopBand();
});
speedSel.addEventListener("change", () => {
  speed = Number(speedSel.value);
});

// --- deep-linking: ?scene=<label>&t=<sec> lets a driver open an exact frame ---
function keyForLabel(label: string): string | undefined {
  return Object.keys(modules).find((k) => modules[k]!.label === label);
}
function syncUrl() {
  const label = modules[select.value]?.label ?? select.value;
  history.replaceState(null, "", `?scene=${encodeURIComponent(label)}&t=${t.toFixed(3)}`);
}
/** Set the scrub time (also exposed as window.__setTime for automation). */
function setTime(sec: number) {
  if (!store) return;
  t = Math.max(0, Math.min(sec, store.compiled.duration));
  playing = false;
  playBtn.textContent = "play";
  draw();
  syncUrl();
}
(window as unknown as { __setTime: (s: number) => void }).__setTime = setTime;

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? "pause" : "play";
});

scrub.addEventListener("input", () => {
  if (!store) return;
  playing = false;
  playBtn.textContent = "play";
  t = Number(scrub.value) * store.compiled.duration;
  draw();
  syncUrl();
});

let currentPath = "";
select.addEventListener("change", () => {
  if (store?.dirty && !confirm("Discard unsaved overlay edits?")) {
    select.value = currentPath;
    return;
  }
  currentPath = select.value;
  void loadScene(select.value);
});
if (Object.keys(modules).length === 0) {
  panelRoot.innerHTML =
    "<p style='padding:12px;color:#aab'>No scenes found. Scaffold one in this directory with <code>reframe new my-scene</code>, then reload.</p>";
} else {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("scene");
  currentPath = (fromUrl && keyForLabel(fromUrl)) || select.value || Object.keys(modules)[0]!;
  select.value = currentPath;
  const tParam = params.get("t");
  void loadScene(currentPath).then(() => {
    if (tParam !== null) setTime(Number(tParam));
  });
}
