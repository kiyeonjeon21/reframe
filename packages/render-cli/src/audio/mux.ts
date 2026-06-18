/**
 * AudioPlan → ffmpeg. buildFilterGraph is a pure string builder (snapshot-
 * tested without ffmpeg); muxAudio runs the 2-pass mux: video stream copied,
 * audio mixed from the plan.
 *
 * Graph shape: silent anchor (pins output length) + bgm chain (gain, fades,
 * precomputed trapezoid duck ramps, eval=frame) + one chain per cue
 * (format → gain → adelay) → amix normalize=0 → limiter.
 */

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AudioPlan, ClipAudio } from "@reframe/core";

const FORMAT = "aformat=sample_rates=44100:channel_layouts=stereo";

/** Decompose a playback rate into ffmpeg-legal `atempo` factors (each 0.5–2.0). */
export function atempoChain(rate: number): string[] {
  if (!(rate > 0) || rate === 1) return [];
  const out: string[] = [];
  let r = rate;
  while (r > 2) { out.push("atempo=2.0"); r /= 2; }
  while (r < 0.5) { out.push("atempo=0.5"); r /= 0.5; }
  out.push(`atempo=${r.toFixed(4)}`);
  return out;
}

/** Stereo balance: -1 full left … 0 centre … +1 full right (applied after FORMAT). */
function panFilter(pan: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v)).toFixed(4);
  return `pan=stereo|c0=${clamp(1 - pan)}*c0|c1=${clamp(1 + pan)}*c1`;
}

export interface MuxInputs {
  /** Audio file per cue, same order as plan.cues. */
  cueFiles: string[];
  bgmFile: string | null;
  /** Extracted clip audio (only clips that HAVE an audio stream), placed after cues. */
  clipFiles?: { audio: ClipAudio; file: string }[];
}

export function buildFilterGraph(plan: AudioPlan, inputs: MuxInputs): string {
  const lines: string[] = [];
  const mixIn: string[] = ["[anchor]"];
  lines.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${plan.duration.toFixed(3)}[anchor]`);

  let inputIndex = 1; // 0 is the video file
  if (plan.bgm && inputs.bgmFile) {
    const b = plan.bgm;
    const chain: string[] = [FORMAT, `volume=${b.gain}`];
    if (b.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${b.fadeIn}`);
    if (b.fadeOut > 0) {
      chain.push(`afade=t=out:st=${Math.max(0, plan.duration - b.fadeOut).toFixed(3)}:d=${b.fadeOut}`);
    }
    if (b.duck) {
      for (const w of plan.duckWindows) {
        const { attack, release, depth } = b.duck;
        const t0 = (w.t0 - attack).toFixed(3);
        const t1 = (w.t1 + release).toFixed(3);
        // trapezoid: 0→1 over [t0-attack, t0], 1→0 over [t1, t1+release]
        chain.push(
          `volume='1-${depth}*max(0\\,min(1\\,min((t-${t0})/${attack}\\,(${t1}-t)/${release})))':eval=frame`,
        );
      }
    }
    lines.push(`[${inputIndex}:a]${chain.join(",")}[bgm]`);
    mixIn.push("[bgm]");
    inputIndex++;
  }

  plan.cues.forEach((cue, i) => {
    const delayMs = Math.round(cue.t * 1000);
    const chain: string[] = [FORMAT, `volume=${cue.gain}`];
    if (cue.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${cue.fadeIn}`);
    if (cue.fadeOut > 0) {
      chain.push(`afade=t=out:st=${Math.max(0, cue.duration - cue.fadeOut).toFixed(3)}:d=${cue.fadeOut}`);
    }
    if (cue.pan !== 0) chain.push(panFilter(cue.pan));
    chain.push(`adelay=${delayMs}:all=1`);
    lines.push(`[${inputIndex}:a]${chain.join(",")}[c${i}]`);
    mixIn.push(`[c${i}]`);
    inputIndex++;
  });

  (inputs.clipFiles ?? []).forEach(({ audio }, i) => {
    const chain: string[] = [];
    if (audio.clipStart > 0) chain.push(`atrim=start=${audio.clipStart.toFixed(3)}`, "asetpts=PTS-STARTPTS");
    chain.push(...atempoChain(audio.rate), FORMAT, `volume=${audio.gain}`);
    if (audio.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${audio.fadeIn}`);
    if (audio.pan !== 0) chain.push(panFilter(audio.pan));
    const delayMs = Math.round(audio.start * 1000);
    if (delayMs > 0) chain.push(`adelay=${delayMs}:all=1`);
    lines.push(`[${inputIndex}:a]${chain.join(",")}[k${i}]`);
    mixIn.push(`[k${i}]`);
    inputIndex++;
  });

  lines.push(
    `${mixIn.join("")}amix=inputs=${mixIn.length}:duration=first:normalize=0,` +
      `alimiter=limit=0.891,aresample=async=1:first_pts=0[aout]`,
  );
  return lines.join(";\n");
}

export async function muxAudio(
  videoIn: string,
  plan: AudioPlan,
  inputs: MuxInputs,
  outFile: string,
): Promise<void> {
  const work = await mkdtemp(join(tmpdir(), "reframe-mux-"));
  try {
    const graphFile = join(work, "graph.txt");
    await writeFile(graphFile, buildFilterGraph(plan, inputs));
    const args = [
      "-y",
      "-i", videoIn,
      ...(plan.bgm && inputs.bgmFile ? ["-i", inputs.bgmFile] : []),
      ...inputs.cueFiles.flatMap((f) => ["-i", f]),
      ...(inputs.clipFiles ?? []).flatMap((c) => ["-i", c.file]),
      "-filter_complex_script", graphFile,
      "-map", "0:v",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "44100",
      "-shortest",
      outFile,
    ];
    await new Promise<void>((resolvePromise, reject) => {
      const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code === 0) resolvePromise();
        else reject(new Error(`ffmpeg mux exited ${code}:\n${stderr.slice(-2000)}`));
      });
      proc.on("error", reject);
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
