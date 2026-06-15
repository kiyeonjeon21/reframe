import { describe, expect, it } from "vitest";
import { resolveEase, EASE_NAMES } from "../src/interpolate.js";

const sample = (name: string, n = 200) =>
  Array.from({ length: n + 1 }, (_, i) => resolveEase(name as never)(i / n));

const NEW = [
  "easeInBack", "easeOutBack", "easeInOutBack",
  "easeInElastic", "easeOutElastic", "easeInOutElastic",
  "easeInBounce", "easeOutBounce", "easeInOutBounce",
];

describe("expressive eases", () => {
  it("registers all 9 new eases (22 total)", () => {
    for (const n of NEW) expect(EASE_NAMES).toContain(n);
    expect(EASE_NAMES.length).toBe(22);
  });

  it("every ease pins the endpoints f(0)=0, f(1)=1", () => {
    for (const n of EASE_NAMES) {
      const f = resolveEase(n as never);
      expect(f(0)).toBeCloseTo(0, 9);
      expect(f(1)).toBeCloseTo(1, 9);
    }
  });

  it("back overshoots past the target (the signature pop)", () => {
    expect(Math.max(...sample("easeOutBack"))).toBeGreaterThan(1.05);
    expect(Math.min(...sample("easeInBack"))).toBeLessThan(-0.05); // anticipation dip
  });

  it("bounce lands without overshoot and bounces (≥2 local maxima)", () => {
    const s = sample("easeOutBounce");
    expect(Math.max(...s)).toBeLessThanOrEqual(1 + 1e-9); // never exceeds target
    let maxima = 0;
    for (let i = 1; i < s.length - 1; i++) {
      if (s[i]! > s[i - 1]! && s[i]! >= s[i + 1]! && s[i]! < 0.999) maxima++;
    }
    expect(maxima).toBeGreaterThanOrEqual(2);
  });

  it("elastic rings: overshoots above 1 and dips below its settle", () => {
    const s = sample("easeOutElastic");
    expect(Math.max(...s)).toBeGreaterThan(1.05); // rings above the target
    // and oscillates (a sample below a later neighbour after the first ring)
    const overshootIdx = s.findIndex((v) => v > 1.05);
    expect(Math.min(...s.slice(overshootIdx))).toBeLessThan(1); // dips back under
  });

  it("unknown ease still throws (resolveEase guard intact)", () => {
    expect(() => resolveEase("easeOutWobble" as never)).toThrow(/unknown ease/);
  });
});
