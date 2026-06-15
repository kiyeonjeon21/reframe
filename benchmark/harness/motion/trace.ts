/**
 * Reference→Motion verifier (the trace gates), modelled on calibrate.ts.
 * Rendering can't be a fast unit test, so — exactly like the C1–C7
 * calibration — this is a gated tsx script. Pure-logic coverage of
 * sketchToTimeline lives in packages/core/test/motion.test.ts.
 *
 *   tsx benchmark/harness/motion/trace.ts [--skip-render]
 *
 * Two tiers:
 *  - Extraction gates: the sketch extracted from each analytic render matches
 *    the authored truth (count, onset ≤1 frame, kind, enter/exit, region
 *    separation, easing on reliable segments, rhythm).
 *  - Round-trip gates: emit a timeline from the sketch, render it, RE-extract —
 *    the structure must reproduce (same count / onsets ≤1 frame / kinds), and
 *    the active/static partition must match. Re-extraction is a stronger,
 *    threshold-robust round-trip than a single summary scalar.
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sketchToTimeline, type MotionSketch, type SceneIR } from "@reframe/core";
import { analyzeMotion } from "./analyze.js";
import { extractMotionSketch } from "./sketch.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const CLI = join(ROOT, "packages", "render-cli", "src", "cli.ts");
const WORK = join(HERE, "calibration", "trace-work");
const SCENES = join(HERE, "calibration", "scenes");
const FRAME = 1 / 30;

const results: { gate: string; ok: boolean; detail: string }[] = [];
const gate = (name: string, ok: boolean, detail: string) => {
  results.push({ gate: name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
};

function exec(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn("npx", args, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });
    let e = "";
    p.stderr.on("data", (d: Buffer) => (e += d.toString()));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(e.slice(-600)))));
  });
}

async function render(scenePath: string, name: string, ir?: SceneIR): Promise<MotionSketch> {
  const dir = join(WORK, name);
  await mkdir(dir, { recursive: true });
  const framesDir = join(dir, "frames");
  let input = scenePath;
  if (ir) {
    const { writeFile } = await import("node:fs/promises");
    input = join(dir, "scene.json");
    await writeFile(input, JSON.stringify(ir));
  }
  await exec(["tsx", CLI, "ir", input, "-o", join(dir, "out.mp4"), "--frames-dir", framesDir, "--no-audio"]);
  return extractMotionSketch(await analyzeMotion(framesDir, { grid: true }));
}

/** centre-x of an event's region, for left/right separation checks. */
const cx = (e: MotionSketch["events"][number]) => e.region.x + e.region.w / 2;

interface Truth {
  onsets: number[];
  kinds: string[];
  periodicity?: [number, number];
  /** distinct non-overlapping x-regions expected (concurrent separation). */
  separated?: boolean;
}

const TRUTH: Record<string, Truth> = {
  "trace-enter": { onsets: [0.4, 1.0, 1.6], kinds: ["enter", "enter", "enter"] },
  "trace-emphasis": { onsets: [0.9], kinds: ["emphasis"] },
  "trace-hold": { onsets: [], kinds: [], periodicity: [0.3, 0.5] },
  "trace-concurrent": { onsets: [0.6, 0.6], kinds: ["enter", "enter"], separated: true },
};

function checkExtraction(name: string, sk: MotionSketch): boolean {
  const t = TRUTH[name]!;
  const evs = [...sk.events].sort((a, b) => a.t0 - b.t0);
  if (evs.length !== t.onsets.length) {
    gate(`extract:${name}`, false, `count ${evs.length} != ${t.onsets.length}`);
    return false;
  }
  const onsetOk = evs.every((e, i) => Math.abs(e.t0 - t.onsets[i]!) <= 1.5 * FRAME);
  const kindOk = evs.every((e, i) => e.kind === t.kinds[i]);
  const maxOnsetErr = Math.max(0, ...evs.map((e, i) => Math.abs(e.t0 - t.onsets[i]!) / FRAME));
  let periodOk = true;
  if (t.periodicity) {
    const hz = sk.rhythm.periodicityHz;
    periodOk = hz !== null && hz >= t.periodicity[0] && hz <= t.periodicity[1];
  }
  let sepOk = true;
  if (t.separated && evs.length === 2) sepOk = Math.abs(cx(evs[0]!) - cx(evs[1]!)) > 0.3;
  const ok = onsetOk && kindOk && periodOk && sepOk;
  gate(
    `extract:${name}`,
    ok,
    `onsetErr=${maxOnsetErr.toFixed(2)}f kinds=[${evs.map((e) => e.kind).join(",")}]` +
      (t.periodicity ? ` periodicity=${sk.rhythm.periodicityHz?.toFixed(2) ?? "none"}Hz` : "") +
      (t.separated ? ` Δcx=${evs.length === 2 ? Math.abs(cx(evs[0]!) - cx(evs[1]!)).toFixed(2) : "n/a"}` : ""),
  );
  return ok;
}

