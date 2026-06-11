/**
 * Motion-profile analyzer.
 *   tsx benchmark/harness/motion/analyze.ts <mp4|framesDir> [-o motion.json]
 *     [--fps 30] [--segments seg.json] [--changed-threshold N]
 *
 * segments file (optional): [{ "t0": 0, "t1": 1.3, "label": "reveal" }, ...]
 * Easing is classified ONLY within externally provided segments (v1).
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { analyzePair, DEFAULT_OPTIONS, type PairStats } from "./blockflow.js";
import { frameStream, resolveSource } from "./frames.js";

const ANALYSIS_WIDTH = 480;
const ANALYSIS_HEIGHT = 270;

export interface Segment {
  t0: number;
  t1: number;
  label: string;
}

export interface MotionProfile {
  params: typeof DEFAULT_OPTIONS & { analysisWidth: number; analysisHeight: number; source: string };
  fps: number;
  framePairs: number;
  series: Record<keyof PairStats, number[]> & { t: number[] };
  summary: {
    meanSpeed: number;
    peakSpeed: number;
    meanDiff: number;
    staticFraction: number;
    longestStaticRunSec: number;
    allStatic: boolean;
    spikes: { pair: number; t: number; ratio: number }[];
    saturatedPairs: number[];
    /** Dominant periodicity of diff energy (Hz) when a clear peak exists. */
    diffPeriodicityHz: number | null;
  };
  segments: {
    label: string;
    t0: number;
    t1: number;
    easing: { class: string; thirdsRatio: number | null; spearman: number | null; reliable: boolean };
  }[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function rollingMedian(xs: number[], i: number, w: number): number {
  const half = Math.floor(w / 2);
  const window: number[] = [];
  for (let j = Math.max(0, i - half); j <= Math.min(xs.length - 1, i + half); j++) {
    if (j !== i) window.push(xs[j]!);
  }
  window.sort((a, b) => a - b);
  return window.length ? window[Math.floor(window.length / 2)]! : 0;
}

function spearman(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 4) return null;
  const rank = (vs: number[]) => {
    const sorted = vs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const ranks = new Array<number>(n);
    sorted.forEach(([, originalIndex], r) => (ranks[originalIndex] = r));
    return ranks;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my);
    vx += (rx[i]! - mx) ** 2;
    vy += (ry[i]! - my) ** 2;
  }
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : null;
}

/**
 * Dominant period via the strongest STRICT LOCAL MAXIMUM of the
 * autocorrelation. Smooth transients autocorrelate highly at small lags but
 * decay monotonically (no local max); genuine oscillation puts a bump at its
 * period. A global-max search would report fps/minLag for every smooth clip.
 */
function dominantPeriodicity(xs: number[], fps: number): number | null {
  const n = xs.length;
  if (n < 24) return null;
  const m = mean(xs);
  const centered = xs.map((x) => x - m);
  const var0 = mean(centered.map((x) => x * x));
  if (var0 < 1e-6) return null;
  const maxLag = Math.floor(n / 2);
  const corr: number[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i + lag < n; i++) c += centered[i]! * centered[i + lag]!;
    corr.push(c / ((n - lag) * var0));
  }
  let bestLag = 0;
  let bestCorr = 0;
  for (let lag = 4; lag < maxLag; lag++) {
    const isLocalMax = corr[lag]! > corr[lag - 1]! && corr[lag]! >= corr[lag + 1]!;
    if (isLocalMax && corr[lag]! > bestCorr) {
      bestCorr = corr[lag]!;
      bestLag = lag;
    }
  }
  return bestCorr > 0.3 && bestLag > 0 ? fps / bestLag : null;
}

export function classifyEasing(
  speeds: number[],
  nonGeometricRatios: number[],
  saturatedFractions: number[],
): MotionProfile["segments"][number]["easing"] {
  const reliable =
    speeds.length >= 6 &&
    mean(nonGeometricRatios) < 0.5 &&
    saturatedFractions.filter((s) => s > 0.3).length / saturatedFractions.length < 0.2 &&
    mean(speeds) > 0.5;
  if (!reliable) {
    return { class: "unreliable", thirdsRatio: null, spearman: null, reliable: false };
  }
  const third = Math.max(1, Math.floor(speeds.length / 3));
  const first = mean(speeds.slice(0, third));
  const last = mean(speeds.slice(-third));
  const R = last > 0.01 ? first / last : Infinity;
  const rho = spearman(
    speeds.map((_, i) => i),
    speeds,
  );
  let cls = "other";
  if (R > 1.8 && rho !== null && rho < -0.5) cls = "decelerating";
  else if (R < 0.55 && rho !== null && rho > 0.5) cls = "accelerating";
  else if (R >= 0.7 && R <= 1.4 && rho !== null && Math.abs(rho) < 0.4) cls = "linear";
  return { class: cls, thirdsRatio: Number.isFinite(R) ? R : null, spearman: rho, reliable: true };
}

