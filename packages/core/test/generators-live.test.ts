import { describe, expect, it } from "vitest";
import { composeScene, type OverlayDoc } from "../src/compose.js";
import { compileScene } from "../src/compile.js";
import { scene, seq } from "../src/dsl.js";
import { title, numberRoll } from "../src/index.js";
import { sceneManifest } from "../src/manifest.js";
import type { NodeIR } from "../src/ir.js";

const grp = (n: NodeIR | undefined) => n as Extract<NodeIR, { type: "group" }>;
const findById = (nodes: NodeIR[], id: string): NodeIR | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === "group") {
      const hit = findById(n.children, id);
      if (hit) return hit;
    }
  }
  return undefined;
};
const glyphContents = (g: Extract<NodeIR, { type: "group" }>) =>
  g.children.map((c) => (c.type === "text" ? c.props.content : "")).join("");

// A scene whose headline + hero number are LIVE generators (the editable-by-default shape).
const baseScene = () => {
  const head = title({ text: "Money, reimagined", id: "headline", x: 540, y: 300, fontSize: 90 });
  const bal = numberRoll({ id: "bal", value: 128450, x: 540, y: 600, fontSize: 120, prefix: "$" });
  return scene({
    id: "aria",
    size: { width: 1080, height: 1080 },
    background: "#0A0A0B",
    nodes: [...head.nodes, bal.node],
    timeline: seq(head.timeline, bal.timeline),
  });
};

describe("live generators — content addressability", () => {
  it("compiles with no overlay (the pre-expanded nodes are the truth)", () => {
    expect(() => compileScene(baseScene())).not.toThrow();
    const head = grp(findById(baseScene().nodes, "headline"));
    expect(head.gen).toEqual({
      kind: "title",
      params: { id: "headline", text: "Money, reimagined", x: 540, y: 300, fontSize: 90 },
    });
    // glyph nodes are nested under the container, byte-faithful to the phrase
    expect(glyphContents(head)).toBe("Money,reimagined"); // spaces don't emit a glyph
  });

  it("manifest surfaces the generator content address", () => {
    const m = sceneManifest(compileScene(baseScene()));
    const headAddr = m.nodes.find((n) => n.id === "headline");
    expect(headAddr?.generator).toEqual({ kind: "title", contentKey: "text", content: "Money, reimagined" });
    expect(headAddr?.editableProps).toContain("text");
    const balAddr = m.nodes.find((n) => n.id === "bal");
    expect(balAddr?.generator).toEqual({ kind: "numberRoll", contentKey: "value", content: 128450 });
    expect(balAddr?.editableProps).toContain("value");
  });

  it("patching nodes.headline.text RE-SPLITS the phrase (reflow, not broken kerning)", () => {
    const overlay: OverlayDoc = {
      reframeOverlay: 1,
      nodes: { headline: { text: "Banking, evolved" } },
    };
    const { ir, report } = composeScene(baseScene(), overlay);
    expect(report.applied.map((a) => a.address)).toContain("nodes.headline.text");
    expect(report.orphans).toHaveLength(0);

    const head = grp(findById(ir.nodes, "headline"));
    // glyph subtree regenerated to the NEW phrase (15 vs the original 16 glyphs)
    expect(glyphContents(head)).toBe("Banking,evolved");
    expect(head.gen?.params.text).toBe("Banking, evolved");
    // advances reflow: the glyph x positions are freshly laid out (centered about x=540)
    const xs = head.children.filter((c) => c.type === "text").map((c) => c.props.x as number);
    expect(Math.min(...xs)).toBeLessThan(540);
    expect(Math.max(...xs)).toBeGreaterThan(540);
    // still a valid, compilable scene
    expect(() => compileScene(ir)).not.toThrow();
  });

  it("patching nodes.bal.value REBUILDS the digit reels for the new number", () => {
    const overlay: OverlayDoc = { reframeOverlay: 1, nodes: { bal: { value: 250000 } } };
    const { ir, report } = composeScene(baseScene(), overlay);
    expect(report.applied.map((a) => a.address)).toContain("nodes.bal.value");
    expect(report.orphans).toHaveLength(0);

    const bal = grp(findById(ir.nodes, "bal"));
    expect(bal.gen?.params.value).toBe(250000);
    // each digit reel's LANDING digit (the last text in its column) spells 250,000
    const landing = bal.children
      .filter((c) => c.type === "group" && c.id.startsWith("bal-w"))
      .map((w) => {
        const col = grp(grp(w as NodeIR).children[0]);
        const last = col.children[col.children.length - 1];
        return last && last.type === "text" ? last.props.content : "";
      })
      .join("");
    expect(landing).toBe("250000");
    expect(() => compileScene(ir)).not.toThrow();
  });

  it("re-expansion is deterministic (same base + overlay → byte-identical IR)", () => {
    const overlay: OverlayDoc = {
      reframeOverlay: 1,
      nodes: { headline: { text: "Banking, evolved" }, bal: { value: 250000 } },
    };
    const a = composeScene(baseScene(), overlay).ir;
    const b = composeScene(baseScene(), overlay).ir;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("survives a regen that keeps the generator id but reorders the scene", () => {
    // overlay authored against the original base
    const overlay: OverlayDoc = {
      reframeOverlay: 1,
      nodes: { headline: { text: "Banking, evolved" }, bal: { value: 250000 } },
    };
    // a "regenerated" base: same generator ids, different surrounding order/timeline
    const head = title({ text: "Money, reimagined", id: "headline", x: 540, y: 280, fontSize: 96 });
    const bal = numberRoll({ id: "bal", value: 128450, x: 540, y: 640, fontSize: 130, prefix: "$" });
    const regen = scene({
      id: "aria",
      size: { width: 1080, height: 1080 },
      nodes: [bal.node, ...head.nodes], // reordered
      timeline: seq(bal.timeline, head.timeline), // reordered
    });
    const { ir, report } = composeScene(regen, overlay);
    expect(report.orphans).toHaveLength(0);
    expect(glyphContents(grp(findById(ir.nodes, "headline")))).toBe("Banking,evolved");
    expect(grp(findById(ir.nodes, "bal")).gen?.params.value).toBe(250000);
  });
});
