/**
 * Preview + editor shell: scene picker, scrub/play, canvas, selection
 * highlight. Edits live in EditorStore as an OverlayDoc draft; everything
 * here only reads store.compiled. rAF lives ONLY in this file — the export
 * path never uses wall-clock time.
 */

import { evaluate, type DisplayOp, type SceneIR } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";
import { buildPanel } from "./panel.js";
import { EditorStore } from "./store.js";

const modules = import.meta.glob<{ default: SceneIR }>("../../../examples/scenes/*.ts");

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const select = document.getElementById("scene-select") as HTMLSelectElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const scrub = document.getElementById("scrub") as HTMLInputElement;
const timeLabel = document.getElementById("time") as HTMLSpanElement;
const panelRoot = document.getElementById("panel") as HTMLDivElement;

let store: EditorStore | null = null;
let panel: ReturnType<typeof buildPanel> | null = null;
let t = 0;
let playing = false;
let lastTick = 0;

for (const path of Object.keys(modules).sort()) {
  const option = document.createElement("option");
  option.value = path;
  option.textContent = path.split("/").pop()!.replace(".ts", "");
  select.appendChild(option);
}

async function loadScene(path: string) {
  const mod = await modules[path]!();
  store = new EditorStore(mod.default);
  (window as unknown as { __store: EditorStore }).__store = store; // debug/testing hook
  panel = buildPanel(store, panelRoot);
  canvas.width = store.compiled.ir.size.width;
  canvas.height = store.compiled.ir.size.height;
  store.subscribe((kind) => {
    t = Math.min(t, store!.compiled.duration);
    if (kind === "structure") panel!.rebuild();
    else panel!.refreshReport();
    draw();
  });
  await document.fonts.ready;
  t = 0;
  panel.rebuild();
  draw();
}

function applyMat(m: number[], x: number, y: number): [number, number] {
  return [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
}

function opCorners(op: DisplayOp): [number, number][] {
  switch (op.type) {
    case "rect":
    case "ellipse": {
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
  }
}

function draw() {
  if (!store) return;
  renderFrame(ctx, store.compiled, t);

  if (store.selectedId) {
    const ops = evaluate(store.compiled, t).filter((op) => op.id === store!.selectedId);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = "#7d9aff";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    for (const op of ops) {
      const corners = opCorners(op);
      ctx.beginPath();
      corners.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (corners.length > 2) ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  const duration = store.compiled.duration;
  scrub.value = String(duration ? t / duration : 0);
  timeLabel.textContent = `${t.toFixed(3)} / ${duration.toFixed(3)}`;
}

function tick(now: number) {
  if (playing && store) {
    t += (now - lastTick) / 1000;
    if (t > store.compiled.duration) t = 0; // loop
    draw();
  }
  lastTick = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

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
currentPath = select.value || Object.keys(modules).sort()[0]!;
void loadScene(currentPath);
