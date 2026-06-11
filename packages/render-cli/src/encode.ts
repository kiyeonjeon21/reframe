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

/** Extract a filmstrip montage (cols x rows tiles, evenly sampled) for LLM judges. */
export async function extractFilmstrip(
  mp4: string,
  outPng: string,
  opts: { cols?: number; rows?: number; frameCount: number } ,
): Promise<void> {
  const cols = opts.cols ?? 5;
  const rows = opts.rows ?? 2;
  const tiles = cols * rows;
  const step = Math.max(1, Math.floor(opts.frameCount / tiles));
  const args = [
    "-y",
    "-i",
    mp4,
    "-vf",
    `select='not(mod(n\\,${step}))',scale=384:-1,tile=${cols}x${rows}`,
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
