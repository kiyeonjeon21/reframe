#!/usr/bin/env tsx
/**
 * `reframe trace` — extract a video's motion structure as a MotionSketch, or
 * emit a reframe timeline that reproduces it.
 *
 *   tsx trace-cli.ts <ref.mp4|framesDir> [--fps N] [-o out.json]
 *   tsx trace-cli.ts <ref.mp4> --apply <scene.ts> [-o timeline.json]
 *
 * Default prints the MotionSketch JSON. With --apply, prints the TimelineIR
 * emitted from the sketch against the scene's node ids (onset order) — splice
 * it in as the scene's timeline to re-tell the reference's motion with your
 * own assets.
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sketchToTimeline, type SceneIR } from "@reframe/core";
import { analyzeMotion } from "./analyze.js";
import { extractMotionSketch } from "./sketch.js";

async function main() {
  const [input, ...rest] = process.argv.slice(2);
  if (!input) {
    console.error("usage: reframe trace <ref.mp4|framesDir> [--fps N] [--apply scene.ts] [-o out.json]");
    process.exit(2);
  }
  let fps: number | undefined;
  let apply: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--fps") fps = Number(rest[++i]);
    else if (rest[i] === "--apply") apply = rest[++i];
    else if (rest[i] === "-o") out = rest[++i];
  }

  const profile = await analyzeMotion(resolve(input), { grid: true, ...(fps !== undefined && { fps }) });
  const sketch = extractMotionSketch(profile);

  let result: unknown = sketch;
  if (apply) {
    const ir = ((await import(pathToFileURL(resolve(apply)).href)) as { default: SceneIR }).default;
    result = sketchToTimeline(sketch, ir.nodes.map((n) => n.id));
  }
  const json = JSON.stringify(result, null, 2);
  if (out) await writeFile(resolve(out), json);
  else console.log(json);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
