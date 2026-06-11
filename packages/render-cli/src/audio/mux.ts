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
import type { AudioPlan } from "@reframe/core";

const FORMAT = "aformat=sample_rates=44100:channel_layouts=stereo";

export interface MuxInputs {
  /** Audio file per cue, same order as plan.cues. */
  cueFiles: string[];
  bgmFile: string | null;
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
    lines.push(`[${inputIndex}:a]${FORMAT},volume=${cue.gain},adelay=${delayMs}:all=1[c${i}]`);
    mixIn.push(`[c${i}]`);
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
