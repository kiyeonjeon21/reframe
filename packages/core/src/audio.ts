/**
 * Audio cue resolution: turn label-anchored cues into an absolute-time plan.
 * Pure data in, pure data out — the renderer only executes the plan, so the
 * plan itself is golden-testable and reusable (e.g. preview cue markers).
 *
 * Anchoring to labels is the point: retime a step via an overlay, or let an
 * AI regenerate the scene, and the sound design follows.
 */

import type { CompiledScene } from "./compile.js";
import type { SfxName } from "./ir.js";

/** Nominal cue lengths (s) for duck-window math; file cues use a default. */
export const SFX_DURATION: Record<SfxName, number> = {
  whoosh: 0.35,
  pop: 0.12,
  tick: 0.03,
  rise: 0.5,
  shimmer: 0.9,
  thud: 0.25,
};
const FILE_CUE_DURATION = 0.4;

export interface ResolvedCue {
  t: number;
  gain: number;
  duration: number;
  source:
    | { kind: "sfx"; name: SfxName; params: Record<string, number> }
    | { kind: "file"; path: string };
}

export interface AudioPlan {
  duration: number;
  bgm: {
    source: { kind: "file"; path: string } | { kind: "synth"; name: "ambient-pad" };
    gain: number;
    fadeIn: number;
    fadeOut: number;
    duck: { depth: number; attack: number; release: number } | null;
  } | null;
  cues: ResolvedCue[];
  /** Merged [t0, t1] cue windows the bed should duck under. */
  duckWindows: { t0: number; t1: number }[];
  warnings: string[];
}

export function resolveAudioPlan(compiled: CompiledScene): AudioPlan | null {
  const audio = compiled.ir.audio;
  if (!audio || (!audio.bgm && (audio.cues ?? []).length === 0)) return null;

  const warnings: string[] = [];
  const duration = compiled.duration;

  const cues: ResolvedCue[] = [];
  for (const [index, cue] of (audio.cues ?? []).entries()) {
    let anchor: number;
    if (typeof cue.at === "number") {
      anchor = cue.at;
    } else {
      const span = compiled.labelTimes.get(cue.at);
      if (!span) {
        // validate.ts catches this at authoring time; tolerate here for
        // composed/hand-built IR and stay loud rather than throwing.
        warnings.push(`cue[${index}]: unknown label "${cue.at}" — cue dropped`);
        continue;
      }
      anchor = span.t0;
    }
    const t = Math.max(0, anchor + (cue.offset ?? 0));
    const cueDuration = cue.sfx ? SFX_DURATION[cue.sfx] : FILE_CUE_DURATION;
    if (t >= duration) {
      warnings.push(`cue[${index}] at ${t.toFixed(2)}s starts past the scene end (${duration.toFixed(2)}s) — dropped`);
      continue;
    }
    if (t + cueDuration > duration) {
      warnings.push(`cue[${index}] at ${t.toFixed(2)}s extends past the scene end — it will be truncated`);
    }
    cues.push({
      t,
      gain: cue.gain ?? 1,
      duration: cueDuration,
      source: cue.sfx
        ? { kind: "sfx", name: cue.sfx, params: cue.params ?? {} }
        : { kind: "file", path: cue.file! },
    });
  }
  cues.sort((a, b) => a.t - b.t);

  // merge cue windows for ducking
  const duckWindows: { t0: number; t1: number }[] = [];
  for (const cue of cues) {
    const window = { t0: cue.t, t1: Math.min(duration, cue.t + cue.duration) };
    const last = duckWindows[duckWindows.length - 1];
    if (last && window.t0 <= last.t1 + 0.1) last.t1 = Math.max(last.t1, window.t1);
    else duckWindows.push(window);
  }

  let bgm: AudioPlan["bgm"] = null;
  if (audio.bgm) {
    const b = audio.bgm;
    const duck =
      b.duck === false
        ? null
        : {
            depth: b.duck?.depth ?? 0.5,
            attack: b.duck?.attack ?? 0.05,
            release: b.duck?.release ?? 0.25,
          };
    bgm = {
      source: b.file ? { kind: "file", path: b.file } : { kind: "synth", name: b.synth ?? "ambient-pad" },
      gain: b.gain ?? 0.5,
      fadeIn: b.fadeIn ?? 0,
      fadeOut: b.fadeOut ?? 0,
      duck,
    };
  }

  return { duration, bgm, cues, duckWindows, warnings };
}
