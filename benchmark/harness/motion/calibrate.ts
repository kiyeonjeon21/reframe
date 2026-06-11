/**
 * Calibration gates C1..C7: verify the hand-rolled motion analyzer against
 * the analytic ground truth before trusting it on anything else.
 *
 *   tsx benchmark/harness/motion/calibrate.ts [--skip-render]
 *
 * Renders the calibration scenes (PNG frames + mp4), computes expected
 * motion from the IR, analyzes both inputs, checks the gates, and writes
 * calibration/calibration.json with the derived mp4 thresholds.
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { SceneIR } from "@reframe/core";
import { analyzeMotion, classifyEasing, type MotionProfile, type Segment } from "./analyze.js";
import { computeExpectedMotion, type ExpectedMotion } from "./expected-motion.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const CLI = join(ROOT, "packages", "render-cli", "src", "cli.ts");
const WORK = join(HERE, "calibration", "work");

interface SceneSpec {
  name: string;
  path: string;
  segments: Segment[];
}

const SCENES: SceneSpec[] = [
  {
    name: "cal-ease",
    path: join(HERE, "calibration", "scenes", "cal-ease.ts"),
    segments: [
      { t0: 0.35, t1: 1.45, label: "seg-linear" },
      { t0: 2.05, t1: 3.15, label: "seg-out" },
      { t0: 3.75, t1: 4.85, label: "seg-in" },
    ],
  },
  {
    name: "cal-teleport",
    path: join(HERE, "calibration", "scenes", "cal-teleport.ts"),
    segments: [],
  },
  {
    name: "cal-fade",
    path: join(HERE, "calibration", "scenes", "cal-fade.ts"),
    segments: [
      { t0: 0.55, t1: 1.45, label: "fade-out" },
      { t0: 2.15, t1: 3.05, label: "fade-in" },
    ],
  },
  {
    name: "cal-micro",
    path: join(HERE, "calibration", "scenes", "cal-micro.ts"),
    segments: [],
  },
  {
    name: "logo-reveal",
    path: join(ROOT, "examples", "scenes", "logo-reveal.ts"),
    segments: [{ t0: 0.05, t1: 1.0, label: "reveal" }],
  },
  {
    name: "kinetic-typo",
    path: join(ROOT, "examples", "scenes", "kinetic-typo.ts"),
    segments: [{ t0: 2.55, t1: 3.0, label: "scatter" }],
  },
];

const results: { gate: string; ok: boolean; detail: string }[] = [];
const gate = (name: string, ok: boolean, detail: string) => {
  results.push({ gate: name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i]! - mx) * (ys[i]! - my);
    vx += (xs[i]! - mx) ** 2;
    vy += (ys[i]! - my) ** 2;
  }
  return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
}

function exec(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const proc = spawn("npx", args, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d: Buffer) => (err += d.toString()));
    proc.on("close", (c) => (c === 0 ? res() : rej(new Error(err.slice(-800)))));
  });
}

/** Pair indices inside a segment. */
const segIdx = (p: MotionProfile, seg: Segment) =>
  p.series.t.map((t, i) => (t >= seg.t0 && t <= seg.t1 ? i : -1)).filter((i) => i >= 0);

