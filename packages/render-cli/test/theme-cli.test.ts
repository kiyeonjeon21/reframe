import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flattenTokens, loadThemeDoc } from "../src/overlay.js";
import { overlayFromFlat } from "../src/batch.js";

describe("flattenTokens", () => {
  it("flattens a nested theme to dotted scalar leaves, skipping arrays", () => {
    expect(
      flattenTokens({ color: { accent: "#1E90FF", dataViz: ["#a", "#b"] }, motion: { energy: 0.7 } }),
    ).toEqual({ "color.accent": "#1E90FF", "motion.energy": 0.7 });
  });

  it("is empty for a non-object", () => {
    expect(flattenTokens("nope")).toEqual({});
  });
});

describe("loadThemeDoc (--theme path)", () => {
  it("loads a nested brand-kit JSON as a flattened design overlay", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reframe-theme-"));
    const p = join(dir, "ocean.json");
    await writeFile(p, JSON.stringify({ color: { accent: "#1E90FF", bg: "#0B1020" } }));
    const doc = await loadThemeDoc(p);
    expect(doc.reframeOverlay).toBe(1);
    expect(doc.name).toBe("ocean.json");
    expect(doc.design).toEqual({ "color.accent": "#1E90FF", "color.bg": "#0B1020" });
  });
});

describe("batch overlayFromFlat — design.* column", () => {
  it("maps a design-token column into doc.design (one re-skin per row)", () => {
    const doc = overlayFromFlat(
      { _name: "vivid", "design.color.accent": "#FF3D6E", "nodes.title.content": "Vivid" },
      "vivid",
    );
    expect(doc.design).toEqual({ "color.accent": "#FF3D6E" });
    expect(doc.nodes?.title?.content).toBe("Vivid");
    expect(doc.name).toBe("vivid");
  });
});
