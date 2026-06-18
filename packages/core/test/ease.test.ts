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
  it("registers all 9 expressive + 3 spring eases (25 total)", () => {
    for (const n of NEW) expect(EASE_NAMES).toContain(n);
    for (const n of ["spring", "springBouncy", "springStiff"]) expect(EASE_NAMES).toContain(n);
    expect(EASE_NAMES.length).toBe(25);
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

describe("spring eases", () => {
  it("all three settle exactly at the endpoints", () => {
    for (const n of ["spring", "springBouncy", "springStiff"]) {
      const f = resolveEase(n as never);
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
    }
  });

  it("damping ratio governs overshoot: bouncy > spring > stiff", () => {
    const peak = (n: string) => Math.max(...sample(n));
    const bouncy = peak("springBouncy");
    const mid = peak("spring");
    const stiff = peak("springStiff");
    expect(bouncy).toBeGreaterThan(1.2); // low ζ rings well past the target
    expect(mid).toBeGreaterThan(1.05);
    expect(stiff).toBeLessThan(1.02); // high ζ barely overshoots
    expect(bouncy).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(stiff);
  });

  it("a bouncy spring rings (dips back below its settle after overshooting)", () => {
    const s = sample("springBouncy");
    const overshootIdx = s.findIndex((v) => v > 1.05);
    expect(overshootIdx).toBeGreaterThan(0);
    expect(Math.min(...s.slice(overshootIdx))).toBeLessThan(1);
  });

  it("the { spring } object form works and defaults to the named `spring`", () => {
    const obj = resolveEase({ spring: {} });
    const named = resolveEase("spring" as never);
    for (let i = 0; i <= 20; i++) expect(obj(i / 20)).toBeCloseTo(named(i / 20), 12);
  });

  it("custom spring knobs are deterministic and respond to velocity", () => {
    const a = resolveEase({ spring: { stiffness: 120, damping: 9, velocity: 0 } });
    const b = resolveEase({ spring: { stiffness: 120, damping: 9, velocity: 0 } });
    for (let i = 0; i <= 20; i++) expect(a(i / 20)).toBe(b(i / 20)); // byte-identical
    // a positive launch velocity makes the early rise steeper
    const slow = resolveEase({ spring: { velocity: 0 } });
    const fast = resolveEase({ spring: { velocity: 4 } });
    expect(fast(0.1)).toBeGreaterThan(slow(0.1));
  });
});
