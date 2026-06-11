/**
 * Minimal preview: scene picker + scrub + play/pause. Scrubbing is free
 * because evaluate() is a pure function of t. rAF lives ONLY here — the
 * export path never uses wall-clock time.
 */

import { compileScene, type CompiledScene, type SceneIR } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";

const modules = import.meta.glob<{ default: SceneIR }>("../../../examples/scenes/*.ts");

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const select = document.getElementById("scene-select") as HTMLSelectElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const scrub = document.getElementById("scrub") as HTMLInputElement;
const timeLabel = document.getElementById("time") as HTMLSpanElement;

let compiled: CompiledScene | null = null;
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
  compiled = compileScene(mod.default);
  canvas.width = compiled.ir.size.width;
  canvas.height = compiled.ir.size.height;
  await document.fonts.ready;
  t = 0;
  draw();
}

function draw() {
  if (!compiled) return;
  renderFrame(ctx, compiled, t);
  scrub.value = String(compiled.duration ? t / compiled.duration : 0);
  timeLabel.textContent = `${t.toFixed(3)} / ${compiled.duration.toFixed(3)}`;
}

function tick(now: number) {
  if (playing && compiled) {
    t += (now - lastTick) / 1000;
    if (t > compiled.duration) t = 0; // loop
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
  if (!compiled) return;
  playing = false;
  playBtn.textContent = "play";
  t = Number(scrub.value) * compiled.duration;
  draw();
});

select.addEventListener("change", () => void loadScene(select.value));
void loadScene(select.value || Object.keys(modules).sort()[0]!);
