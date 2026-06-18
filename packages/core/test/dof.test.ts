import { describe, expect, it } from "vitest";
import { evaluate } from "../src/evaluate.js";
import { scene, rect, seq, tween } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";

const size = { width: 1000, height: 800 };
const blurOf = (s: ReturnType<typeof scene>, t: number, id: string): number | undefined =>
  (evaluate(compileScene(s), t).find((o) => o.id === id) as { blur?: number }).blur;

const r = (id: string, z: number, extra: Record<string, unknown> = {}) =>
  rect({ id, x: 500, y: 400, width: 100, height: 100, anchor: "center", fill: "#fff", z, ...extra });

describe("depth of field (z-blur)", () => {
  it("BYTE-IDENTITY GUARD: depth + perspective without aperture adds no blur", () => {
    const withDepth = scene({ id: "a", size, camera: { perspective: 900 }, nodes: [r("near", 0), r("far", 600)] });
    // neither op carries a blur field
    expect(blurOf(withDepth, 0, "near")).toBeUndefined();
    expect(blurOf(withDepth, 0, "far")).toBeUndefined();
    // explicit aperture: 0 is identical to omitting it
    const apZero = scene({ id: "a", size, camera: { perspective: 900, aperture: 0 }, nodes: [r("near", 0), r("far", 600)] });
    expect(JSON.stringify(evaluate(compileScene(apZero), 0))).toBe(
      JSON.stringify(evaluate(compileScene(withDepth), 0)),
    );
  });

  it("aperture without perspective is inert (DOF needs the projection path)", () => {
    const noPersp = scene({ id: "a", size, camera: { aperture: 0.02, focus: 0 }, nodes: [r("far", 600)] });
    expect(blurOf(noPersp, 0, "far")).toBeUndefined();
  });

  it("the focal plane is sharp; blur grows with depth distance", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, aperture: 0.02, focus: 0 },
      nodes: [r("focal", 0), r("mid", 200), r("far", 600)],
    });
    expect(blurOf(s, 0, "focal")).toBeUndefined(); // |0-0|·a = 0 ⇒ no blur field
    expect(blurOf(s, 0, "mid")).toBeCloseTo(0.02 * 200, 9); // 4
    expect(blurOf(s, 0, "far")).toBeCloseTo(0.02 * 600, 9); // 12
  });

  it("focus can sit at a non-zero depth (near layers then soften)", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, aperture: 0.05, focus: 300 },
      nodes: [r("near", 0), r("on", 300), r("far", 500)],
    });
    expect(blurOf(s, 0, "near")).toBeCloseTo(0.05 * 300, 9); // 15
    expect(blurOf(s, 0, "on")).toBeUndefined(); // exactly in focus
    expect(blurOf(s, 0, "far")).toBeCloseTo(0.05 * 200, 9); // 10
  });

  it("DOF blur composes additively with authored blur", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, aperture: 0.02, focus: 0 },
      nodes: [r("far", 600, { blur: 5 })],
    });
    expect(blurOf(s, 0, "far")).toBeCloseTo(5 + 0.02 * 600, 9); // 17
  });

  it("rack focus: animating camera.focus moves which layer is sharp", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, aperture: 0.05, focus: 0 },
      nodes: [r("near", 0), r("far", 400)],
      // pull focus from the near plane (0) back to the far plane (400) over 1s
      timeline: seq(tween("camera", { focus: 400 }, { duration: 1 })),
    });
    // start: near sharp, far blurred
    expect(blurOf(s, 0, "near")).toBeUndefined();
    expect(blurOf(s, 0, "far")).toBeCloseTo(0.05 * 400, 6);
    // end: far sharp, near blurred — the focus has racked
    expect(blurOf(s, 1, "far")).toBeUndefined();
    expect(blurOf(s, 1, "near")).toBeCloseTo(0.05 * 400, 6);
  });
});
