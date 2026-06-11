#!/usr/bin/env tsx
/**
 * reframe-render ir <scene.ts|scene.json> [--overlay edits.json ...] [-o out.mp4] [--fps N] [--keep-frames]
 * reframe-render html <page.html> --duration S [-o out.mp4] [--fps N] [--keep-frames]
 */

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { OverlayDoc, SceneIR } from "@reframe/core";
import { composeScene, formatComposeReport, validateScene } from "@reframe/core";
import { encodeMp4 } from "./encode.js";
import { captureHtml, captureIr } from "./frameLoop.js";

interface Args {
  mode: "ir" | "html";
  input: string;
  out: string;
  fps?: number;
  duration?: number;
  keepFrames: boolean;
  framesDir?: string;
  overlays: string[];
}

function parseArgs(argv: string[]): Args {
  const [mode, input, ...rest] = argv;
  if ((mode !== "ir" && mode !== "html") || !input) {
    console.error(
      "usage: reframe-render ir <scene.ts|json> [-o out.mp4] [--fps N] [--keep-frames] [--frames-dir d]\n" +
        "       reframe-render html <page.html> --duration S [-o out.mp4] [--fps N] [--keep-frames] [--frames-dir d]",
    );
    process.exit(2);
  }
  const args: Args = {
    mode,
    input: resolve(input),
    out: `${basename(input).replace(/\.[^.]+$/, "")}.mp4`,
    keepFrames: false,
    overlays: [],
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "-o") args.out = rest[++i]!;
    else if (a === "--fps") args.fps = Number(rest[++i]);
    else if (a === "--duration") args.duration = Number(rest[++i]);
    else if (a === "--keep-frames") args.keepFrames = true;
    else if (a === "--frames-dir") args.framesDir = resolve(rest[++i]!);
    else if (a === "--overlay") args.overlays.push(resolve(rest[++i]!));
    else {
      console.error(`unknown flag ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function loadScene(path: string): Promise<SceneIR> {
  if (path.endsWith(".json")) {
    const ir = JSON.parse(await readFile(path, "utf8")) as SceneIR;
    validateScene(ir);
    return ir;
  }
  const mod = (await import(pathToFileURL(path).href)) as { default?: SceneIR };
  if (!mod.default) throw new Error(`${path} must default-export a scene`);
  return mod.default;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const framesDir = args.framesDir ?? (await mkdtemp(join(tmpdir(), "reframe-frames-")));

  let result;
  if (args.mode === "ir") {
    let ir = await loadScene(args.input);
    if (args.overlays.length > 0) {
      const docs = await Promise.all(
        args.overlays.map(async (p) => JSON.parse(await readFile(p, "utf8")) as OverlayDoc),
      );
      const composed = composeScene(ir, ...docs);
      console.error(formatComposeReport(composed.report));
      ir = composed.ir;
    }
    result = await captureIr(ir, {
      framesDir,
      ...(args.fps !== undefined && { fps: args.fps }),
      ...(args.duration !== undefined && { duration: args.duration }),
    });
  } else {
    if (args.duration === undefined || Number.isNaN(args.duration)) {
      throw new Error("html mode requires --duration <seconds>");
    }
    result = await captureHtml(args.input, {
      framesDir,
      fps: args.fps ?? 30,
      duration: args.duration,
    });
  }

  await encodeMp4(result.framesDir, result.fps, args.out);
  if (!args.keepFrames && args.framesDir === undefined) {
    await rm(framesDir, { recursive: true, force: true });
  }
  console.log(`${args.out} (${result.frameCount} frames @ ${result.fps}fps)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
