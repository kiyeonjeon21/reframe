import { describe, expect, it } from "vitest";
import { scene, rect, path, group } from "../src/dsl.js";
import { motionPreset, PRESET_NAMES, type PresetName, type PresetRig } from "../src/presets.js";
import { compileScene } from "../src/compile.js";
import { evaluate } from "../src/evaluate.js";

const W = 1080;
const H = 1080;
const DIAG = Math.hypot(W, H);
const RIG: PresetRig = { group: "logo", center: [540, 500], baseScale: 4, fills: ["fill-0"], inks: ["ink-0"] };

function build(name: PresetName, opts: Partial<Parameters<typeof motionPreset>[1]> = {}) {
  return compileScene(
    scene({
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
      timeline: motionPreset(name, { target: RIG, ...opts }),
    }),
  );
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
