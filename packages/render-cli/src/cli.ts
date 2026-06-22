#!/usr/bin/env tsx
/**
 * reframe-render ir <scene.ts|scene.json> [--overlay edits.json ...] [-o out.mp4] [--fps N] [--keep-frames]
 * reframe-render html <page.html> --duration S [-o out.mp4] [--fps N] [--keep-frames]
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { compileScene, formatComposeReport, resolveAudioPlan } from "@reframe/core";
import { buildAudioTrack } from "./audio/index.js";
import { renderComposition } from "./composition.js";
import { encodeMp4 } from "./encode.js";
import { captureHtml, captureIr } from "./frameLoop.js";
import { loadModule } from "./loadScene.js";
import { applyOverlays } from "./overlay.js";

interface Args {
  mode: "ir" | "html";
  input: string;
  out: string;
  fps?: number;
  duration?: number;
  keepFrames: boolean;
  framesDir?: string;
  overlays: string[];
  theme?: string;
  /** Render at N× and downscale (SSAA) for crisp anti-aliasing; 1 = off (default). */
  supersample?: number;
  noAudio: boolean;
  /** Composition: render only this scene id, standalone. */
  scene?: string;
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
    noAudio: false,
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "-o") args.out = rest[++i]!;
    else if (a === "--fps") args.fps = Number(rest[++i]);
    else if (a === "--duration") args.duration = Number(rest[++i]);
    else if (a === "--keep-frames") args.keepFrames = true;
    else if (a === "--frames-dir") args.framesDir = resolve(rest[++i]!);
    else if (a === "--overlay") args.overlays.push(resolve(rest[++i]!));
    else if (a === "--theme") args.theme = resolve(rest[++i]!);
    else if (a === "--supersample" || a === "--ss") args.supersample = Math.max(1, Math.min(4, Math.floor(Number(rest[++i])) || 1));
    else if (a === "--no-audio") args.noAudio = true;
    else if (a === "--scene") args.scene = rest[++i]!;
    else {
      console.error(`unknown flag ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // ir mode loads a scene OR a composition; a composition renders each scene +
  // concatenates (its own frame/temp handling), so branch before the per-scene path.
  const loaded = args.mode === "ir" ? await loadModule(args.input) : null;
  if (loaded?.kind === "composition") {
    if (args.overlays.length > 0 || args.theme) {
      console.error("note: overlays / --theme apply per-scene, not to a composition — ignored here");
    }
    const { duration, sceneCount } = await renderComposition(loaded.ir, {
      compositionPath: args.input,
      out: args.out,
      noAudio: args.noAudio,
      ...(args.fps !== undefined && { fps: args.fps }),
      ...(args.scene !== undefined && { onlyScene: args.scene }),
      ...(args.supersample !== undefined && { supersample: args.supersample }),
    });
    console.log(
      args.scene !== undefined
        ? `${args.out} (scene "${args.scene}", ${duration.toFixed(2)}s)`
        : `${args.out} (composition: ${sceneCount} scene${sceneCount > 1 ? "s" : ""}, ${duration.toFixed(2)}s)`,
    );
    return;
  }

  const framesDir = args.framesDir ?? (await mkdtemp(join(tmpdir(), "reframe-frames-")));

  let result;
  let outSize = { width: 1920, height: 1080 };
  let audioJob: { plan: import("@reframe/core").AudioPlan; videoOut: string } | null = null;
  if (args.mode === "ir") {
    let ir = loaded!.ir;
    if (args.overlays.length > 0 || args.theme) {
      const composed = await applyOverlays(ir, args.overlays, args.theme);
      console.error(formatComposeReport(composed.report));
      ir = composed.ir;
    }
    outSize = ir.size;
    if (!args.noAudio) {
      const plan = resolveAudioPlan(compileScene(ir));
      if (plan) {
        for (const w of plan.warnings) console.error(`audio: ${w}`);
        audioJob = { plan, videoOut: `${args.out}.video.mp4` };
      }
    }
    result = await captureIr(ir, {
      framesDir,
      sceneDir: dirname(args.input),
      ...(args.fps !== undefined && { fps: args.fps }),
      ...(args.duration !== undefined && { duration: args.duration }),
      ...(args.supersample !== undefined && { supersample: args.supersample }),
    });
  } else {
    if (args.duration === undefined || Number.isNaN(args.duration)) {
      throw new Error("html mode requires --duration <seconds>");
    }
    result = await captureHtml(args.input, {
      framesDir,
      fps: args.fps ?? 30,
      duration: args.duration,
      ...(args.supersample !== undefined && { supersample: args.supersample }),
    });
  }

  // supersampled frames are N×-sized → Lanczos-downscale to the scene size at encode
  const downscale = args.supersample !== undefined && args.supersample > 1 ? outSize : undefined;
  await encodeMp4(result.framesDir, result.fps, audioJob ? audioJob.videoOut : args.out, downscale ? { downscale } : {});
  if (audioJob) {
    await buildAudioTrack(audioJob.plan, args.input, audioJob.videoOut, args.out);
    await rm(audioJob.videoOut, { force: true });
  }
  if (!args.keepFrames && args.framesDir === undefined) {
    await rm(framesDir, { recursive: true, force: true });
  }
  console.log(
    `${args.out} (${result.frameCount} frames @ ${result.fps}fps${audioJob ? `, ${audioJob.plan.cues.length} audio cues` : ""})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
