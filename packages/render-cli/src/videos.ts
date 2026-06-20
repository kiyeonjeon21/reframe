/**
 * Node-side video asset resolution for the capture page. A video node is rendered
 * deterministically as a FRAME SEQUENCE: ffmpeg extracts frames at the scene fps
 * into a temp dir, and each frame becomes a data URL the page decodes (same
 * self-contained guarantee as images). The renderer draws frame `round(t*fps)`.
 *
 * Path rules mirror images.ts: absolute, else scene-relative; missing files fail
 * HERE (before the browser) with the tried paths named.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, resolve } from "node:path";
import { collectVideoSrcs, compileScene, type NodeIR, type SceneIR } from "@reframe/core";

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v", ".mkv"]);

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}:\n${stderr.slice(-2000)}`)),
    );
    proc.on("error", reject);
  });
}

/** Seconds of source footage a given video node will reach over the scene. */
function neededSeconds(node: Extract<NodeIR, { type: "video" }>, duration: number): number {
  // a label-anchored `start` (string) only bounds how much footage to EXTRACT here;
  // treating it as 0 over-extracts (harmless). The exact playback start is resolved in
  // evaluate (frame mapping) from the label's time.
  const start = typeof node.props.start === "string" ? 0 : node.props.start ?? 0;
  const rate = node.props.rate ?? 1;
  const clipStart = node.props.clipStart ?? 0;
  return clipStart + Math.max(0, duration - start) * Math.max(0, rate) + 1 / 30; // +1 frame slack
}

function videoNodes(ir: SceneIR): Extract<NodeIR, { type: "video" }>[] {
  const out: Extract<NodeIR, { type: "video" }>[] = [];
  const walk = (nodes: NodeIR[]) => {
    for (const n of nodes) {
      if (n.type === "video") out.push(n);
      if (n.type === "group") walk(n.children);
    }
  };
  walk(ir.nodes);
  return out;
}

/**
 * Raw video src → array of frame data URLs (index = source frame at `fps`), for every
 * video the scene displays. Extraction is bounded to the footage the scene actually reaches.
 */
export async function buildVideoFrameAssets(
  ir: SceneIR,
  sceneDir: string,
  fps: number,
  duration: number,
): Promise<Record<string, string[]>> {
  const srcs = collectVideoSrcs(ir);
  if (srcs.length === 0) return {};

  // longest reach per src (a src may back several nodes)
  const nodes = videoNodes(ir);
  const reachBySrc = new Map<string, number>();
  for (const n of nodes) {
    const reach = neededSeconds(n, duration);
    reachBySrc.set(n.props.src, Math.max(reachBySrc.get(n.props.src) ?? 0, reach));
  }

  const assets: Record<string, string[]> = {};
  for (const src of srcs) {
    if (!VIDEO_EXT.has(extname(src).toLowerCase())) {
      throw new Error(
        `video "${src}": unsupported format "${extname(src)}" — supported: ${[...VIDEO_EXT].join(" ")}`,
      );
    }
    const candidates = [isAbsolute(src) ? src : null, resolve(sceneDir, src)].filter(
      (c): c is string => c !== null,
    );
    const found = candidates.find((c) => existsSync(c));
    if (!found) throw new Error(`video "${src}" not found (tried: ${candidates.join(", ")})`);

    const dir = await mkdtemp(join(tmpdir(), "reframe-vframes-"));
    try {
      const seconds = Math.max(1 / fps, reachBySrc.get(src) ?? duration);
      await runFfmpeg([
        "-y",
        "-i", found,
        "-t", seconds.toFixed(3),
        "-vf", `fps=${fps},scale='min(iw,1280)':-2`,
        "-q:v", "4",
        join(dir, "%05d.jpg"),
      ]);
      // ffmpeg numbers frames from 1; index the array from 0 (source frame 0)
      const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
      assets[src] = await Promise.all(
        files.map(async (f) => `data:image/jpeg;base64,${(await readFile(join(dir, f))).toString("base64")}`),
      );
      if (assets[src].length === 0) throw new Error(`video "${src}": ffmpeg extracted no frames`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return assets;
}

/** fps/duration resolved the same way the capture loop does, without launching a browser. */
export function resolveTiming(
  ir: SceneIR,
  opts: { fps?: number; duration?: number },
): { fps: number; duration: number } {
  const fps = opts.fps ?? ir.fps ?? 30;
  const duration = opts.duration ?? compileScene(ir).duration;
  return { fps, duration };
}
