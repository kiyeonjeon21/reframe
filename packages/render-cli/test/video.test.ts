/**
 * The video source node, end to end: a clip is extracted to frames and drawn at
 * the frame matching scene-time t. Uses an ffmpeg-generated `testsrc` clip (no
 * committed asset). Verifies the clip plays (frames change over time) and that
 * two runs are byte-identical (the determinism contract).
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scene, text, video } from "@reframe/core";
import { captureIr } from "../src/frameLoop.js";

const tempDirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reframe-vtest-"));
  tempDirs.push(dir);
  return dir;
}
async function frameHashes(framesDir: string): Promise<string[]> {
  const files = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
  return Promise.all(
    files.map(async (f) => createHash("sha256").update(await readFile(join(framesDir, f))).digest("hex")),
  );
}
function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.slice(-800)}`))));
    p.on("error", reject);
  });
}

afterAll(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

const clip = scene({
  id: "video-test",
  size: { width: 320, height: 180 },
  fps: 5,
  nodes: [
    video({ id: "v", src: "clip.mp4", x: 0, y: 0, width: 320, height: 180, fit: "cover" }),
    text({ id: "cap", x: 160, y: 160, anchor: "center", content: "clip", fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: "#fff" }),
  ],
});

describe("video source node", () => {
  it("plays a clip as a layer, deterministically", async () => {
    const dir = await tempDir();
    // a 2s animated test pattern (moving content → frames differ over time)
    await ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=640x360:rate=30", join(dir, "clip.mp4")]);

    const opts = { fps: 5, duration: 1, sceneDir: dir };
    const a = await captureIr(clip, { ...opts, framesDir: await tempDir() });
    const b = await captureIr(clip, { ...opts, framesDir: await tempDir() });

    const hashesA = await frameHashes(a.framesDir);
    expect(hashesA.length).toBe(5);
    // the clip advances → not every frame is identical
    expect(new Set(hashesA).size).toBeGreaterThan(1);
    // two runs are byte-identical
    expect(hashesA).toEqual(await frameHashes(b.framesDir));
  }, 120_000);
});
