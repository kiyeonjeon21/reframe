import { describe, expect, it } from "vitest";
import { coverRect } from "../src/index.js";

// dest box: 16:9 (1920×1080)
const DW = 1920, DH = 1080;

describe("coverRect (center cover-crop)", () => {
  it("crops the sides of a too-wide image (ultra-pano → 16:9)", () => {
    const r = coverRect(16576, 3872, DW, DH); // wider than 16:9 → crop left/right
    expect(r.sh).toBeCloseTo(3872, 3); // full height used
    expect(r.sw).toBeLessThan(16576); // width cropped
    expect(r.sx).toBeGreaterThan(0);
    expect(r.sy).toBeCloseTo(0, 6);
    // selected region keeps the dest aspect
    expect(r.sw / r.sh).toBeCloseTo(DW / DH, 4);
  });

  it("crops the top/bottom of a too-tall image (portrait → 16:9)", () => {
    const r = coverRect(1080, 1920, DW, DH); // taller than 16:9 → crop top/bottom
    expect(r.sw).toBeCloseTo(1080, 3); // full width used
    expect(r.sh).toBeLessThan(1920);
    expect(r.sy).toBeGreaterThan(0);
    expect(r.sx).toBeCloseTo(0, 6);
    expect(r.sw / r.sh).toBeCloseTo(DW / DH, 4);
  });

  it("a frame-aspect image is used whole (no crop)", () => {
    const r = coverRect(1920, 1080, DW, DH);
    expect(r).toMatchObject({ sx: 0, sy: 0 });
    expect(r.sw).toBeCloseTo(1920, 6);
    expect(r.sh).toBeCloseTo(1080, 6);
  });

  it("a square image into 16:9 crops top/bottom and stays in bounds", () => {
    const r = coverRect(2000, 2000, DW, DH);
    expect(r.sw).toBeCloseTo(2000, 3); // width fully used
    expect(r.sh).toBeLessThan(2000);
    expect(r.sx).toBeCloseTo(0, 6);
    expect(r.sy).toBeGreaterThan(0);
    // source rect never exceeds the image
    expect(r.sx + r.sw).toBeLessThanOrEqual(2000 + 1e-6);
    expect(r.sy + r.sh).toBeLessThanOrEqual(2000 + 1e-6);
  });

  it("degenerate sizes fall back to the whole image", () => {
    expect(coverRect(0, 0, DW, DH)).toMatchObject({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});
