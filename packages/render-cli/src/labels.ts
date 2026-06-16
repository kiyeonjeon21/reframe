#!/usr/bin/env tsx
/**
 * `reframe labels <scene.ts|.json>` — print the compiled event clock: every
 * timeline label with the exact seconds it spans. This is the authoritative
 * timing source for sound design (anchor `audio.cues` to these labels) and for
 * debugging when a beat actually fires. Output is `t0  t1  label`, sorted by t0.
 */
import { compileScene } from "@reframe/core";
import { loadScene } from "./loadScene.js";

const path = process.argv[2];
if (!path) {
  console.error("usage: reframe labels <scene.ts|.json>");
  process.exit(1);
}

const scene = await loadScene(path);
const compiled = compileScene(scene);
const rows = [...compiled.labelTimes.entries()].sort((a, b) => a[1].t0 - b[1].t0 || a[0].localeCompare(b[0]));

console.log(`# ${scene.id} — ${rows.length} labels · ${compiled.duration.toFixed(2)}s @ ${scene.fps ?? 30}fps`);
console.log(`# ${"start".padStart(7)}  ${"end".padStart(7)}  label`);
for (const [name, { t0, t1 }] of rows) {
  console.log(`${`${t0.toFixed(2)}s`.padStart(8)}  ${`${t1.toFixed(2)}s`.padStart(8)}  ${name}`);
}
