/**
 * Clip audio, end to end (no chromium): extract a clip's audio track and mux it
 * onto a silent video. Inputs are generated with ffmpeg lavfi. Asserts the muxed
 * output gains an audio stream, and that a clip with NO audio is skipped.
 */

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { AudioPlan } from "@reframe/core";
import { buildAudioTrack } from "../src/audio/index.js";

const tempDirs: string[] = [];
async function tempDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "reframe-clipaud-"));
  tempDirs.push(d);
  return d;
}
function ff(args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((res, reject) => {
    const p = spawn(args[0]!, args.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString()));
    p.stderr.on("data", (d: Buffer) => (out += d.toString()));
    p.on("close", (code) => res({ code: code ?? 1, out }));
    p.on("error", reject);
  });
}
const hasAudio = async (f: string) =>
  (await ff(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", f])).out.trim().length > 0;

afterAll(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

const planWith = (start: number): AudioPlan => ({
  duration: 2, bgm: null, cues: [], duckWindows: [],
  clipAudio: [{ nodeId: "v", src: "clip.mp4", start, rate: 1, clipStart: 0, gain: 1 }],
  warnings: [],
});

describe("clip audio mux", () => {
  it("muxes a clip's audio track onto the silent video", async () => {
    const dir = await tempDir();
    const clip = join(dir, "clip.mp4");
    const silent = join(dir, "video.mp4");
    const out = join(dir, "out.mp4");
    // clip WITH a 440Hz tone; a separate silent video as the render output
    await ff(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc2=duration=2:size=320x180:rate=10",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest", clip]);
    await ff(["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:d=2:r=10", silent]);

    await buildAudioTrack(planWith(0), join(dir, "scene.ts"), silent, out);
    expect(await hasAudio(silent)).toBe(false);
    expect(await hasAudio(out)).toBe(true);
  }, 120_000);

  it("keeps the video silent when the clip has no audio track", async () => {
    const dir = await tempDir();
    const clip = join(dir, "clip.mp4");
    const silent = join(dir, "video.mp4");
    const out = join(dir, "out.mp4");
    await ff(["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc2=duration=2:size=320x180:rate=10", clip]); // no audio
    await ff(["ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:d=2:r=10", silent]);

    await buildAudioTrack(planWith(0), join(dir, "scene.ts"), silent, out);
    expect(await hasAudio(out)).toBe(false); // copied through, no empty track
  }, 120_000);
});
