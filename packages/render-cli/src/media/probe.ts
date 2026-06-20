/**
 * Media probing — read a clip's real duration / dimensions with ffprobe so an
 * assembly can respect the footage (a video shot's hold = its actual length,
 * not a blind uniform guess). One spawn per file; mirrors the `hasAudioStream`
 * pattern in audio/clip.ts. Probing runs ONCE at assemble time; the probed
 * numbers are baked into the generated scene, so the render stays deterministic.
 */

import { spawn } from "node:child_process";

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)$/i;

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => res({ code: code ?? 1, stdout, stderr }));
    proc.on("error", reject); // ENOENT when ffprobe is missing
  });
}

export interface MediaInfo {
  isVideo: boolean;
  /** Seconds (video only; absent for stills). */
  duration?: number;
  width?: number;
  height?: number;
}

/** Probe one media file. Tolerant: a failed probe still returns `isVideo`. */
export async function probeMedia(file: string): Promise<MediaInfo> {
  const isVideo = VIDEO_EXT.test(file);
  let out;
  try {
    out = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=width,height",
      "-of", "json",
      file,
    ]);
  } catch {
    throw new Error("ffprobe not found on PATH — install ffmpeg (macOS: brew install ffmpeg, debian: apt install ffmpeg)");
  }
  if (out.code !== 0) return { isVideo };
  try {
    const j = JSON.parse(out.stdout) as { format?: { duration?: string }; streams?: { width?: number; height?: number }[] };
    const d = j.format?.duration ? Number(j.format.duration) : NaN;
    const stream = (j.streams ?? []).find((s) => s.width && s.height);
    return {
      isVideo,
      ...(Number.isFinite(d) && d > 0 ? { duration: d } : {}),
      ...(stream ? { width: Number(stream.width), height: Number(stream.height) } : {}),
    };
  } catch {
    return { isVideo };
  }
}