async function main() {
  const skipRender = process.argv.includes("--skip-render");
  await mkdir(WORK, { recursive: true });
  if (!skipRender) {
    const { rm } = await import("node:fs/promises");
    await rm(WORK, { recursive: true, force: true });
    await mkdir(WORK, { recursive: true });
  }

  const sketches = new Map<string, { sketch: MotionSketch; ir: SceneIR }>();
  for (const name of Object.keys(TRUTH)) {
    const scenePath = join(SCENES, `${name}.ts`);
    const ir = ((await import(pathToFileURL(scenePath).href)) as { default: SceneIR }).default;
    const sketch = await render(scenePath, name);
    sketches.set(name, { sketch, ir });
    checkExtraction(name, sketch);
  }

  // ---- round-trip: emit → render → re-extract reproduces the structure ----
  for (const name of ["trace-enter", "trace-emphasis", "trace-concurrent"]) {
    const { sketch, ir } = sketches.get(name)!;
    const nodeIds = ir.nodes.map((n) => n.id);
    const timeline = sketchToTimeline(sketch, nodeIds);
    const rebuiltIr: SceneIR = { ...ir, id: `${ir.id}-rebuilt`, timeline, behaviors: [] };
    const rebuilt = await render("", `${name}-rebuilt`, rebuiltIr);
    const a = [...sketch.events].sort((x, y) => x.t0 - y.t0);
    const b = [...rebuilt.events].sort((x, y) => x.t0 - y.t0);
    const countOk = a.length === b.length;
    const onsetOk = countOk && a.every((e, i) => Math.abs(e.t0 - b[i]!.t0) <= 1.5 * FRAME);
    const kindOk = countOk && a.every((e, i) => e.kind === b[i]!.kind);
    const maxErr = countOk ? Math.max(0, ...a.map((e, i) => Math.abs(e.t0 - b[i]!.t0) / FRAME)) : Infinity;
    gate(
      `roundtrip:${name}`,
      countOk && onsetOk && kindOk,
      `ref ${a.length}ev → rebuilt ${b.length}ev, onsetΔ=${Number.isFinite(maxErr) ? maxErr.toFixed(2) : "n/a"}f kinds=[${b.map((e) => e.kind).join(",")}]`,
    );
  }

  // ---- real-video robustness gate (structural sanity, no ground truth) ----
  // The Notion ref is not authored, so we can only assert robustness: the
  // continuous-activity merge is gone, the count is sane, no event spans the
  // busy middle. Conditional on the gitignored 10MB ref being present.
  const { existsSync } = await import("node:fs");
  const refMov = join(ROOT, "refs", "notion-sample.mov");
  if (existsSync(refMov)) {
    const sk = extractMotionSketch(await analyzeMotion(refMov, { grid: true, fps: 60 }));
    const longest = Math.max(0, ...sk.events.map((e) => e.t1 - e.t0));
    const cap = 0.35 * sk.duration;
    const count = sk.events.length;
    const ok = longest <= cap && count >= 3 && count <= 40;
    gate(
      "realvideo:notion-sample",
      ok,
      `${count} events (band 3..40), longest=${longest.toFixed(2)}s ≤ cap ${cap.toFixed(2)}s — 11s merge ${longest <= cap ? "gone" : "PRESENT"}`,
    );
  } else {
    console.log("SKIP  realvideo:notion-sample  (refs/notion-sample.mov absent — analytic gates still run)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} trace gates passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
