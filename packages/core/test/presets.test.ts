import { describe, expect, it } from "vitest";
import { scene, rect, path, group, seq, wait } from "../src/dsl.js";
import { motionPreset, PRESET_NAMES, type PresetName, type PresetRig } from "../src/presets.js";
import { compileScene } from "../src/compile.js";
import { composeScene, type OverlayDoc } from "../src/compose.js";
import { evaluate } from "../src/evaluate.js";
import type { SceneIR, TimelineIR } from "../src/ir.js";

const W = 1080;
const H = 1080;
const DIAG = Math.hypot(W, H);
const RIG: PresetRig = { group: "logo", center: [540, 500], baseScale: 4, fills: ["fill-0"], inks: ["ink-0"] };

function sceneOf(name: PresetName, opts: Partial<Parameters<typeof motionPreset>[1]> = {}): SceneIR {
  return scene({
    id: "preset",
    size: { width: W, height: H },
    fps: 30,
    nodes: [
      group({ id: "logo", x: 540, y: 500, scale: 4 }, [
        rect({ id: "probe", x: 0, y: 0, width: 10, height: 10, fill: "#fff", opacity: 1 }),
        path({ id: "fill-0", d: "M0 0 L10 0 L5 10 Z", originX: 5, originY: 5, x: 0, y: 0, fill: "#58A6FF", opacity: 0 }),
        path({ id: "ink-0", d: "M0 0 L10 0 L5 10 Z", originX: 5, originY: 5, x: 0, y: 0, stroke: "#fff", strokeWidth: 0.5, progress: 0 }),
      ]),
    ],
    timeline: seq(motionPreset(name, { target: RIG, ...opts }), wait(0.5, "tail")),
  });
}

function build(name: PresetName, opts: Partial<Parameters<typeof motionPreset>[1]> = {}) {
  return compileScene(sceneOf(name, opts));
}

