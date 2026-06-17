/** Orchestrator: AudioPlan → resolved files → mux into the final mp4. */

import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AudioPlan, ClipAudio } from "@reframe/core";
import { resolveBgmFile, resolveCueFile } from "./sfx.js";
import { resolveClipAudio } from "./clip.js";
import { muxAudio } from "./mux.js";

export async function buildAudioTrack(
  plan: AudioPlan,
  scenePath: string,
  videoIn: string,
  outFile: string,
): Promise<void> {
  const sceneDir = dirname(scenePath);
  const cueFiles = await Promise.all(plan.cues.map((cue) => resolveCueFile(cue, sceneDir)));
  const bgmFile = plan.bgm ? await resolveBgmFile(plan.bgm.source, plan.duration, sceneDir) : null;

  const work = await mkdtemp(join(tmpdir(), "reframe-clipaudio-"));
  try {
    const clipFiles: { audio: ClipAudio; file: string }[] = [];
    for (const entry of plan.clipAudio) {
      const file = await resolveClipAudio(entry, sceneDir, work);
      if (file) clipFiles.push({ audio: entry, file });
      else console.error(`audio: video "${entry.nodeId}" has no audio track — skipped`);
    }
    // nothing to mix → keep the silent video as-is
    if (!plan.bgm && plan.cues.length === 0 && clipFiles.length === 0) {
      await copyFile(videoIn, outFile);
      return;
    }
    await muxAudio(videoIn, plan, { cueFiles, bgmFile, clipFiles }, outFile);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export { buildFilterGraph, muxAudio } from "./mux.js";
export { synthSfx, synthAmbientPad } from "./synth.js";
export { encodeWavMono16 } from "./wav.js";