export async function analyzeMotion(
  inputPath: string,
  opts: { fps?: number; segments?: Segment[]; changedThreshold?: number } = {},
): Promise<MotionProfile> {
  const fps = opts.fps ?? 30;
  const blockOpts = {
    ...DEFAULT_OPTIONS,
    width: ANALYSIS_WIDTH,
    height: ANALYSIS_HEIGHT,
    ...(opts.changedThreshold !== undefined && { changedThreshold: opts.changedThreshold }),
  };

  const source = await resolveSource(resolve(inputPath));
  const keys = [
    "blockSpeedMean", "blockSpeedP95", "movingFraction", "diffMean",
    "changedFraction", "matchResidual", "nonGeometricRatio", "saturatedFraction", "activeBlocks",
  ] as const;
  const series = Object.fromEntries([...keys.map((k) => [k, []]), ["t", []]]) as MotionProfile["series"];

  let prev: Uint8Array | null = null;
  let pair = 0;
  for await (const frame of frameStream(source, blockOpts)) {
    if (prev) {
      const stats = analyzePair(prev, frame, blockOpts);
      for (const k of keys) series[k].push(stats[k]);
      series.t.push((pair + 0.5) / fps);
      pair++;
    }
    prev = frame;
  }

  // --- summary detectors ---
  const d = series.diffMean;
  const staticFlags = series.changedFraction.map((c) => c < 0.005);

  let longestRun = 0;
  let run = 0;
  for (const isStatic of staticFlags) {
    run = isStatic ? run + 1 : 0;
    longestRun = Math.max(longestRun, run);
  }

  const spikes: MotionProfile["summary"]["spikes"] = [];
  for (let i = 0; i < d.length; i++) {
    const med = rollingMedian(d, i, 9);
    const neighbors = Math.max(i > 0 ? d[i - 1]! : 0, i + 1 < d.length ? d[i + 1]! : 0);
    if (
      d[i]! > Math.max(4 * med, 1.0) &&
      series.changedFraction[i]! > 0.01 &&
      neighbors < d[i]! / 2
    ) {
      spikes.push({ pair: i, t: series.t[i]!, ratio: med > 0 ? d[i]! / med : Infinity });
    }
  }

  const segments: MotionProfile["segments"] = (opts.segments ?? []).map((seg) => {
    const idx = series.t.map((t, i) => (t >= seg.t0 && t <= seg.t1 ? i : -1)).filter((i) => i >= 0);
    return {
      ...seg,
      easing: classifyEasing(
        idx.map((i) => series.blockSpeedMean[i]!),
        idx.map((i) => series.nonGeometricRatio[i]!),
        idx.map((i) => series.saturatedFraction[i]!),
      ),
    };
  });

  return {
    params: { ...blockOpts, analysisWidth: ANALYSIS_WIDTH, analysisHeight: ANALYSIS_HEIGHT, source: source.kind },
    fps,
    framePairs: series.t.length,
    series,
    summary: {
      meanSpeed: mean(series.blockSpeedMean.filter((s) => s > 0)),
      peakSpeed: Math.max(0, ...series.blockSpeedP95),
      meanDiff: mean(d),
      staticFraction: staticFlags.filter(Boolean).length / Math.max(1, staticFlags.length),
      longestStaticRunSec: longestRun / fps,
      allStatic: staticFlags.every(Boolean),
      spikes,
      saturatedPairs: series.saturatedFraction.map((s, i) => (s > 0.3 ? i : -1)).filter((i) => i >= 0),
      diffPeriodicityHz: dominantPeriodicity(d, fps),
    },
    segments,
  };
}

async function main() {
  const [input, ...rest] = process.argv.slice(2);
  if (!input) {
    console.error("usage: tsx analyze.ts <mp4|framesDir> [-o out.json] [--fps N] [--segments seg.json] [--changed-threshold N]");
    process.exit(2);
  }
  let out: string | null = null;
  const opts: { fps?: number; segments?: Segment[]; changedThreshold?: number } = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "-o") out = rest[++i]!;
    else if (rest[i] === "--fps") opts.fps = Number(rest[++i]);
    else if (rest[i] === "--segments") opts.segments = JSON.parse(readFileSync(rest[++i]!, "utf8"));
    else if (rest[i] === "--changed-threshold") opts.changedThreshold = Number(rest[++i]);
  }
  const profile = await analyzeMotion(input, opts);
  const json = JSON.stringify(profile, null, 1);
  if (out) await writeFile(out, json);
  else console.log(json);
}

if (process.argv[1]?.endsWith("analyze.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
