/**
 * Render a composition to one mp4: render each scene independently (the exact
 * single-scene path), then concatenate — an all-cut composition via the concat
 * demuxer (lossless remux, byte-deterministic), a mixed cut/crossfade one by
 * combining iteratively into concrete intermediate files. The composition audio
 * plan (per-scene cues offset + a spanning bed) muxes over the combined video.
 */

import { spawn } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  compileComposition,
  compileScene,
  resolveAudioPlan,
  resolveCompositionAudioPlan,
  type CompositionIR,
  type ScenePlacement,
  type SceneIR,
} from "@reframe/core";
import { buildAudioTrack } from "./audio/index.js";
import { encodeMp4 } from "./encode.js";
import { captureIr } from "./frameLoop.js";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}:\n${stderr.slice(-2000)}`))));
    proc.on("error", reject);
  });
}

const sanitize = (id: string) => id.replace(/[^a-z0-9_-]/gi, "_");

/** Render one scene to a silent video; returns its frame count + fps. */
async function renderSceneVideo(
  scene: SceneIR,
  sceneDir: string,
  fps: number | undefined,
  out: string,
  supersample?: number,
): Promise<{ fps: number; frameCount: number }> {
  const framesDir = await mkdtemp(join(tmpdir(), "reframe-frames-"));
  try {
    const result = await captureIr(scene, {
      framesDir,
      sceneDir,
      ...(fps !== undefined && { fps }),
      ...(supersample !== undefined && { supersample }),
    });
    const downscale = supersample !== undefined && supersample > 1 ? scene.size : undefined;
    await encodeMp4(result.framesDir, result.fps, out, downscale ? { downscale } : {});
    return { fps: result.fps, frameCount: result.frameCount };
  } finally {
    await rm(framesDir, { recursive: true, force: true });
  }
}

/** Render a single scene standalone (its own audio) — `render --scene <id>`. */
async function renderStandaloneScene(
  scene: SceneIR,
  sceneDir: string,
  fps: number | undefined,
  noAudio: boolean,
  out: string,
  supersample?: number,
): Promise<void> {
  const plan = noAudio ? null : resolveAudioPlan(compileScene(scene));
  if (plan) {
    const videoOut = `${out}.video.mp4`;
    await renderSceneVideo(scene, sceneDir, fps, videoOut, supersample);
    await buildAudioTrack(plan, join(sceneDir, "scene"), videoOut, out);
    await rm(videoOut, { force: true });
  } else {
    await renderSceneVideo(scene, sceneDir, fps, out, supersample);
  }
}

/** Lossless concat of identically-encoded scene videos (cut joins). */
async function concatVideos(files: string[], out: string): Promise<void> {
  if (files.length === 1) {
    await copyFile(files[0]!, out);
    return;
  }
  const list = `${out}.concat.txt`;
  await writeFile(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
}

/** Crossfade two concrete clips: `a` plays, then blends into `b` over `overlap`
 *  starting at `offset` (the combined length = offset + duration(b)). */
async function xfade2(a: string, b: string, overlap: number, offset: number, out: string): Promise<void> {
  await runFfmpeg([
    "-y", "-i", a, "-i", b,
    "-filter_complex", `[0:v][1:v]xfade=transition=fade:duration=${overlap.toFixed(4)}:offset=${offset.toFixed(4)}[v]`,
    "-map", "[v]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    out,
  ]);
}

/** Mixed cut/crossfade: combine iteratively into concrete intermediate files,
 *  so every join is a clean 2-input op with known input durations (chained
 *  xfade filtergraphs mis-track intermediate stream lengths). */
async function combineWithTransitions(
  videos: { file: string; placement: ScenePlacement }[],
  out: string,
  tmp: string,
): Promise<void> {
  let acc = videos[0]!.file;
  let accDur = videos[0]!.placement.duration;
  for (let i = 1; i < videos.length; i++) {
    const { overlap, duration } = videos[i]!.placement;
    const step = join(tmp, `step${i}.mp4`);
    if (overlap <= 0) {
      await concatVideos([acc, videos[i]!.file], step);
      accDur += duration;
    } else {
      const offset = Math.max(0, accDur - overlap);
      await xfade2(acc, videos[i]!.file, overlap, offset, step);
      accDur = offset + duration;
    }
    acc = step;
  }
  await copyFile(acc, out);
}

export async function renderComposition(
  comp: CompositionIR,
  opts: { compositionPath: string; out: string; fps?: number; noAudio: boolean; onlyScene?: string; supersample?: number },
): Promise<{ duration: number; sceneCount: number }> {
  const cc = compileComposition(comp);
  const sceneDir = dirname(opts.compositionPath);

  if (opts.onlyScene) {
    const p = cc.scenes.find((s) => s.id === opts.onlyScene);
    if (!p) throw new Error(`--scene "${opts.onlyScene}" not in composition; scenes: ${cc.scenes.map((s) => s.id).join(", ")}`);
    await renderStandaloneScene(p.scene, sceneDir, opts.fps, opts.noAudio, opts.out, opts.supersample);
    return { duration: p.duration, sceneCount: 1 };
  }

  const tmp = await mkdtemp(join(tmpdir(), "reframe-comp-"));
  try {
    const videos: { id: string; file: string; placement: ScenePlacement; fps: number }[] = [];
    for (const p of cc.scenes) {
      const file = join(tmp, `${sanitize(p.id)}.mp4`);
      const { fps } = await renderSceneVideo(p.scene, sceneDir, opts.fps, file, opts.supersample);
      videos.push({ id: p.id, file, placement: p, fps });
    }
    const combined = join(tmp, "combined.mp4");
    const allCut = cc.scenes.every((s) => s.overlap === 0);
    if (allCut) await concatVideos(videos.map((v) => v.file), combined);
    else await combineWithTransitions(videos, combined, tmp);

    if (!opts.noAudio) {
      const plan = resolveCompositionAudioPlan(cc);
      if (plan) {
        for (const w of plan.warnings) console.error(`audio: ${w}`);
        await buildAudioTrack(plan, opts.compositionPath, combined, opts.out);
      } else {
        await copyFile(combined, opts.out);
      }
    } else {
      await copyFile(combined, opts.out);
    }
    return { duration: cc.duration, sceneCount: cc.scenes.length };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
