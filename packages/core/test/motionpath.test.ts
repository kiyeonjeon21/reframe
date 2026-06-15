import { describe, expect, it } from "vitest";
import { scene, rect, seq, wait, motionPath, tween } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { evaluate } from "../src/evaluate.js";
import { pathPoint, pathTangentAngle, type Pt } from "../src/path.js";

const xy = (compiled: ReturnType<typeof compileScene>, t: number, id = "dot"): [number, number] => {
  const op = evaluate(compiled, t).find((o) => o.id === id)!;
  return [op.transform[4], op.transform[5]]; // top-left anchor → translation is the position
};

const build = (tl: ReturnType<typeof seq>) =>
  compileScene(
    scene({
      id: "mp",
      size: { width: 1000, height: 1000 },
      fps: 30,
      nodes: [rect({ id: "dot", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })],
      timeline: tl,
    }),
  );

describe("MotionPath geometry", () => {
  it("passes through the first and last waypoint at u=0 and u=1", () => {
    const pts: Pt[] = [[100, 100], [400, 50], [800, 600]];
    expect(pathPoint(pts, false, 0)).toEqual([100, 100]);
    expect(pathPoint(pts, false, 1)).toEqual([800, 600]);
  });

  it("interpolates between waypoints (a curve, not a jump)", () => {
    const pts: Pt[] = [[0, 0], [100, 0], [200, 0]];
    const mid = pathPoint(pts, false, 0.5);
    expect(mid[0]).toBeCloseTo(100, 5); // dead-centre of a straight 3-point line
    expect(mid[1]).toBeCloseTo(0, 5);
  });

  it("a single point is constant everywhere", () => {
    const pts: Pt[] = [[42, 7]];
    expect(pathPoint(pts, false, 0)).toEqual([42, 7]);
    expect(pathPoint(pts, false, 0.5)).toEqual([42, 7]);
    expect(pathPoint(pts, false, 1)).toEqual([42, 7]);
  });

  it("tangent angle points along the direction of travel", () => {
    const pts: Pt[] = [[0, 0], [100, 100]]; // heading down-right → +45°
    expect(pathTangentAngle(pts, false, 0.5)).toBeCloseTo(45, 1);
  });

  it("curviness 0 makes straight segments (sharp corners)", () => {
    const pts: Pt[] = [[0, 0], [100, 0], [100, 100]];
    expect(pathPoint(pts, false, 0.25, 0)).toEqual([50, 0]); // dead-centre of the straight first segment
  });

  it("curviness 1 is byte-identical to the default", () => {
    const pts: Pt[] = [[0, 0], [100, 30], [200, 0], [260, 80]];
    for (const u of [0.1, 0.37, 0.6, 0.85]) expect(pathPoint(pts, false, u, 1)).toEqual(pathPoint(pts, false, u));
  });
});

describe("MotionPath driver", () => {
  it("drives a node's x/y from the path start to end over its duration", () => {
    const c = build(seq(motionPath("dot", [[100, 200], [500, 200], [900, 800]], { duration: 1, ease: "linear" })));
    expect(xy(c, 0)).toEqual([100, 200]);
    const [ex, ey] = xy(c, 1);
    expect(ex).toBeCloseTo(900, 4);
    expect(ey).toBeCloseTo(800, 4);
  });

  it("holds the end position after the path completes (no snap back)", () => {
    const c = build(seq(motionPath("dot", [[0, 0], [300, 300]], { duration: 1 }), wait(2)));
    const [ex, ey] = xy(c, 1);
    const [hx, hy] = xy(c, 3); // 2s after the path ended
    expect(hx).toBeCloseTo(ex, 6);
    expect(hy).toBeCloseTo(ey, 6);
  });

  it("autoRotate banks the node along the tangent", () => {
    const c = build(seq(motionPath("dot", [[0, 0], [100, 100]], { duration: 1, autoRotate: true })));
    const op = evaluate(c, 0.5).find((o) => o.id === "dot")!;
    // transform [a,b,...] with rotation θ: a=cos θ, b=sin θ → atan2(b,a) = θ ≈ 45°
    const deg = (Math.atan2(op.transform[1], op.transform[0]) * 180) / Math.PI;
    expect(deg).toBeCloseTo(45, 0);
  });

  it("a later tween chains from the path's end position", () => {
    const c = build(
      seq(
        motionPath("dot", [[0, 0], [400, 0]], { duration: 1, ease: "linear" }),
        tween("dot", { x: 600 }, { duration: 1, ease: "linear" }),
      ),
    );
    expect(xy(c, 1.5)[0]).toBeCloseTo(500, 0); // halfway from 400 → 600
  });

  it("is deterministic — same t yields byte-identical positions", () => {
    const c = build(seq(motionPath("dot", [[0, 0], [250, 700], [900, 100]], { duration: 2 })));
    expect(xy(c, 0.731)).toEqual(xy(c, 0.731));
  });
});
