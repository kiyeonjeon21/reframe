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
import { formatComposeReport } from "@reframe/core";
import { renderFrameAt, downscalePng } from "./frameLoop.js";
import { loadModule } from "./loadScene.js";
import { applyOverlays } from "./overlay.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const input = argv[0];
  if (!input || input.startsWith("-")) {
    console.error("usage: reframe frame <scene.ts|.json> [--t <sec>] [-o out.png]");
    process.exit(2);
  }
  let t = 0;
  let out = "";
  const overlays: string[] = [];
  let theme: string | undefined;
  let supersample = 1;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--t") t = Number(argv[++i]);
    else if (a === "-o") out = argv[++i]!;
    else if (a === "--overlay") overlays.push(resolve(argv[++i]!));
    else if (a === "--theme") theme = resolve(argv[++i]!);
    else if (a === "--supersample" || a === "--ss") supersample = Math.max(1, Math.min(4, Math.floor(Number(argv[++i])) || 1));
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
  let ir = loaded.ir;
  if (overlays.length > 0 || theme) {
    const composed = await applyOverlays(ir, overlays, theme);
    console.error(formatComposeReport(composed.report));
    ir = composed.ir;
  }
  const buf = await renderFrameAt(ir, t, { sceneDir: dirname(scenePath), supersample });
  const finalBuf = supersample > 1 ? downscalePng(buf, ir.size.width, ir.size.height) : buf;
  const outPath = out ? resolve(out) : resolve(`${loaded.ir.id}.png`);
  await writeFile(outPath, finalBuf);
  console.log(outPath);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
