/**
 * extractMotionSketch — the bridge from a (grid-enabled) MotionProfile to a
 * MotionSketch. Lives in the harness because it needs the profiler; emits the
 * core MotionSketch vocabulary.
 *
 * Pipeline (per the goal's fixed decisions):
 *  1. per-cell activity runs via hysteresis vs a static floor;
 *  2. spatio-temporally connect adjacent active runs into events (so concurrent
 *     spatially-distinct events stay separate) → region + [t0,t1];
 *  3. classify kind from the existing signals + the one new per-region
 *     occupancy SIGN (rising=enter, falling=exit);
 *  4. easing via the UNCHANGED classifyEasing on the event's window;
 *  5. rhythm from the existing diffPeriodicityHz.
 */

import { classifyEasing, type MotionProfile } from "./analyze.js";
import type { MotionEvent, MotionEventKind, MotionSketch } from "@reframe/core";

// cellDiff is mean |Δ| (8-bit). Background sits near codec noise, content
// motion spikes above. Hysteresis: start a run above HI, hold above LO.
// Thresholds are background-RELATIVE: a clean dark clip keeps the calibrated
// floor (~1.5), a noisy/light UI clip raises it so ambient texture/compression
// noise doesn't seed runs. Upward-only + floored, so the analytic scenes are
// unaffected (their median cellDiff ≈ 0 → HI stays at the floor).
const HI_FLOOR = 1.5;
const HI_LO_RATIO = 0.55; // ≈ the original 0.8/1.5
const NOISE_MARGIN = 1.5; // HI = max(HI_FLOOR, median + margin)
const MIN_RUN_PAIRS = 2; // drop single-pair flickers
// An event longer than this fraction of the clip is CONTINUOUS activity
// (cursor, typing, ongoing UI motion) that never returns to a static floor —
// not a discrete event. Excluded (noise filtering, not silent edit loss).
const CONTINUOUS_FRAC = 0.35;
// Bridge a brief diff lull within one gesture (velocity≈0 at a pop's peak, or
// the flat seam between an ease-out rise and an ease-in fall). Spatial
// adjacency is also required to merge, so staggered/concurrent enters in
// distinct regions never join across this window (~0.23s @30fps).
const TEMPORAL_SLACK = 7;
const MOVE_FRACTION = 0.04; // frame-scalar movingFraction → translation present
const OCC_RATIO = 1.4; // region-mean occupancy fold-change for enter/exit
const INPLACE_RATIO = 0.3; // per-cell occupancy return → in-place transform (not a move)

interface Run {
  cell: number;
  p0: number;
  p1: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Median of all cellDiff samples — the clip's background activity level. */
function backgroundLevel(diff: number[][]): number {
  const flat: number[] = [];
  for (const row of diff) for (const v of row) flat.push(v);
  if (flat.length === 0) return 0;
  flat.sort((a, b) => a - b);
  return flat[Math.floor(flat.length / 2)]!;
}

function findRuns(diff: number[][], nCells: number, hi: number, lo: number): Run[] {
  const runs: Run[] = [];
  const nPairs = diff.length;
  for (let cell = 0; cell < nCells; cell++) {
    let active = false;
    let start = 0;
    for (let p = 0; p < nPairs; p++) {
      const v = diff[p]![cell]!;
      if (!active && v > hi) {
        active = true;
        start = p;
      } else if (active && v < lo) {
        if (p - start >= MIN_RUN_PAIRS) runs.push({ cell, p0: start, p1: p - 1 });
        active = false;
      }
    }
    if (active && nPairs - start >= MIN_RUN_PAIRS) runs.push({ cell, p0: start, p1: nPairs - 1 });
  }
  return runs;
}

/** Union-find grouping of runs adjacent in space (4-neighbour) and overlapping in time. */
function groupRuns(runs: Run[], cols: number): Run[][] {
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const rc = (cell: number) => ({ r: Math.floor(cell / cols), c: cell % cols });
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i]!;
      const b = runs[j]!;
      const ra = rc(a.cell);
      const rb = rc(b.cell);
      const sameCell = a.cell === b.cell;
      const adjacent = sameCell || Math.abs(ra.r - rb.r) + Math.abs(ra.c - rb.c) === 1;
      // The generous slack bridges an intra-gesture lull (a pop's velocity-≈0
      // peak) only within the SAME cell. Across adjacent cells it must be a
      // single simultaneous object, so require real temporal overlap (slack 1)
      // — otherwise closely-spaced staggered reveals in neighbouring cells
      // would merge into one over-long event.
      const slack = sameCell ? TEMPORAL_SLACK : 1;
      const temporal = a.p0 <= b.p1 + slack && b.p0 <= a.p1 + slack;
      if (adjacent && temporal) union(i, j);
    }
  }
  const groups = new Map<number, Run[]>();
  runs.forEach((run, i) => {
    const root = find(i);
    (groups.get(root) ?? groups.set(root, []).get(root)!).push(run);
  });
  return [...groups.values()];
}

