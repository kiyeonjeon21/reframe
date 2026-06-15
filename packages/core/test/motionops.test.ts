import { describe, expect, it } from "vitest";
import { scene, rect, wait, par } from "../src/dsl.js";
import { motionOp, MOTION_OPS } from "../src/motionOps.js";
import { composeScene } from "../src/compose.js";
import { compileScene } from "../src/compile.js";
import { evaluate } from "../src/evaluate.js";
import type { SceneIR } from "../src/ir.js";

const size = { width: 400, height: 300 };
const box = () => rect({ id: "box", x: 100, y: 100, width: 60, height: 60, fill: "#fff" });
const baseScene = (): SceneIR =>
  scene({ id: "s", size, fps: 30, nodes: [box()], timeline: wait(1) });

const scaleOf = (op: { transform: number[] }) => Math.hypot(op.transform[0]!, op.transform[1]!);
const opFor = (compiled: ReturnType<typeof compileScene>, t: number) =>
  evaluate(compiled, t).find((o) => o.id === "box")!;

describe("motionOp", () => {
  it("every op returns a labeled beat targeting the node", () => {
    for (const name of MOTION_OPS) {
      const r = motionOp(name, "box", { base: { scale: 1, x: 100, y: 100 } });
      expect(r.timeline.kind).toBe("beat");
      expect((r.timeline as { name: string }).name).toBe(`op-${name}-box`);
    }
    // entrance ops carry a setup (start state)
    expect(motionOp("fade", "box").setup).toEqual({ box: { opacity: 0 } });
    expect(motionOp("draw-on", "box").setup).toEqual({ box: { progress: 0 } });
  });

  it("is reproducible — same (name,target,opts) → identical IR", () => {
    for (const name of MOTION_OPS) {
      const a = JSON.stringify(motionOp(name, "box", { energy: 0.6, amount: 1.2 }));
      const b = JSON.stringify(motionOp(name, "box", { energy: 0.6, amount: 1.2 }));
      expect(a).toBe(b);
    }
  });
});

describe("addTimeline overlay verb", () => {
  it("appends a motion op to the scene (ken-burns drifts scale + position)", () => {
    const op = motionOp("ken-burns", "box", { amount: 1, base: { scale: 1, x: 100, y: 100 } });
    const { ir, report } = composeScene(baseScene(), { reframeOverlay: 1, addTimeline: [op.timeline] });
    expect(report.orphans).toEqual([]);
    expect(report.applied.some((a) => a.action === "add-timeline")).toBe(true);
    const c = compileScene(ir);
    const end = opFor(c, c.duration * 0.95);
    expect(scaleOf(end)).toBeGreaterThan(1.03); // zoomed in
    expect(end.transform[4]).toBeGreaterThan(100); // panned right
  });

  it("a fragment whose target is gone orphans loudly (not silently dropped)", () => {
    const { report } = composeScene(baseScene(), {
      reframeOverlay: 1,
      addTimeline: [motionOp("rotate", "ghost").timeline],
    });
    expect(report.orphans.some((o) => o.address.startsWith("addTimeline"))).toBe(true);
  });

  it("an editor-added op folds to code byte-identical to its overlay render", () => {
    const op = motionOp("zoom", "box", { amount: 1, base: { scale: 1 } });
    // (a) added via overlay
    const added = composeScene(baseScene(), { reframeOverlay: 1, addTimeline: [op.timeline] }).ir;
    // (b) the same fragment folded into the scene timeline literal
    const folded = scene({ id: "s", size, fps: 30, nodes: [box()], timeline: par(wait(1), op.timeline) });
    const ca = compileScene(added);
    const cf = compileScene(folded);
    expect(ca.duration).toBe(cf.duration);
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      expect(evaluate(ca, ca.duration * frac)).toEqual(evaluate(cf, cf.duration * frac));
    }
  });
});