async function main() {
  const skipRender = process.argv.includes("--skip-render");
  await mkdir(WORK, { recursive: true });

  const data = new Map<
    string,
    { expected: ExpectedMotion; png: MotionProfile; mp4: MotionProfile; spec: SceneSpec }
  >();

  for (const spec of SCENES) {
    const framesDir = join(WORK, spec.name, "frames");
    const mp4 = join(WORK, spec.name, "out.mp4");
    if (!skipRender || !existsSync(mp4)) {
      await mkdir(join(WORK, spec.name), { recursive: true });
      console.log(`rendering ${spec.name}...`);
      await exec(["tsx", CLI, "ir", spec.path, "-o", mp4, "--frames-dir", framesDir]);
    }
    const ir = ((await import(pathToFileURL(spec.path).href)) as { default: SceneIR }).default;
    const expected = computeExpectedMotion(ir);
    const png = await analyzeMotion(framesDir, { segments: spec.segments });
    const mp4Profile = await analyzeMotion(mp4, { segments: spec.segments, changedThreshold: 6 });
    data.set(spec.name, { expected, png, mp4: mp4Profile, spec });
  }

  // ---------- C1: speed accuracy on cal-ease ----------
  {
    const { expected, png, spec } = data.get("cal-ease")!;
    const segErr: string[] = [];
    let allCorr = true;
    let allErr = true;
    for (const seg of spec.segments) {
      const idx = segIdx(png, seg);
      const measured = idx.map((i) => png.series.blockSpeedMean[i]!);
      const truth = idx.map((i) => expected.series.expectedMeanSpeedMoving[i]!);
      const live = idx.map((_, j) => j).filter((j) => truth[j]! > 2);
      // Pearson is meaningless on a constant-speed segment (no GT variance).
      const truthStd = Math.sqrt(
        mean(live.map((j) => (truth[j]! - mean(live.map((k) => truth[k]!))) ** 2)),
      );
      const corr =
        truthStd > 1 ? pearson(live.map((j) => measured[j]!), live.map((j) => truth[j]!)) : null;
      const relErr = Math.abs(mean(measured) - mean(truth)) / mean(truth);
      segErr.push(
        `${seg.label}: r=${corr === null ? "n/a" : corr.toFixed(3)} err=${(relErr * 100).toFixed(1)}%`,
      );
      if (corr !== null && corr < 0.98) allCorr = false;
      if (relErr > 0.1) allErr = false;
    }
    gate("C1 speed accuracy", allCorr && allErr, segErr.join("  "));
  }

  // ---------- C2: easing classification ----------
  {
    const { png } = data.get("cal-ease")!;
    const classes = png.segments.map((s) => `${s.label}=${s.easing.class}`);
    const ok =
      png.segments.find((s) => s.label === "seg-linear")?.easing.class === "linear" &&
      png.segments.find((s) => s.label === "seg-out")?.easing.class === "decelerating" &&
      png.segments.find((s) => s.label === "seg-in")?.easing.class === "accelerating";
    gate("C2 easing classification", ok, classes.join("  "));
  }

  // ---------- C3: discontinuity detection ----------
  {
    const { png } = data.get("cal-teleport")!;
    const spikeTimes = png.summary.spikes.map((s) => s.t.toFixed(2));
    const oneSpikeAtJump =
      png.summary.spikes.length === 1 && Math.abs(png.summary.spikes[0]!.t - 1.0) < 0.1;
    const falsePositives = SCENES.filter((s) => s.name !== "cal-teleport")
      .map((s) => data.get(s.name)!.png.summary.spikes.length)
      .reduce((a, b) => a + b, 0);
    gate(
      "C3 discontinuity",
      oneSpikeAtJump && falsePositives === 0,
      `teleport spikes@[${spikeTimes.join(",")}] falsePositives=${falsePositives}`,
    );
  }

  // ---------- C4: fade separation ----------
  {
    const { expected, png, spec } = data.get("cal-fade")!;
    const fadeIdx = spec.segments.flatMap((seg) => segIdx(png, seg));
    const mf = mean(fadeIdx.map((i) => png.series.movingFraction[i]!));
    const ngr = mean(fadeIdx.map((i) => png.series.nonGeometricRatio[i]!));
    const corr = pearson(png.series.diffMean, expected.series.expectedFadeEnergy);
    // ngr threshold 0.65: glyph strokes are self-similar, so a shifted match
    // on fading text accidentally explains ~25-30% of the SAD. The decisive
    // fade discriminator is the absence of displacement (movingFraction).
    gate(
      "C4 fade separation",
      mf <= 0.02 && ngr >= 0.65 && corr >= 0.9,
      `movingFraction=${mf.toFixed(3)} ngr=${ngr.toFixed(2)} diff-vs-fadeGT r=${corr.toFixed(3)}`,
    );
  }

  // ---------- C5: micro-pulse ----------
  {
    const { png } = data.get("cal-micro")!;
    const hz = png.summary.diffPeriodicityHz;
    gate(
      "C5 micro-pulse",
      // A 0.5 px/frame peak oscillation is sub-visibility near the sine
      // peaks, so many pairs legitimately read static — the periodicity is
      // the detector; staticFraction only guards "essentially frozen".
      !png.summary.allStatic &&
        png.summary.staticFraction < 0.9 &&
        hz !== null &&
        hz > 0.3 &&
        hz < 0.5,
      `allStatic=${png.summary.allStatic} staticFraction=${png.summary.staticFraction.toFixed(2)} periodicity=${hz?.toFixed(2) ?? "none"}Hz`,
    );
  }

  // ---------- C6: integration scenes ----------
  {
    // Block matching is a translation model: scaling text (kinetic-typo's
    // punch-in pops) is systematically underestimated, so the integration
    // bar is r>=0.8 everywhere with at least one scene >=0.95.
    const detail: string[] = [];
    let ok = true;
    const corrs: number[] = [];
    for (const name of ["logo-reveal", "kinetic-typo"]) {
      const { expected, png } = data.get(name)!;
      // Compare where geometry dominates: unsaturated pairs with measurable
      // GT motion that are not fade-dominant (fades are diff's job, C4).
      const live = png.series.t
        .map((_, i) => i)
        .filter(
          (i) =>
            png.series.saturatedFraction[i]! < 0.3 &&
            png.series.nonGeometricRatio[i]! < 0.6 &&
            expected.series.expectedMeanSpeedMoving[i]! > 1,
        );
      const corr = pearson(
        live.map((i) => png.series.blockSpeedMean[i]!),
        live.map((i) => expected.series.expectedMeanSpeedMoving[i]!),
      );
      detail.push(`${name}: r=${corr.toFixed(3)} (n=${live.length})`);
      corrs.push(corr);
      if (corr < 0.8) ok = false;
    }
    if (!corrs.some((c) => c >= 0.95)) ok = false;
    // logo-reveal's reveal mixes fades with motion; "unreliable" is the
    // designed loud answer there (pure-geometry classification is C2's job).
    const reveal = data.get("logo-reveal")!.png.segments[0]!.easing.class;
    const scatter = data.get("kinetic-typo")!.png.segments[0]!.easing.class;
    detail.push(`reveal=${reveal} scatter=${scatter}`);
    if (!["decelerating", "unreliable"].includes(reveal)) ok = false;
    if (!["accelerating", "unreliable"].includes(scatter)) ok = false;
    gate("C6 integration", ok, detail.join("  "));
  }

  // ---------- C7: codec noise ----------
  {
    // Threshold from static pairs of mp4 cal scenes; flow stability on moving pairs.
    const staticDiffs: number[] = [];
    const flowRelDiffs: number[] = [];
    for (const name of ["cal-ease", "cal-fade", "cal-teleport"]) {
      const { png, mp4 } = data.get(name)!;
      for (let i = 0; i < png.framePairs; i++) {
        if (png.series.changedFraction[i]! < 0.001) {
          staticDiffs.push(mp4.series.diffMean[i]!);
        }
        const p = png.series.blockSpeedMean[i]!;
        const m = mp4.series.blockSpeedMean[i]!;
        if (p > 4) flowRelDiffs.push(Math.abs(m - p) / p);
      }
    }
    staticDiffs.sort((a, b) => a - b);
    flowRelDiffs.sort((a, b) => a - b);
    const staticP99 = staticDiffs[Math.floor(staticDiffs.length * 0.99)] ?? 0;
    const medRel = flowRelDiffs[Math.floor(flowRelDiffs.length / 2)] ?? 1;
    const ok = medRel <= 0.1 && staticDiffs.length > 20;
    gate(
      "C7 codec noise",
      ok,
      `staticDiff p99=${staticP99.toFixed(3)} flow rel-diff median=${(medRel * 100).toFixed(1)}% (n=${flowRelDiffs.length})`,
    );
    if (ok) {
      await writeFile(
        join(HERE, "calibration", "calibration.json"),
        JSON.stringify(
          {
            calibratedAt: "see git history",
            analysis: { width: 480, height: 270, scale: 4, blockSize: 16, searchRadius: 12 },
            mp4: { changedThreshold: 6, staticDiffP99: staticP99, flowRelDiffMedian: medRel },
            gates: Object.fromEntries(results.map((r) => [r.gate.split(" ")[0], r.ok])),
          },
          null,
          2,
        ),
      );
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} gates passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
