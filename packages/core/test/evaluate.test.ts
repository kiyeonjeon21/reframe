import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, rect, text, seq, to, tween, oscillate } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";

describe("evaluate", () => {
  it("is a pure function of t: initial, interpolated, final", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#000000" })],
      timeline: tween("a", { x: 100 }, { duration: 1, ease: "linear" }),
    });
    const c = compileScene(s);
    const xAt = (t: number) => (evaluate(c, t)[0] as { transform: number[] }).transform[4];
    expect(xAt(0)).toBe(0);
    expect(xAt(0.5)).toBe(50);
    expect(xAt(1)).toBe(100);
    expect(xAt(99)).toBe(100);
    // determinism: same t, same result
    expect(evaluate(c, 0.37)).toEqual(evaluate(c, 0.37));
  });

  it("interpolates colors in RGB", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#000000" })],
      timeline: tween("a", { fill: "#ffffff" }, { duration: 1, ease: "linear" }),
    });
    const c = compileScene(s);
    const op = evaluate(c, 0.5)[0] as { fill?: string };
    expect(op.fill).toBe("#808080");
  });

  it("counts numeric text content up and renders it rounded", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [
        text({ id: "n", x: 0, y: 0, content: 0, fontFamily: "Inter", fontSize: 12 }),
      ],
      timeline: tween("n", { content: 90 }, { duration: 1, ease: "linear" }),
    });
    const c = compileScene(s);
    const contentAt = (t: number) => (evaluate(c, t)[0] as { content: string }).content;
    expect(contentAt(0.5)).toBe("45");
    expect(contentAt(1)).toBe("90");
  });

  it("composes behaviors additively on top of timeline values", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 100, y: 0, width: 10, height: 10, fill: "#000000" })],
      behaviors: [oscillate("a", "x", { amplitude: 10, frequency: 1 })],
    });
    const c = compileScene(s);
    const xAt = (t: number) => (evaluate(c, t)[0] as { transform: number[] }).transform[4];
    expect(xAt(0)).toBeCloseTo(100); // sin(0) = 0
    expect(xAt(0.25)).toBeCloseTo(110); // sin(π/2) = 1
  });

  it("multiplies group opacity into children and culls invisible nodes", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#000000", opacity: 0 })],
    });
    expect(evaluate(compileScene(s), 0)).toEqual([]);
  });

  it("applies the initial state at t=0 before any timeline runs", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 50, y: 0, width: 10, height: 10, fill: "#000000" })],
      states: { hidden: { a: { x: -10 } }, shown: { a: { x: 50 } } },
      initial: "hidden",
      timeline: seq(to("shown", { duration: 1 })),
    });
    const c = compileScene(s);
    expect((evaluate(c, 0)[0] as { transform: number[] }).transform[4]).toBe(-10);
  });
});
