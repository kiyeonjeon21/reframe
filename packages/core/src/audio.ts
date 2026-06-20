/**
 * Audio cue resolution: turn label-anchored cues into an absolute-time plan.
 * Pure data in, pure data out — the renderer only executes the plan, so the
 * plan itself is golden-testable and reusable (e.g. preview cue markers).
 *
 * Anchoring to labels is the point: retime a step via an overlay, or let an
 * AI regenerate the scene, and the sound design follows.
 */

import type { CompiledScene } from "./compile.js";
import type { CompiledComposition } from "./composeComposition.js";
import type { BgmSynth, NodeIR, SceneIR, SfxName } from "./ir.js";
import { autoFoley } from "./autoFoley.js";

/** Nominal cue lengths (s) for duck-window math; file cues use a default. */
export const SFX_DURATION: Record<SfxName, number> = {
  // transition
  whoosh: 0.35, swish: 0.32, swoosh: 0.35, rise: 0.5, riser: 0.85, warp: 0.5,
  // ui
  tick: 0.03, click: 0.05, blip: 0.1, pop: 0.12, select: 0.18,
  // impact
  thud: 0.25, boom: 0.6, knock: 0.14, sub: 0.7,
  // positive
  chime: 0.7, ding: 0.5, coin: 0.3, sparkle: 0.6, shimmer: 0.9, success: 0.6,
  // alert
  zap: 0.22, error: 0.4,
  // tech
  glitch: 0.3, static: 0.18, scan: 0.45, powerup: 0.4, powerdown: 0.5,
  // rhythm / foley
  snare: 0.18, hat: 0.05, bubble: 0.16, notify: 0.45, camera: 0.18,
};
const FILE_CUE_DURATION = 0.4;

export interface ResolvedCue {
  t: number;
  gain: number;
  duration: number;
  /** Fade in over N seconds from the cue start (0 = none). */
  fadeIn: number;
  /** Fade out over N seconds before the cue end (0 = none). */
  fadeOut: number;
  /** Stereo balance: -1 left … 0 centre … +1 right. */
  pan: number;
  source:
    | { kind: "sfx"; name: SfxName; params: Record<string, number> }
    | { kind: "file"; path: string };
}

/** A video node's own audio track, placed on the scene clock. */
export interface ClipAudio {
  nodeId: string;
  src: string;
  /** Scene-time (s) the clip's audio begins. */
  start: number;
  /** Playback speed (atempo). */
  rate: number;
  /** Source in-point (s) — audio is trimmed to begin here. */
  clipStart: number;
  /** Linear gain. */
  gain: number;
  /** Fade in over N seconds from the clip's `start` (0 = none). */
  fadeIn: number;
  /** Stereo balance: -1 left … 0 centre … +1 right. */
  pan: number;
}

export interface AudioPlan {
  duration: number;
  bgm: {
    source: { kind: "file"; path: string } | { kind: "synth"; name: BgmSynth };
    gain: number;
    fadeIn: number;
    fadeOut: number;
    duck: { depth: number; attack: number; release: number } | null;
  } | null;
  cues: ResolvedCue[];
  /** Merged [t0, t1] cue windows the bed should duck under. */
  duckWindows: { t0: number; t1: number }[];
  /** Video clip soundtracks to mux in (a clip with no audio stream is skipped at render). */
  clipAudio: ClipAudio[];
  warnings: string[];
}

/** Walk video nodes → clip-audio entries (skipping muted, default volume 1). */
function collectClipAudio(ir: SceneIR, duration: number, warnings: string[]): ClipAudio[] {
  const out: ClipAudio[] = [];
  const walk = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      if (node.type === "video") {
        const gain = node.props.volume ?? 1;
        const start = node.props.start ?? 0;
        if (gain <= 0) continue;
        if (start >= duration) {
          warnings.push(`video "${node.id}": start ${start.toFixed(2)}s past the scene end — audio dropped`);
          continue;
        }
        out.push({ nodeId: node.id, src: node.props.src, start, rate: node.props.rate ?? 1, clipStart: node.props.clipStart ?? 0, gain, fadeIn: node.props.fadeIn ?? 0, pan: node.props.pan ?? 0 });
      }
      if (node.type === "group") walk(node.children);
    }
  };
  walk(ir.nodes);
  return out;
}

