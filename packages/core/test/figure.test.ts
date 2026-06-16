import { describe, expect, it } from "vitest";
import { scene, seq, wait } from "../src/dsl.js";
import { figure } from "../src/figure.js";
import { characterPreset } from "../src/characterPreset.js";
import { compileScene } from "../src/compile.js";
import { validateScene } from "../src/validate.js";
import type { NodeIR } from "../src/ir.js";

// collect every node id in a subtree
function ids(node: NodeIR, out: Map<string, NodeIR> = new Map()): Map<string, NodeIR> {
  out.set(node.id, node);
  if (node.type === "group") for (const c of node.children) ids(c, out);
  return out;
}

// the humanoid joints characterPreset / ikReach depend on
const JOINTS = [
  "chest", "head", "armUpperL", "armLowerL", "armUpperR", "armLowerR",
  "legUpperL", "legLowerL", "legUpperR", "legLowerR",
];

describe("figure", () => {
  it("both styles expose the humanoid joint ids (characterPreset-compatible)", () => {
    for (const style of ["clean", "cute"] as const) {
      const map = ids(figure({ id: "f", style }));
      for (const j of JOINTS) expect(map.has(`f-${j}`), `${style}: missing joint f-${j}`).toBe(true);
    }
  });

  it("palette overrides re-skin (top follows the accent for clean)", () => {
    const top = ids(figure({ id: "f", style: "clean", palette: { accent: "#3B82F6" } })).get("f-chest-top")!;
    expect(top.type).toBe("path");
    expect((top as Extract<NodeIR, { type: "path" }>).props.fill).toBe("#3B82F6");
    const red = ids(figure({ id: "f", style: "clean", palette: { top: "#FF0000" } })).get("f-chest-top")!;
    expect((red as Extract<NodeIR, { type: "path" }>).props.fill).toBe("#FF0000");
  });

  it("face:false drops the eyes", () => {
    expect(ids(figure({ id: "f", style: "clean", face: true })).has("f-head-eyeL")).toBe(true);
    expect(ids(figure({ id: "f", style: "clean", face: false })).has("f-head-eyeL")).toBe(false);
  });

  it("styles differ and each is deterministic", () => {
    expect(JSON.stringify(figure({ id: "f", style: "clean" }))).toBe(JSON.stringify(figure({ id: "f", style: "clean" })));
    expect(JSON.stringify(figure({ id: "f", style: "clean" }))).not.toBe(JSON.stringify(figure({ id: "f", style: "cute" })));
  });

  it("composes with characterPreset, compiles + validates; dup id throws", () => {
    const mk = (nodes: NodeIR[]) => scene({ id: "s", size: { width: 1920, height: 1080 }, fps: 30, nodes, timeline: seq(characterPreset("walk", { target: "f", at: [960, 520] }), wait(0.2)) });
    const s = mk([figure({ id: "f", x: 960, y: 520 })]);
    expect(() => validateScene(s)).not.toThrow();
    expect(() => compileScene(s)).not.toThrow();
    expect(() => mk([figure({ id: "f" }), figure({ id: "f" })])).toThrow();
  });
});
