#!/usr/bin/env tsx
/**
 * `reframe geometry <scene.ts|.json> [--t <sec>] [--json]` — the spatial analog of
 * `manifest`: WHERE every node (and motionPath waypoint) sits on screen at time `t`,
 * in scene coords. Pure — no chromium/ffmpeg (bounds come from the DisplayList +
 * Inter metrics). The query a non-interactive editor reads to place selection
 * outlines + draggable handles (the interactive path is `player --edit`).
 */
import { compileScene, sceneGeometry } from "@reframe/core";
import { loadScene } from "./loadScene.js";

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const tIdx = args.indexOf("--t");
const t = tIdx >= 0 ? Number(args[tIdx + 1]) : 0;
const path = args.find((a, i) => !a.startsWith("-") && args[i - 1] !== "--t");

if (!path) {
  console.error("usage: reframe geometry <scene.ts|.json> [--t <sec>] [--json]");
  process.exit(2);
}

const n = (v: number) => v.toFixed(0).padStart(5);

async function main() {
  const scene = await loadScene(path!);
  const compiled = compileScene(scene);
  const g = sceneGeometry(compiled, t);
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(g)}\n`);
    return;
  }
  console.log(
    `# ${scene.id} @ ${t.toFixed(2)}s · ${g.size.width}×${g.size.height} · ${g.nodes.length} nodes · ${g.groups.length} groups · ${g.waypoints.length} waypoints`,
  );
  for (const node of g.nodes) console.log(`  ${node.id.padEnd(20)} x${n(node.bounds.x)} y${n(node.bounds.y)} w${n(node.bounds.w)} h${n(node.bounds.h)}`);
  for (const gr of g.groups) console.log(`  [group] ${gr.id.padEnd(13)} x${n(gr.bounds.x)} y${n(gr.bounds.y)} w${n(gr.bounds.w)} h${n(gr.bounds.h)}`);
  for (const w of g.waypoints) console.log(`  ~ ${w.label}[${w.index}] → (${w.x.toFixed(0)}, ${w.y.toFixed(0)})`);
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