export function resolveAudioPlan(compiled: CompiledScene): AudioPlan | null {
  const audio = compiled.ir.audio;
  const warnings: string[] = [];
  const duration = compiled.duration;
  const clipAudio = collectClipAudio(compiled.ir, duration, warnings);
  // motion-derived cues, generated fresh from the compiled IR (retime-safe)
  const autoCues = audio?.autoFoley
    ? autoFoley(compiled, audio.autoFoley === true ? {} : audio.autoFoley)
    : [];
  const manualCues = [...(audio?.cues ?? []), ...autoCues];
  if (!audio || (!audio.bgm && manualCues.length === 0)) {
    // a scene with only video-clip audio still gets a plan
    return clipAudio.length === 0
      ? null
      : { duration, bgm: null, cues: [], duckWindows: [], clipAudio, warnings };
  }

  const cues: ResolvedCue[] = [];
  for (const [index, cue] of manualCues.entries()) {
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
      fadeIn: cue.fadeIn ?? 0,
      fadeOut: cue.fadeOut ?? 0,
      pan: cue.pan ?? 0,
      source: cue.sfx
        ? // auto-vary: default the seed to the cue's order so repeated sfx differ
          // (pitch/texture); an explicit params.seed always wins.
          { kind: "sfx", name: cue.sfx, params: { seed: index, ...cue.params } }
        : { kind: "file", path: cue.file! },
    });
  }
  cues.sort((a, b) => a.t - b.t);

  return {
    duration,
    bgm: resolveBgm(audio.bgm),
    cues,
    duckWindows: mergeDuckWindows(cues, duration),
    clipAudio,
    warnings,
  };
}

/** Merge overlapping cue windows the bed should duck under. */
function mergeDuckWindows(cues: ResolvedCue[], duration: number): { t0: number; t1: number }[] {
  const duckWindows: { t0: number; t1: number }[] = [];
  for (const cue of cues) {
    const window = { t0: cue.t, t1: Math.min(duration, cue.t + cue.duration) };
    const last = duckWindows[duckWindows.length - 1];
    if (last && window.t0 <= last.t1 + 0.1) last.t1 = Math.max(last.t1, window.t1);
    else duckWindows.push(window);
  }
  return duckWindows;
}

/** Resolve a bgm spec into the plan's bgm shape (shared by scene + composition). */
function resolveBgm(b: NonNullable<import("./ir.js").AudioIR["bgm"]> | undefined): AudioPlan["bgm"] {
  if (!b) return null;
  const duck =
    b.duck === false
      ? null
      : {
          depth: b.duck?.depth ?? 0.5,
          attack: b.duck?.attack ?? 0.05,
          release: b.duck?.release ?? 0.25,
        };
  return {
    source: b.file ? { kind: "file", path: b.file } : { kind: "synth", name: b.synth ?? "ambient-pad" },
    gain: b.gain ?? 0.5,
    fadeIn: b.fadeIn ?? 0,
    fadeOut: b.fadeOut ?? 0,
    duck,
  };
}

/**
 * Composition-level AudioPlan: each scene's cues offset by that scene's start,
 * plus composition-level absolute-time cues, under a composition bed (e.g.
 * kokoro narration) that spans all scenes. Per-scene bgm is ignored (warned) —
 * the bed lives at the composition level. Same determinism boundary as
 * resolveAudioPlan (plan + WAV bytes, not AAC-in-mp4).
 */
export function resolveCompositionAudioPlan(comp: CompiledComposition): AudioPlan | null {
  const audio = comp.ir.audio;
  const duration = comp.duration;
  const warnings: string[] = [];
  const cues: ResolvedCue[] = [];
  const clipAudio: ClipAudio[] = [];

  for (const placement of comp.scenes) {
    const plan = resolveAudioPlan(placement.compiled);
    if (!plan) continue;
    if (plan.bgm) {
      warnings.push(`scene "${placement.id}": per-scene bgm ignored — set bgm at the composition level`);
    }
    for (const w of plan.warnings) warnings.push(`scene "${placement.id}": ${w}`);
    for (const cue of plan.cues) {
      const t = cue.t + placement.start;
      if (t >= duration) continue;
      cues.push({ ...cue, t });
    }
    for (const clip of plan.clipAudio) {
      const start = clip.start + placement.start;
      if (start >= duration) continue;
      clipAudio.push({ ...clip, start });
    }
  }

  for (const [index, cue] of (audio?.cues ?? []).entries()) {
    if (typeof cue.at !== "number") {
      warnings.push(`composition cue[${index}]: "at" must be an absolute number (no composition labels) — dropped`);
      continue;
    }
    const t = Math.max(0, cue.at + (cue.offset ?? 0));
    const cueDuration = cue.sfx ? SFX_DURATION[cue.sfx] : FILE_CUE_DURATION;
    if (t >= duration) {
      warnings.push(`composition cue[${index}] at ${t.toFixed(2)}s past the composition end — dropped`);
      continue;
    }
    cues.push({
      t,
      gain: cue.gain ?? 1,
      duration: cueDuration,
      fadeIn: cue.fadeIn ?? 0,
      fadeOut: cue.fadeOut ?? 0,
      pan: cue.pan ?? 0,
      source: cue.sfx
        ? // auto-vary: default the seed to the cue's order so repeated sfx differ
          // (pitch/texture); an explicit params.seed always wins.
          { kind: "sfx", name: cue.sfx, params: { seed: index, ...cue.params } }
        : { kind: "file", path: cue.file! },
    });
  }

  if (!audio?.bgm && cues.length === 0 && clipAudio.length === 0) return null;
  cues.sort((a, b) => a.t - b.t);

  return {
    duration,
    bgm: resolveBgm(audio?.bgm),
    cues,
    duckWindows: mergeDuckWindows(cues, duration),
    clipAudio,
    warnings,
  };
}
