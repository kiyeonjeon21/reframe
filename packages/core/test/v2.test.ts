import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, rect, text, tween, oscillate } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";

describe("contentDecimals", () => {
  it("formats numeric content with fixed decimals during count-up", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [
        text({
          id: "n",
          x: 0,
          y: 0,
          content: 0,
          contentDecimals: 1,
          fontFamily: "Inter",
          fontSize: 12,
        }),
      ],
      timeline: tween("n", { content: 14.0 }, { duration: 1, ease: "linear" }),
    });
    const c = compileScene(s);
    const contentAt = (t: number) => (evaluate(c, t)[0] as { content: string }).content;
    expect(contentAt(0.5)).toBe("7.0");
    expect(contentAt(1)).toBe("14.0");
  });

  it("defaults to integers, matching the pre-v2 behavior", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [text({ id: "n", x: 0, y: 0, content: 7.4, fontFamily: "Inter", fontSize: 12 })],
    });
    expect((evaluate(compileScene(s), 0)[0] as { content: string }).content).toBe("7");
  });
});

describe("behavior time bounds", () => {
  const box = () =>
    rect({ id: "a", x: 100, y: 0, width: 10, height: 10, fill: "#000000" });
  // peak of sin at t=0.25+from when frequency=1... use phase so the carrier is at max
  // throughout: oscillate with frequency 0 is constant 0, so probe with phase=π/2 → sin=1.
  const carrier = { amplitude: 10, frequency: 0, phase: Math.PI / 2 }; // constant +10

  const xAt = (s: ReturnType<typeof scene>, t: number) =>
    (evaluate(compileScene(s), t)[0] as { transform: number[] }).transform[4]!;

  it("is silent outside [from, until]", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box()],
      duration: 5,
      behaviors: [oscillate("a", "x", carrier, { from: 1, until: 3 })],
    });
    expect(xAt(s, 0.5)).toBe(100);
    expect(xAt(s, 2)).toBeCloseTo(110);
    expect(xAt(s, 4)).toBe(100);
  });

  it("ramps linearly at the window bounds", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box()],
      duration: 5,
      behaviors: [oscillate("a", "x", carrier, { from: 1, until: 3, ramp: 0.5 })],
    });
    expect(xAt(s, 1)).toBeCloseTo(100); // ramp starts at 0
    expect(xAt(s, 1.25)).toBeCloseTo(105); // halfway up the ramp
    expect(xAt(s, 2)).toBeCloseTo(110); // fully inside
    expect(xAt(s, 2.75)).toBeCloseTo(105); // halfway down
  });

  it("without bounds, applies for the whole scene (pre-v2 behavior)", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box()],
      duration: 5,
      behaviors: [oscillate("a", "x", carrier)],
    });
    expect(xAt(s, 0)).toBeCloseTo(110);
    expect(xAt(s, 4.9)).toBeCloseTo(110);
  });
});