export function extractMotionSketch(profile: MotionProfile): MotionSketch {
  const fps = profile.fps;
  const duration = (profile.framePairs + 1) / fps;
  const rhythm = {
    periodicityHz: profile.summary.diffPeriodicityHz,
    beatCount: 0,
  };
  if (!profile.grid) {
    return { duration, fps, events: [], rhythm };
  }
  const { spec, diff, occupancy } = profile.grid;
  const nCells = spec.cols * spec.rows;
  const nFrames = occupancy.length;

  // background-relative thresholds (upward-only from the calibrated floor)
  const hi = Math.max(HI_FLOOR, backgroundLevel(diff) + NOISE_MARGIN);
  const lo = hi * HI_LO_RATIO;
  const groups = groupRuns(findRuns(diff, nCells, hi, lo), spec.cols);

  const events: MotionEvent[] = groups.map((group) => {
    const cells = [...new Set(group.map((r) => r.cell))];
    const p0 = Math.min(...group.map((r) => r.p0));
    const p1 = Math.max(...group.map((r) => r.p1));
    const cols = cells.map((c) => c % spec.cols);
    const rows = cells.map((c) => Math.floor(c / spec.cols));
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const region = {
      x: minC / spec.cols,
      y: minR / spec.rows,
      w: (maxC - minC + 1) / spec.cols,
      h: (maxR - minR + 1) / spec.rows,
    };

    // window frame-scalar signals
    const win = <T,>(arr: T[]) => arr.slice(p0, p1 + 1);
    const speeds = win(profile.series.blockSpeedMean);
    const ngrs = win(profile.series.nonGeometricRatio);
    const sats = win(profile.series.saturatedFraction);
    const movingFrac = mean(win(profile.series.movingFraction));

    // per-region occupancy SIGN: start frame vs end frame, over the group's cells
    const occFrame = (f: number) => occupancy[Math.max(0, Math.min(nFrames - 1, f))]!;
    const occAt = (f: number) => mean(cells.map((c) => occFrame(f)[c]!));
    const occStart = occAt(p0);
    const occEnd = occAt(p1 + 1);
    // per-cell net change: in-place transforms return content to the same
    // cells (small); a translation migrates it between cells (large)
    const occStartF = occFrame(p0);
    const occEndF = occFrame(p1 + 1);
    const perCellDelta = mean(cells.map((c) => Math.abs(occEndF[c]! - occStartF[c]!)));
    const inPlace = perCellDelta < INPLACE_RATIO * Math.max(occStart, occEnd, 1);

    let kind: MotionEventKind;
    if (occEnd > occStart * OCC_RATIO) kind = "enter";
    else if (occStart > occEnd * OCC_RATIO) kind = "exit";
    else if (inPlace) {
      // present throughout, content returned to the same cells: a transient
      // (pop) reads as emphasis; a sustained resize as scale
      const occPeak = Math.max(...Array.from({ length: p1 - p0 + 1 }, (_, k) => occAt(p0 + k)));
      const transient = occPeak > Math.max(occStart, occEnd) * 1.1 || Math.max(occStart, occEnd) > 1;
      kind = transient ? "emphasis" : "scale";
    } else if (movingFrac > MOVE_FRACTION) kind = "move";
    else kind = "scale";

    const e = classifyEasing(speeds, ngrs, sats);
    const peakSpeed = Math.max(0, ...win(profile.series.blockSpeedP95));
    const magnitude =
      kind === "enter" || kind === "exit" || kind === "move"
        ? Math.min(1, peakSpeed / 200)
        : Math.min(0.5, Math.abs(occEnd - occStart) / Math.max(1, occStart) + 0.1);

    return {
      t0: p0 / fps,
      t1: (p1 + 1) / fps,
      kind,
      region,
      magnitude,
      easing: { class: e.class, thirdsRatio: e.thirdsRatio, reliable: e.reliable },
    };
  });

  // exclude continuous activity: an event spanning a large fraction of the
  // clip never returned to a static floor, so it is ongoing motion, not a
  // discrete event (real product video always has some ambient activity).
  const maxEventSec = CONTINUOUS_FRAC * duration;
  const discrete = events.filter((e) => e.t1 - e.t0 <= maxEventSec);

  discrete.sort((a, b) => a.t0 - b.t0);
  rhythm.beatCount = discrete.length;
  return { duration, fps, events: discrete, rhythm };
}
