import { describe, expect, it } from "vitest";
import { scene, path, seq, tween } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { evaluate } from "../src/evaluate.js";

const TRI = "M0 0 L100 0 L50 100 Z";

const pathOp = (compiled: ReturnType<typeof compileScene>, t: number) =>
  evaluate(compiled, t).find((o) => o.id === "logo") as Extract<
    ReturnType<typeof evaluate>[number],
    { type: "path" }
  >;

describe("path node", () => {
  it("emits a path op carrying d, fill/stroke and progress", () => {
    const c = compileScene(
      scene({
        id: "p",
        size: { width: 200, height: 200 },
        fps: 30,
        nodes: [path({ id: "logo", d: TRI, x: 0, y: 0, fill: "#58A6FF", stroke: "#fff", strokeWidth: 3 })],
      }),
    );
    const op = pathOp(c, 0);
    expect(op.type).toBe("path");
    expect(op.d).toBe(TRI);
    expect(op.fill).toBe("#58A6FF");
    expect(op.stroke).toBe("#fff");
    expect(op.strokeWidth).toBe(3);
    expect(op.progress).toBe(1); // default fully drawn
  });

  it("origin offsets the draw frame so scale/rotation pivot at the art centre", () => {
    const c = compileScene(
      scene({
        id: "p",
        size: { width: 200, height: 200 },
        fps: 30,
        nodes: [path({ id: "logo", d: TRI, x: 100, y: 100, originX: 50, originY: 50, scale: 2 })],
      }),
    );
    const m = pathOp(c, 0).transform; // [a,b,c,d,e,f]
    // a d-point (50,50) — the origin — must land exactly at (x,y) = (100,100)
    const px = m[0] * 50 + m[2] * 50 + m[4];
    const py = m[1] * 50 + m[3] * 50 + m[5];
    expect(px).toBeCloseTo(100, 6);
    expect(py).toBeCloseTo(100, 6);
  });

  it("progress animates for draw-on", () => {
    const c = compileScene(
      scene({
        id: "p",
        size: { width: 200, height: 200 },
        fps: 30,
        nodes: [path({ id: "logo", d: TRI, x: 0, y: 0, stroke: "#fff", progress: 0 })],
        timeline: seq(tween("logo", { progress: 1 }, { duration: 1, ease: "linear" })),
      }),
    );
    expect(pathOp(c, 0).progress).toBeCloseTo(0, 6);
    expect(pathOp(c, 0.5).progress).toBeCloseTo(0.5, 6);
    expect(pathOp(c, 1).progress).toBeCloseTo(1, 6);
  });
});
