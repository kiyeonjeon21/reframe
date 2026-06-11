import { spawn } from "node:child_process";

export async function encodeMp4(framesDir: string, fps: number, outFile: string): Promise<void> {
  const args = [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    `${framesDir}/%05d.png`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outFile,
  ];
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}:\n${stderr.slice(-2000)}`));
    });
    proc.on("error", reject);
  });
}

/**
 * Extract a filmstrip montage for LLM judges. Tiles are sampled densely at
 * the start and end of the clip — entrances and exits are where motion
 * judging happens, and uniform sampling lets a fast exit fall between tiles.
 */
const TILE_FRACTIONS = [0, 0.03, 0.08, 0.15, 0.3, 0.5, 0.7, 0.85, 0.93, 0.98];

export async function extractFilmstrip(
  mp4: string,
  outPng: string,
  opts: { frameCount: number },
): Promise<void> {
  const last = Math.max(0, opts.frameCount - 1);
  const frames = [...new Set(TILE_FRACTIONS.map((f) => Math.round(f * last)))];
  const select = frames.map((n) => `eq(n\\,${n})`).join("+");
  const args = [
    "-y",
    "-i",
    mp4,
    "-vf",
    `select='${select}',scale=384:-1,tile=5x2`,
    "-frames:v",
    "1",
    outPng,
  ];
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg filmstrip failed (${code}):\n${stderr.slice(-2000)}`));
    });
    proc.on("error", reject);
  });
}
