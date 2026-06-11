/** Orchestrator: AudioPlan → resolved files → mux into the final mp4. */

import { dirname } from "node:path";
import type { AudioPlan } from "@reframe/core";
import { resolveBgmFile, resolveCueFile } from "./sfx.js";
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
  await muxAudio(videoIn, plan, { cueFiles, bgmFile }, outFile);
}

export { buildFilterGraph, muxAudio } from "./mux.js";
export { synthSfx, synthAmbientPad } from "./synth.js";
export { encodeWavMono16 } from "./wav.js";
