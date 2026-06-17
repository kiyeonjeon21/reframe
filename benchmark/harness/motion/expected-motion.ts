/**
 * Analytic ground truth: sample evaluate() at frame times and derive per-pair
 * motion statistics from op transforms. Never re-implements segment math —
 * evaluate is the single source of truth (behaviors included).
 *
 *   tsx benchmark/harness/motion/expected-motion.ts <scene.ts> [-o out.json]
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compileScene,
  evaluate,
  type DisplayOp,
  type SceneIR,
} from "@reframe/core";

interface OpPoints {
  id: string;
  /** 5 representative points (4 corners + center) in scene px. */
  points: [number, number][];
  opacity: number;
  /** Approximate covered area in scene px² (|det| × local area). */
  area: number;
}

const apply = (m: number[], x: number, y: number): [number, number] => [
  m[0]! * x + m[2]! * y + m[4]!,
  m[1]! * x + m[3]! * y + m[5]!,
];

function opPoints(op: DisplayOp): OpPoints {
  let local: [number, number, number, number]; // x, y, w, h in local coords
  switch (op.type) {
    case "rect":
    case "ellipse":
    case "image":
    case "video":
      local = [op.offsetX, op.offsetY, op.width, op.height];
      break;
    case "path":
    case "matte-push":
    case "matte-sep":
    case "matte-pop":
      // No geometry (path bbox / matte markers) — treat as a zero-area point.
      local = [0, 0, 0, 0];
      break;
    case "line": {
      const points: [number, number][] = [
        apply(op.transform, op.x1, op.y1),
        apply(op.transform, op.x2, op.y2),
      ];
      const len = Math.hypot(op.x2 - op.x1, op.y2 - op.y1);
      return { id: op.id, points, opacity: op.opacity, area: len * op.strokeWidth };
    }
    case "text": {
      // Approximate metrics: enough for representative-point velocity.
      const w = 0.58 * op.fontSize * op.content.length + op.letterSpacing * Math.max(0, op.content.length - 1);
      const h = op.fontSize;
      const x0 = op.align === "right" ? -w : op.align === "center" ? -w / 2 : 0;
      const y0 = op.baseline === "bottom" ? -h : op.baseline === "middle" ? -h / 2 : 0;
      local = [x0, y0, w, h];
      break;
    }
  }
  const [x, y, w, h] = local;
  const corners: [number, number][] = [
    [x, y], [x + w, y], [x + w, y + h], [x, y + h], [x + w / 2, y + h / 2],
  ];
  const m = op.transform;
  const det = Math.abs(m[0]! * m[3]! - m[1]! * m[2]!);
  return {
    id: op.id,
    points: corners.map(([px, py]) => apply(m, px, py)),
    opacity: op.opacity,
    area: det * w * h,
  };
}

export interface ExpectedMotion {
  fps: number;
  duration: number;
  framePairs: number;
  /** Pair k covers t in [k/fps, (k+1)/fps]; reported at (k+0.5)/fps. */
  series: {
    t: number[];
    /** Area-weighted mean speed of visible ops (px/frame). */
    expectedMeanSpeed: number[];
    /** Same, but only ops moving > 0.25 px/frame (matches measured "moving"). */
    expectedMeanSpeedMoving: number[];
    expectedPeakSpeed: number[];
    /** Σ area·|Δopacity| — correlates with diff energy during fades. */
    expectedFadeEnergy: number[];
  };
}

export function computeExpectedMotion(ir: SceneIR, fps = 30): ExpectedMotion {
  const compiled = compileScene(ir);
  const frameCount = Math.max(1, Math.round(compiled.duration * fps));
  const series: ExpectedMotion["series"] = {
    t: [],
    expectedMeanSpeed: [],
    expectedMeanSpeedMoving: [],
    expectedPeakSpeed: [],
    expectedFadeEnergy: [],
  };

  let prev = evaluate(compiled, 0).map(opPoints);
  for (let k = 0; k + 1 < frameCount; k++) {
    const next = evaluate(compiled, (k + 1) / fps).map(opPoints);
    const prevById = new Map(prev.map((p) => [p.id, p]));

    let weighted = 0;
    let weightedMoving = 0;
    let weight = 0;
    let weightMoving = 0;
    let peak = 0;
    let fade = 0;
    for (const cur of next) {
      const before = prevById.get(cur.id);
      if (!before) continue;
      const opacity = Math.max(cur.opacity, before.opacity);
      fade += cur.area * Math.abs(cur.opacity - before.opacity);
      if (opacity <= 0.05) continue;
      // Opacity-weighted: a barely visible op contributes barely visible
      // pixels, and the measurement side only sees pixels (calibration C6
      // refuted the earlier binary-visibility gate).
      const w = cur.area * opacity;
      const speed =
        cur.points.reduce(
          (sum, [x, y], i) => sum + Math.hypot(x - before.points[i]![0], y - before.points[i]![1]),
          0,
        ) / cur.points.length;
      weighted += w * speed;
      weight += w;
      if (speed > 0.25) {
        weightedMoving += w * speed;
        weightMoving += w;
      }
      peak = Math.max(peak, speed);
    }
    series.t.push((k + 0.5) / fps);
    series.expectedMeanSpeed.push(weight > 0 ? weighted / weight : 0);
    series.expectedMeanSpeedMoving.push(weightMoving > 0 ? weightedMoving / weightMoving : 0);
    series.expectedPeakSpeed.push(peak);
    series.expectedFadeEnergy.push(fade);
    prev = next;
  }

  return { fps, duration: compiled.duration, framePairs: series.t.length, series };
}

async function main() {
  const [scenePath, ...rest] = process.argv.slice(2);
  if (!scenePath) {
    console.error("usage: tsx expected-motion.ts <scene.ts> [-o out.json] [--fps N]");
    process.exit(2);
  }
  let out: string | null = null;
  let fps = 30;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "-o") out = rest[++i]!;
    else if (rest[i] === "--fps") fps = Number(rest[++i]);
  }
  const mod = (await import(pathToFileURL(resolve(scenePath)).href)) as { default: SceneIR };
  const expected = computeExpectedMotion(mod.default, fps);
  const json = JSON.stringify(expected, null, 1);
  if (out) await writeFile(out, json);
  else console.log(json);
}

if (process.argv[1]?.endsWith("expected-motion.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
