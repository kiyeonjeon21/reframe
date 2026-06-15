import { describe, expect, it } from "vitest";
import { localMatrix, evaluate } from "../src/evaluate.js";
import { scene, rect, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";

const size = { width: 400, height: 300 };

describe("tilt (scaleX/scaleY/skewX/skewY)", () => {
  it("at defaults, localMatrix is byte-identical to the uniform formula", () => {
    for (const [x, y, rot, scale] of [
      [0, 0, 0, 1],
      [100, 50, 37, 1.4],
      [-12, 8, -123, 0.6],
      [3.5, -9.25, 270, 2],
    ] as const) {
      const r = (rot * Math.PI) / 180;
      const literal: [number, number, number, number, number, number] = [Math.cos(r) * scale, Math.sin(r) * scale, -Math.sin(r) * scale, Math.cos(r) * scale, x, y];
      expect(localMatrix(x, y, rot, scale)).toEqual(literal);
      expect(localMatrix(x, y, rot, scale, 1, 1, 0, 0)).toEqual(literal); // explicit defaults too
    }
  });

  it("skew shears the matrix (off-axis term), scaleX/scaleY make it non-uniform", () => {
    // rotation 0, scale 1, skewX 45° → the c-column picks up tan(45°) ≈ 1
    const sk = localMatrix(0, 0, 0, 1, 1, 1, 45, 0);
    expect([sk[0], sk[1], sk[3], sk[4], sk[5]]).toEqual([1, 0, 1, 0, 0]);
    expect(sk[2]).toBeCloseTo(Math.tan(Math.PI / 4), 12); // the shear term
    // non-uniform scale → the two basis columns have different lengths
    const m = localMatrix(0, 0, 0, 1, 2, 1, 0, 0);
    expect([m[0], m[1], m[2], m[3]]).toEqual([2, 0, 0, 1]);
    expect(Math.hypot(m[0], m[1])).not.toBe(Math.hypot(m[2], m[3]));
  });

  it("a node's rendered transform reflects skew (animatable via props)", () => {
    const s = scene({ id: "s", size, fps: 30, nodes: [rect({ id: "r", x: 100, y: 50, width: 20, height: 20, fill: "#fff", skewX: 45 })], timeline: wait(1) });
    const op = evaluate(compileScene(s), 0).find((o) => o.id === "r")!;
    expect([op.transform[0], op.transform[1], op.transform[3], op.transform[4], op.transform[5]]).toEqual([1, 0, 1, 100, 50]);
    expect(op.transform[2]).toBeCloseTo(1, 12);
  });
});
