#!/usr/bin/env tsx
/**
 * reframe frame <scene.ts|.json> [--t <sec>] [-o out.png]
 *
 * Render exactly ONE frame at time `t` to a PNG — the same renderer as `render`,
 * without the video muxing (no ffmpeg). For an agentic "render-and-look" loop:
 * show the model its own output (no reference, no full mp4) so it can refine
 * composition/quality. Pairs with `compile` (#35) and `diff`.
 */
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { renderFrameAt } from "./frameLoop.js";
import { loadModule } from "./loadScene.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const input = argv[0];
  if (!input || input.startsWith("-")) {
    console.error("usage: reframe frame <scene.ts|.json> [--t <sec>] [-o out.png]");
    process.exit(2);
  }
  let t = 0;
  let out = "";
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--t") t = Number(argv[++i]);
    else if (a === "-o") out = argv[++i]!;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(t) || t < 0) {
    console.error("--t must be a non-negative number of seconds");
    process.exit(2);
  }

  const scenePath = resolve(input);
  const loaded = await loadModule(scenePath);
  if (loaded.kind !== "scene") {
    console.error("frame needs a single scene (not a composition)");
    process.exit(2);
  }
  const buf = await renderFrameAt(loaded.ir, t, { sceneDir: dirname(scenePath) });
  const outPath = out ? resolve(out) : resolve(`${loaded.ir.id}.png`);
  await writeFile(outPath, buf);
  console.log(outPath);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
