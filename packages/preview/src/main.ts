/**
 * Preview + editor shell: scene picker, scrub/play, canvas, selection
 * highlight. Edits live in EditorStore as an OverlayDoc draft; everything
 * here only reads store.compiled. rAF lives ONLY in this file — the export
 * path never uses wall-clock time.
 */

import { collectImageSrcs, compileComposition, evaluate, nodeParentMatrix, type CompositionIR, type DisplayOp, type NodeIR, type SceneIR, type TimelineIR } from "@reframe/core";
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

// compositions (the layer above a scene) — picked from the same dropdown, keyed
// "comp:<path>"; selecting one opens a scene navigator over its scenes.
const compositionModules = import.meta.glob<{ default: CompositionIR }>("../../../examples/compositions/*.ts");
const compositions: Record<string, { label: string; load: () => Promise<{ default: CompositionIR }> }> = {};
for (const path of Object.keys(compositionModules).sort()) {
  compositions[`comp:${path}`] = {
    label: `▤ ${path.split("/").pop()!.replace(".ts", "")} (composition)`,
    load: compositionModules[path]!,
  };
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
const playAllBtn = document.getElementById("play-all") as HTMLButtonElement;
const compTimelineEl = document.getElementById("comp-timeline") as HTMLDivElement;
let compPlayhead: HTMLDivElement | null = null;
let compTotal = 0;
let compStarts: number[] = []; // composition scene start times (play-all + playhead)
let tracksOpen = false; // node-track dope sheet expanded
let tkPlayhead: HTMLDivElement | null = null;
const expandedGroups = new Set<string>(); // which track groups are unfolded
// play-all: a continuous-playback MODE that draws the whole composition from
// precompiled scenes (no editor-store swaps), blending crossfades.
let playAll = false;
let compT = 0; // global composition time in play-all mode
let playCC: import("@reframe/core").CompiledComposition | null = null;

let store: EditorStore | null = null;
let panel: ReturnType<typeof buildPanel> | null = null;
let t = 0;
let playing = false;
let lastTick = 0;
let speed = 1;
let loopOn = false;
let tIn = 0;
let tOut = Infinity;
// active composition (when a "comp:" entry is selected) + which scene is open
let activeComposition: CompositionIR | null = null;
let activeSceneIndex = 0;

for (const [key, entry] of Object.entries(modules)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = entry.label;
  select.appendChild(option);
}
for (const [key, entry] of Object.entries(compositions)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = entry.label;
  select.appendChild(option);
}

// decoded images keyed by raw src; missing entries render as a placeholder
const images = new Map<string, CanvasImageSource>();
const imageLoads = new Map<string, Promise<void>>();
let sceneDir = "";

/** Load one src via /@fs (deduped); resolves when decoded or on error. */
function loadSrc(src: string, dir: string): Promise<void> {
  const existing = imageLoads.get(src);
  if (images.has(src)) return Promise.resolve();
  if (existing) return existing;
  const url = `/@fs${src.startsWith("/") ? src : `${dir}/${src}`}`;
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
  return load;
}

/** Load any not-yet-loaded srcs of the current scene via /@fs. */
function ensureImages(): Promise<void> {
  if (!store) return Promise.resolve();
  return Promise.all([...collectImageSrcs(store.compiled.ir)].map((s) => loadSrc(s, sceneDir))).then(() => undefined);
}

/** Preload images across every scene of a composition (for continuous play). */
function ensureCompositionImages(cc: import("@reframe/core").CompiledComposition): Promise<void> {
  return Promise.all(
    cc.scenes.flatMap((p) => [...collectImageSrcs(p.scene)].map((s) => loadSrc(s, __REFRAME_EXAMPLES_DIR__))),
  ).then(() => undefined);
}

/** Build the editor over a SceneIR (from a scene file or a composition scene). */
async function openSceneIR(ir: SceneIR, dir: string, writeUrl = true) {
  store = new EditorStore(ir);
  sceneDir = dir;
  images.clear();
  imageLoads.clear();
  (window as unknown as { __store: EditorStore }).__store = store; // debug/testing hook
  panel = buildPanel(store, panelRoot);
  canvas.width = store.compiled.ir.size.width;
  canvas.height = store.compiled.ir.size.height;
  store.subscribe((kind) => {
    t = Math.min(t, store!.compiled.duration);
    if (kind === "structure") {
      panel!.rebuild();
      buildTimeline(); // beats may have changed
    } else panel!.refreshReport();
    void ensureImages(); // an edited src loads lazily, then redraws
    draw();
  });
  await document.fonts.ready;
  await ensureImages();
  t = 0;
  panel.rebuild();
  buildTimeline();
  draw();
  if (writeUrl) syncUrl();
  tIn = 0;
  tOut = store.compiled.duration;
  updateLoopBand();
  (window as unknown as { __reframeReady: boolean }).__reframeReady = true;
}

async function loadScene(path: string) {
  activeComposition = null;
  leavePlayAllMode();
  playAllBtn.style.display = "none";
  compTimelineEl.classList.remove("on");
  const mod = await modules[path]!.load();
  await openSceneIR(mod.default, modules[path]!.dir);
}

/** Open a composition: build the bottom scene timeline and open its first scene. */
async function loadComposition(key: string) {
  const mod = await compositions[key]!.load();
  activeComposition = mod.default;
  activeSceneIndex = 0;
  compT = 0;
  playAllBtn.style.display = "";
  await openScene(0);
}

/** Open the Nth scene of the active composition into the per-scene editor. */
async function openScene(index: number) {
  if (!activeComposition) return;
  activeSceneIndex = index;
  await openSceneIR(activeComposition.scenes[index]!.scene, __REFRAME_EXAMPLES_DIR__, false);
}

interface TimelineSeg {
  label: string;
  start: number;
  end: number;
  suffix: string;
  active: boolean;
  beat: boolean;
  onClick: () => void;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

type BeatIR = Extract<TimelineIR, { kind: "beat" }>;
function findBeat(tl: TimelineIR | undefined, name: string): BeatIR | null {
  let found: BeatIR | null = null;
  const walk = (s: TimelineIR) => {
    if (s.kind === "beat" && s.name === name) found = s;
    if ("children" in s) s.children.forEach(walk);
  };
  if (tl) walk(tl);
  return found;
}

/** Drag a beat band to retime its chapter: horizontal = move (`gap`), right edge
 *  = stretch (`scale`). Persists as a timeline overlay → survives regen. A click
 *  without movement falls through to the band's seek. */
function attachBeatDrag(band: HTMLElement, seg: TimelineSeg) {
  band.style.cursor = "grab";
  band.addEventListener("mousedown", (ev) => {
    if (!store) return;
    ev.preventDefault();
    const lane = document.getElementById("comp-track");
    const pxPerSec = (lane?.clientWidth ?? 1) / (compTotal || 1);
    const startX = ev.clientX;
    const rect = band.getBoundingClientRect();
    const stretch = ev.clientX > rect.right - 8; // grabbed the right edge
    const beat = findBeat(store.compiled.ir.timeline, seg.label);
    const origGap = beat?.gap ?? 0;
    const origScale = beat?.scale ?? 1;
    const origLeftPct = parseFloat(band.style.left) || 0;
    const origWidthPct = parseFloat(band.style.width) || 0;
    let moved = false;
    band.style.cursor = stretch ? "ew-resize" : "grabbing";
    const onMove = (e: MouseEvent) => {
      const dpx = e.clientX - startX;
      if (Math.abs(dpx) > 3) moved = true;
      const dT = dpx / pxPerSec;
      if (stretch) {
        const newWidthPct = Math.max(0.4, origWidthPct + (dT / (compTotal || 1)) * 100);
        band.style.width = `${newWidthPct}%`;
        store!.setTimelineParam(seg.label, "scale", round3(origScale * (newWidthPct / (origWidthPct || 1))));
      } else {
        band.style.left = `${Math.max(0, origLeftPct + (dT / (compTotal || 1)) * 100)}%`;
        store!.setTimelineParam(seg.label, "gap", round3(Math.max(0, origGap + dT)));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      band.style.cursor = "grab";
      if (!moved) seg.onClick(); // a plain click seeks
      else buildTimeline(); // settle bands + tracks from the composed result
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

/** Greedy lane assignment so time-overlapping bands stack on separate rows
 *  (a crossfade or parallel beat shows clearly instead of colliding on one line). */
function assignLanes(segs: TimelineSeg[]): number[] {
  const laneEnd: number[] = [];
  return segs.map((s) => {
    let lane = laneEnd.findIndex((e) => e <= s.start + 1e-6);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = s.end;
    return lane;
  });
}

/** Top-level beats of the open scene (a single scene's "chapters"), as segments.
 *  A beat's window is the union of its descendant label spans — the time it
 *  actually animates — so chapters built as par(beat-with-leading-wait, …)
 *  still separate cleanly instead of all starting at the structural t=0. */
function topLevelBeatSegs(): TimelineSeg[] {
  if (!store) return [];
  const ir = store.compiled.ir;
  const lt = store.compiled.labelTimes;
  const segs: TimelineSeg[] = [];
  const visit = (tl: import("@reframe/core").TimelineIR, insideBeat: boolean) => {
    if (tl.kind === "beat") {
      if (!insideBeat) {
        let t0 = Infinity;
        let t1 = -Infinity;
        const collect = (s: import("@reframe/core").TimelineIR) => {
          if ("label" in s && s.label !== undefined) {
            const sp = lt.get(s.label);
            if (sp) {
              t0 = Math.min(t0, sp.t0);
              t1 = Math.max(t1, sp.t1);
            }
          }
          if ("children" in s) s.children.forEach(collect);
        };
        tl.children.forEach(collect);
        const span = store!.compiled.beatTimes.get(tl.name);
        // start where the chapter first animates (skips the leading wait); run to
        // the beat's structural end so chapters tile instead of leaving gaps.
        const start = t0 === Infinity ? (span?.t0 ?? 0) : t0;
        const end = span ? span.t1 : t1 === -Infinity ? start : t1;
        if (end >= start) {
          segs.push({ label: tl.name, start, end, suffix: "", active: false, beat: true, onClick: () => setTime(start) });
        }
      }
      tl.children.forEach((c) => visit(c, true));
      return;
    }
    if ("children" in tl) tl.children.forEach((c) => visit(c, insideBeat));
  };
  if (ir.timeline) visit(ir.timeline, false);
  return segs;
}

/** The bottom timeline: scene bands for a composition, else the open scene's
 *  top-level beat bands. Overlapping bands stack on lanes; click to jump. */
function buildTimeline() {
  compTimelineEl.replaceChildren();
  compPlayhead = null;
  tkPlayhead = null;
  let segs: TimelineSeg[];
  let title: string;
  if (activeComposition) {
    const cc = compileComposition(activeComposition);
    compTotal = cc.duration || 1;
    compStarts = cc.scenes.map((p) => p.start);
    segs = cc.scenes.map((p, i) => ({
      label: p.id,
      start: p.start,
      end: p.start + p.duration,
      suffix: p.transition === "crossfade" ? " ⤫" : "",
      active: i === activeSceneIndex,
      beat: false,
      onClick: () => {
        leavePlayAllMode();
        void openScene(i);
      },
    }));
    title = `▤ ${activeComposition.id} — ${cc.scenes.length} scenes · ${cc.duration.toFixed(1)}s`;
  } else {
    segs = topLevelBeatSegs();
    compTotal = store?.compiled.duration || 1;
    compStarts = [];
    title = `beats — ${segs.length} · ${compTotal.toFixed(1)}s`;
  }
  if (segs.length === 0) {
    compTimelineEl.classList.remove("on");
    return;
  }
  compTimelineEl.classList.add("on");
  compTimelineEl.append(el("div", { class: "ct-title" }, title));

  const lanes = assignLanes(segs);
  const laneCount = Math.max(...lanes) + 1;
  const LANE_H = 28;
  const GAP = 4;
  const track = el("div", { id: "comp-track" });
  track.style.height = `${laneCount * LANE_H + (laneCount - 1) * GAP}px`;
  segs.forEach((s, i) => {
    const band = el(
      "div",
      { class: `ct-scene${s.active ? " active" : ""}${s.beat ? " beat" : ""}`, title: s.label },
      s.label,
      el("span", { class: "ct-range" }, `${s.start.toFixed(1)}–${s.end.toFixed(1)}s${s.suffix}`),
    );
    band.style.left = `${(s.start / compTotal) * 100}%`;
    band.style.width = `${Math.max(0, (s.end - s.start) / compTotal) * 100}%`;
    band.style.top = `${lanes[i]! * (LANE_H + GAP)}px`;
    band.style.height = `${LANE_H}px`;
    // beat bands drag to retime (move/stretch); scene bands just open the scene
    if (s.beat) attachBeatDrag(band, s);
    else band.addEventListener("click", s.onClick);
    track.append(band);
  });
  compPlayhead = el("div", { id: "ct-playhead" });
  track.append(compPlayhead);
  // a 120px label gutter (matching the node-track rows) so the band lane and the
  // node lanes share one time axis — both playheads then land at the same x.
  const bandRow = el("div", { class: "ct-bandrow" }, el("div", { class: "tk-label" }, activeComposition ? "scenes" : "beats"), track);
  compTimelineEl.append(bandRow);
  updateCompPlayhead();

  // node-track dope sheet (the open scene's nodes ↔ their motion on the timeline)
  if (store) {
    const toggle = el("button", { class: "tk-toggle" }, `${tracksOpen ? "▾" : "▸"} node tracks`);
    toggle.addEventListener("click", () => {
      tracksOpen = !tracksOpen;
      buildTimeline();
    });
    compTimelineEl.append(toggle);
    const tracks = el("div", { id: "comp-tracks", class: tracksOpen ? "on" : "" });
    compTimelineEl.append(tracks);
    if (tracksOpen) buildTracks(tracks);
  }
}

interface Bar {
  t0: number;
  t1: number;
  prop: string;
}

/** Merge overlapping/adjacent bars into clean active windows (a group envelope). */
function mergeWindows(bars: Bar[]): { t0: number; t1: number }[] {
  const sorted = [...bars].sort((a, b) => a.t0 - b.t0);
  const out: { t0: number; t1: number }[] = [];
  for (const b of sorted) {
    const last = out[out.length - 1];
    if (last && b.t0 <= last.t1 + 1e-3) last.t1 = Math.max(last.t1, b.t1);
    else out.push({ t0: b.t0, t1: b.t1 });
  }
  return out;
}

/** Ancestor group ids on the path to `id` (so a selection can auto-unfold). */
function ancestorGroupIds(nodes: NodeIR[], id: string, path: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === id) return path;
    if (n.type === "group") {
      const r = ancestorGroupIds(n.children, id, [...path, n.id]);
      if (r) return r;
    }
  }
  return null;
}

/** The dope sheet: node motion (from compiled.segments/motionPaths — the graph
 *  reframe already computes) grouped by the scene graph and collapsible. A group
 *  row summarizes its subtree's active windows; unfold it for per-node lanes. */
function buildTracks(container: HTMLElement) {
  if (!store) return;
  const c = store.compiled;
  const dur = c.duration || 1;
  const bars = new Map<string, Bar[]>();
  const push = (id: string, b: Bar) => {
    const arr = bars.get(id);
    if (arr) arr.push(b);
    else bars.set(id, [b]);
  };
  for (const [key, segs] of c.segments) {
    const dot = key.lastIndexOf(".");
    const id = key.slice(0, dot);
    const prop = key.slice(dot + 1);
    for (const s of segs) push(id, { t0: s.t0, t1: s.t1, prop });
  }
  for (const [id, drivers] of c.motionPaths) {
    for (const d of drivers) push(id, { t0: d.t0, t1: d.t1, prop: "path" });
  }

  // a selection auto-unfolds the groups on the way to it
  if (store.selectedId) {
    for (const anc of ancestorGroupIds(c.ir.nodes, store.selectedId) ?? []) expandedGroups.add(anc);
  }

  // a node's own animation PLUS its descendants' (a group can be tweened directly
  // while its children stay static — include both).
  const subtreeBars = (node: NodeIR): Bar[] => {
    const own = bars.get(node.id) ?? [];
    return node.type === "group" ? [...own, ...node.children.flatMap(subtreeBars)] : own;
  };
  const childBars = (node: NodeIR): Bar[] =>
    node.type === "group" ? node.children.flatMap(subtreeBars) : [];

  const left = (t: number) => `${(t / dur) * 100}%`;
  const width = (t0: number, t1: number) => `${Math.max(0.4, ((t1 - t0) / dur) * 100)}%`;

  const renderNode = (node: NodeIR, depth: number) => {
    const sub = subtreeBars(node);
    if (sub.length === 0) return; // nothing in this subtree animates
    // only groups with animated CHILDREN unfold (a self-animated group is a leaf row)
    const isGroup = node.type === "group" && childBars(node).length > 0;
    const expanded = expandedGroups.has(node.id);
    const row = el("div", { class: `tk-row${store!.selectedId === node.id ? " selected" : ""}` });
    const caret = isGroup ? (expanded ? "▾ " : "▸ ") : "";
    const label = el("div", { class: "tk-label", title: node.id, style: `padding-left:${6 + depth * 12}px` }, caret + node.id);
    label.addEventListener("click", () => {
      if (isGroup) {
        if (expanded) expandedGroups.delete(node.id);
        else expandedGroups.add(node.id);
        buildTimeline();
      } else store!.select(node.id);
    });
    const lane = el("div", { class: "tk-lane" });
    if (isGroup) {
      // group summary: merged active windows of the whole subtree
      for (const w of mergeWindows(sub)) {
        const bar = el("div", { class: "tk-bar group", title: `${node.id} ${w.t0.toFixed(2)}–${w.t1.toFixed(2)}s` });
        bar.style.left = left(w.t0);
        bar.style.width = width(w.t0, w.t1);
        bar.addEventListener("click", () => setTime(w.t0));
        lane.append(bar);
      }
    } else {
      for (const b of sub) {
        const bar = el("div", { class: `tk-bar${b.prop === "path" ? " path" : ""}`, title: `${b.prop} ${b.t0.toFixed(2)}–${b.t1.toFixed(2)}s` });
        bar.style.left = left(b.t0);
        bar.style.width = width(b.t0, b.t1);
        bar.addEventListener("click", () => {
          store!.select(node.id);
          setTime(b.t0);
        });
        lane.append(bar);
      }
    }
    row.append(label, lane);
    container.append(row);
    if (isGroup && expanded) for (const ch of node.children) renderNode(ch, depth + 1);
  };
  for (const node of c.ir.nodes) renderNode(node, 0);

  tkPlayhead = el("div", { id: "tk-playhead" });
  container.append(tkPlayhead);
  updateTkPlayhead();
}

/** Position the playhead: composition time (open scene start + local t), or
 *  just local t for a single scene. */
function updateCompPlayhead() {
  if (compPlayhead) {
    const global = activeComposition ? (compStarts[activeSceneIndex] ?? 0) + t : t;
    compPlayhead.style.left = `${(global / compTotal) * 100}%`;
  }
  updateTkPlayhead();
}

/** Node-track playhead at the open scene's local time (over the 120px label gutter). */
function updateTkPlayhead() {
  if (!tkPlayhead || !store) return;
  const frac = t / (store.compiled.duration || 1);
  tkPlayhead.style.left = `calc(120px + ${frac} * (100% - 120px))`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>, ...kids: (HTMLElement | string)[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === "class" ? (n.className = v) : n.setAttribute(k, v);
  n.append(...kids);
  return n;
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
  updateCompPlayhead();
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
  // empty space + a selected, motionless, top-level node → give it its FIRST
  // move: a path from where it sits to here (then double-click the path to bend).
  const sel = store.selectedId;
  if (sel && !store.hasMotionPath(sel)) {
    const node = findNodeById(store.compiled.ir.nodes, sel);
    const topLevel = store.compiled.ir.nodes.some((n) => n.id === sel);
    if (node && topLevel && node.type !== "line") {
      store.addMove(sel, [x, y]);
      draw();
      ev.preventDefault();
    }
  }
});

/** The scene index whose window contains composition time T (the later one in a
 *  crossfade overlap — the incoming scene). */
function sceneIndexAt(T: number): number {
  let idx = 0;
  for (let i = 0; i < compStarts.length; i++) if (compStarts[i]! <= T + 1e-6) idx = i;
  return idx;
}

/** Draw one scene's frame onto the canvas at `alpha` (its own background fills
 *  the frame, so alpha<1 cross-dissolves it over what's already drawn). */
function drawSceneAt(compiled: import("@reframe/core").CompiledScene, localT: number, alpha: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = compiled.ir.background ?? "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawDisplayList(ctx, evaluate(compiled, localT), images);
  ctx.restore();
}

/** Render the whole composition at global time T, blending crossfades — driven
 *  from precompiled scenes, so no editor-store swap (smooth, continuous). */
function drawComposition(T: number) {
  if (!playCC) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const active = playCC.scenes
    .filter((p) => T >= p.start - 1e-6 && T < p.start + p.duration)
    .sort((a, b) => a.start - b.start);
  for (const p of active) {
    // an incoming crossfade ramps 0→1 over its overlap; everything else is opaque
    const alpha =
      p.transition === "crossfade" && p.overlap > 0 && T < p.start + p.overlap
        ? Math.max(0, Math.min(1, (T - p.start) / p.overlap))
        : 1;
    drawSceneAt(p.compiled, T - p.start, alpha);
  }
  if (compPlayhead) compPlayhead.style.left = `${(T / compTotal) * 100}%`;
  scrub.value = String(compTotal ? T / compTotal : 0);
  timeLabel.textContent = `${T.toFixed(3)} / ${compTotal.toFixed(3)}`;
}

function tick(now: number) {
  const dt = (now - lastTick) / 1000;
  if (playAll && playCC) {
    if (playing) {
      compT += dt * speed;
      if (compT >= compTotal) compT = 0; // loop the whole composition
      drawComposition(compT);
    }
  } else if (playing && store) {
    t += dt * speed;
    const lo = loopOn ? tIn : 0;
    const hi = loopOn ? Math.min(tOut, store.compiled.duration) : store.compiled.duration;
    if (t > hi || t < lo) t = lo; // loop the [in, out] range (or the whole clip)
    draw();
  }
  lastTick = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/** Enter continuous-play mode: precompile every scene, preload images, drive
 *  the canvas globally. The editor store is left frozen until we exit. */
async function enterPlayAll() {
  if (!activeComposition) return;
  playCC = compileComposition(activeComposition);
  compTotal = playCC.duration || 1;
  compStarts = playCC.scenes.map((p) => p.start);
  compT = (compStarts[activeSceneIndex] ?? 0) + t; // continue from where we are
  const size = playCC.scenes[0]!.compiled.ir.size;
  canvas.width = size.width;
  canvas.height = size.height;
  await ensureCompositionImages(playCC);
  playAll = true;
  playing = true;
  playAllBtn.classList.add("on");
  playAllBtn.textContent = "stop all";
  playBtn.textContent = "pause";
  drawComposition(compT);
}

/** Leave continuous-play mode WITHOUT opening a scene (caller opens one). */
function leavePlayAllMode() {
  playAll = false;
  playing = false;
  playCC = null;
  playAllBtn.classList.remove("on");
  playAllBtn.textContent = "play all";
  playBtn.textContent = "play";
}

/** Exit to the editor at the current global time (open the scene under T). */
async function exitPlayAll() {
  if (!playAll) return;
  const T = compT;
  const idx = sceneIndexAt(T);
  leavePlayAllMode();
  await openScene(idx);
  if (store) t = Math.max(0, Math.min(T - (compStarts[idx] ?? 0), store.compiled.duration));
  draw();
}

playAllBtn.addEventListener("click", () => {
  if (!activeComposition) return;
  if (playAll) void exitPlayAll();
  else void enterPlayAll();
});

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
  if (activeComposition) return; // compositions are navigated, not deep-linked
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
  // in play-all the scrubber spans the whole composition (global time)
  if (playAll && playCC) {
    playing = false;
    playBtn.textContent = "play";
    compT = Number(scrub.value) * compTotal;
    drawComposition(compT);
    return;
  }
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
  if (currentPath.startsWith("comp:")) void loadComposition(currentPath);
  else void loadScene(currentPath);
});
if (Object.keys(modules).length === 0 && Object.keys(compositions).length === 0) {
  panelRoot.innerHTML =
    "<p style='padding:12px;color:#aab'>No scenes found. Scaffold one in this directory with <code>reframe new my-scene</code>, then reload.</p>";
} else {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("scene");
  currentPath = (fromUrl && keyForLabel(fromUrl)) || select.value || Object.keys(modules)[0]!;
  select.value = currentPath;
  const tParam = params.get("t");
  const initial = currentPath.startsWith("comp:") ? loadComposition(currentPath) : loadScene(currentPath);
  void initial.then(() => {
    if (tParam !== null) setTime(Number(tParam));
  });
}
