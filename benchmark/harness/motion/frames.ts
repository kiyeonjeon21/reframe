/**
 * Grayscale frame stream via an ffmpeg rawvideo pipe. One code path handles
 * both PNG frame directories and mp4 files — decode, downscale, and container
 * reading all come from ffmpeg (already a project dependency).
 */

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";

export interface FrameStreamOptions {
  /** Analysis resolution; defaults chosen by calibration. */
  width: number;
  height: number;
}

export interface FrameSource {
  kind: "png" | "mp4";
  /** ffmpeg -i argument. */
  input: string;
}

export async function resolveSource(path: string): Promise<FrameSource> {
  const s = await stat(path);
  if (s.isDirectory()) return { kind: "png", input: join(path, "%05d.png") };
  return { kind: "mp4", input: path };
}

/** Yields one Uint8Array (width*height luma bytes) per frame. */
export async function* frameStream(
  source: FrameSource,
  opts: FrameStreamOptions,
): AsyncGenerator<Uint8Array> {
  const frameBytes = opts.width * opts.height;
  const args = [
    "-loglevel", "error",
    ...(source.kind === "png" ? ["-framerate", "30"] : []),
    "-i", source.input,
    "-f", "rawvideo",
    "-pix_fmt", "gray",
    "-s", `${opts.width}x${opts.height}`,
    "-",
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

  let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  for await (const chunk of proc.stdout) {
    pending = pending.length === 0 ? (chunk as Buffer) : Buffer.concat([pending, chunk as Buffer]);
    while (pending.length >= frameBytes) {
      yield new Uint8Array(pending.subarray(0, frameBytes));
      pending = pending.subarray(frameBytes);
    }
  }
  const code = await new Promise<number>((res) => proc.on("close", (c) => res(c ?? 1)));
  if (code !== 0) throw new Error(`ffmpeg exited ${code}: ${stderr.slice(-1000)}`);
  if (pending.length !== 0) throw new Error(`trailing partial frame (${pending.length} bytes)`);
}