/** Find a labeled step (or beat by name) in a timeline tree. */
function findStep(tl: TimelineIR, key: string): TimelineIR | undefined {
  if (("label" in tl && tl.label === key) || (tl.kind === "beat" && tl.name === key)) return tl;
  if ("children" in tl) {
    for (const c of tl.children) {
      const hit = findStep(c, key);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Sample the group's motion via the always-visible probe child. */
function traj(compiled: ReturnType<typeof compileScene>, n = 60) {
  const D = compiled.duration;
  const xs: number[] = [];
  const ys: number[] = [];
  const scales: number[] = [];
  for (let i = 0; i <= n; i++) {
    const op = evaluate(compiled, (i / n) * D).find((o) => o.id === "probe")!;
    const [a, b, , , e, f] = op.transform;
    xs.push(e);
    ys.push(f);
    scales.push(Math.hypot(a, b));
  }
  return { xs, ys, scales, duration: D };
}

/** Normalised position distance between two trajectories (RMS px / diagonal). */
function posDistance(p: ReturnType<typeof traj>, q: ReturnType<typeof traj>): number {
  let sum = 0;
  for (let i = 0; i < p.xs.length; i++) {
    sum += (p.xs[i]! - q.xs[i]!) ** 2 + (p.ys[i]! - q.ys[i]!) ** 2;
  }
  return Math.sqrt(sum / p.xs.length) / DIAG;
}

const SEED_VARIED: PresetName[] = ["reveal-orbit", "slide-bank", "rise-settle"];
// Anti-canning band, calibrated from the measured spread below (see the
// "[anti-canning]" log): distinct (> D_LO, not a clone) AND same family (< D_HI).
const D_LO = 0.003;
const D_HI = 0.25;

describe("motionPreset — seeded generator", () => {
  it("all 6 presets emit a beat", () => {
    for (const name of PRESET_NAMES) {
      const tl = motionPreset(name, { target: RIG });
      expect(tl.kind).toBe("beat");
      expect((tl as { name: string }).name).toBe(name);
    }
  });

  it("is reproducible — same (name,knobs,seed) → identical IR and trajectory", () => {
    for (const name of PRESET_NAMES) {
      const a = JSON.stringify(motionPreset(name, { target: RIG, energy: 0.7, seed: 5 }));
      const b = JSON.stringify(motionPreset(name, { target: RIG, energy: 0.7, seed: 5 }));
      expect(a).toBe(b);
      expect(traj(build(name, { energy: 0.7, seed: 5 }))).toEqual(traj(build(name, { energy: 0.7, seed: 5 })));
    }
  });

  it("anti-canning: 8 seeds are distinct yet the same family", () => {
    for (const name of SEED_VARIED) {
      const ts = Array.from({ length: 8 }, (_, s) => traj(build(name, { seed: s })));
      let lo = Infinity;
      let hi = 0;
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const d = posDistance(ts[i]!, ts[j]!);
          lo = Math.min(lo, d);
          hi = Math.max(hi, d);
        }
      }
      console.log(`[anti-canning] ${name}: pairwise distance ${lo.toFixed(4)}..${hi.toFixed(4)}`);
      expect(lo).toBeGreaterThan(D_LO); // genuinely different, not a clone
      expect(hi).toBeLessThan(D_HI); // still the same preset family, not chaos
    }
  });

  it("energy↑ raises the overshoot peak (monotonic) on punch-in and spin-forge", () => {
    for (const name of ["punch-in", "spin-forge"] as PresetName[]) {
      const peaks = [0, 0.5, 1].map((energy) => {
        const t = build(name, { energy, seed: 2 });
        return Math.max(...traj(t).scales) / RIG.baseScale; // peak relative to settle
      });
      console.log(`[monotonic] ${name}: peaks ${peaks.map((p) => p.toFixed(3)).join(" < ")}`);
      expect(peaks[1]!).toBeGreaterThan(peaks[0]!);
      expect(peaks[2]!).toBeGreaterThan(peaks[1]!);
    }
  });

  it("speed↑ shortens the duration (monotonic)", () => {
    for (const name of PRESET_NAMES) {
      const slow = build(name, { speed: 0.5 }).duration;
      const fast = build(name, { speed: 2 }).duration;
      expect(fast).toBeLessThan(slow);
    }
  });
});

describe("motionPreset — hand edits survive a knob-driven regen", () => {
  const dragged: [number, number][] = [
    [540, 500],
    [120, 120],
    [960, 120],
    [540, 500],
  ];
  const overlay: OverlayDoc = {
    reframeOverlay: 1,
    name: "hand-edits",
    timeline: {
      orbit: { points: dragged }, // a dragged waypoint on the motionPath
      "reveal-orbit": { gap: 0.4 }, // nudged beat timing
    },
  };

  it("the waypoint + beat-timing edits apply to the authored base", () => {
    const { ir, report } = composeScene(sceneOf("reveal-orbit", { energy: 0.3, seed: 1 }), overlay);
    expect(report.orphans).toEqual([]);
    const mp = findStep(ir.timeline!, "orbit") as Extract<TimelineIR, { kind: "motionPath" }>;
    expect(mp.points).toEqual(dragged);
  });

  it("the SAME edits still apply after the base is regenerated with different knobs", () => {
    // change energy + seed = a different base motion, but the labels are stable
    const regenerated = sceneOf("reveal-orbit", { energy: 0.9, seed: 7 });
    const { ir, report } = composeScene(regenerated, overlay);
    expect(report.orphans).toEqual([]); // edits are NOT orphaned by the regen
    const mp = findStep(ir.timeline!, "orbit") as Extract<TimelineIR, { kind: "motionPath" }>;
    expect(mp.points).toEqual(dragged); // the hand-dragged path wins over the regenerated one
    const beat = findStep(ir.timeline!, "reveal-orbit") as Extract<TimelineIR, { kind: "beat" }>;
    expect(beat.gap).toBe(0.4);
  });

  it("a points patch on a non-motionPath step is rejected loudly (not silent)", () => {
    const bad: OverlayDoc = { reframeOverlay: 1, timeline: { tail: { points: dragged } } };
    const { report } = composeScene(sceneOf("reveal-orbit"), bad);
    expect(report.orphans.some((o) => o.address === "timeline.tail.points")).toBe(true);
  });
});
