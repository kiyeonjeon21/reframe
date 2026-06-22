import { describe, expect, it } from "vitest";
import { brand, theme } from "../src/index.js";

describe("brand tokens", () => {
  it("carries the canonical reframe house values", () => {
    expect(brand.color.accent).toBe("#FF4D00");
    expect(brand.color.accent2).toBe("#00C2A8");
    expect(brand.color.bg).toBe("#0A0C14");
    expect(brand.color.fg).toBe("#FFFFFF");
    expect(brand.color.muted).toBe("#8B93A7");
    expect(brand.type.family).toBe("Inter");
    expect(brand.type.headline).toEqual({ fontFamily: "Inter", fontSize: 48, fontWeight: 700 });
    expect(brand.motion.ease.base).toBe("easeOutCubic");
    expect(brand.motion.energy).toBe(0.5);
    expect(brand.layout.size).toEqual({ width: 1920, height: 1080 });
  });
});

describe("theme()", () => {
  it("returns the house brand unchanged with no overrides", () => {
    expect(theme()).toEqual(brand);
    expect(theme()).not.toBe(brand); // a copy, not the same reference
  });

  it("overrides only the given leaf and deep-merges the rest", () => {
    const t = theme({ color: { accent: "#1E90FF" } });
    expect(t.color.accent).toBe("#1E90FF"); // overridden
    expect(t.color.accent2).toBe(brand.color.accent2); // sibling kept
    expect(t.color.bg).toBe(brand.color.bg); // sibling kept
    expect(t.type).toEqual(brand.type); // untouched subtree kept
  });

  it("merges nested overrides (e.g. motion.energy) without dropping siblings", () => {
    const t = theme({ motion: { energy: 0.8 } });
    expect(t.motion.energy).toBe(0.8);
    expect(t.motion.ease).toEqual(brand.motion.ease);
    expect(t.motion.dur).toEqual(brand.motion.dur);
  });

  it("replaces arrays wholesale rather than merging them", () => {
    const t = theme({ color: { dataViz: ["#000000"] } });
    expect(t.color.dataViz).toEqual(["#000000"]);
  });

  it("never mutates the house brand", () => {
    const before = JSON.parse(JSON.stringify(brand)) as typeof brand;
    theme({ color: { accent: "#000000" }, motion: { energy: 0.1 } });
    expect(brand).toEqual(before);
  });
});
