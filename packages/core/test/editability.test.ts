import { describe, expect, it } from "vitest";
import { scene, group, rect, text, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { evaluate, nodeParentMatrix, type Mat2D } from "../src/evaluate.js";
import { composeScene } from "../src/compose.js";

const size = { width: 400, height: 300 };

// inline copies of evaluate's private matrix math, to assert against it
const mul = (m: Mat2D, n: Mat2D): Mat2D => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const local = (x: number, y: number, rot: number, scale: number): Mat2D => {
  const r = (rot * Math.PI) / 180;
  const cos = Math.cos(r) * scale;
  const sin = Math.sin(r) * scale;
  return [cos, sin, -sin, cos, x, y];
};
// matrix multiply normalizes -0→+0; compare normalized so signed zero never bites
const norm = (m: Mat2D): Mat2D => m.map((v) => (Object.is(v, -0) ? 0 : v)) as Mat2D;

describe("nodeParentMatrix", () => {
  const nested = scene({
    id: "s",
    size,
    fps: 30,
    nodes: [
      group({ id: "g", x: 100, y: 50, scale: 2, rotation: 0 }, [
        text({ id: "label", x: 10, y: 20, content: "hi", fontFamily: "Inter", fontSize: 24 }),
      ]),
      rect({ id: "top", x: 30, y: 40, width: 10, height: 10, fill: "#fff" }),
    ],
    timeline: wait(1),
  });

  it("composed with the node's local transform equals evaluate's op transform", () => {
    const c = compileScene(nested);
    const op = evaluate(c, 0).find((o) => o.id === "label")!;
    const parent = nodeParentMatrix(c, "label", 0)!;
    // the parent of a nested child is the group's own matrix
    expect(norm(parent)).toEqual(norm(local(100, 50, 0, 2)));
    // parent ∘ local == the rendered transform (the drag-delta inversion basis)
    expect(norm(mul(parent, local(10, 20, 0, 1)))).toEqual(norm(op.transform as Mat2D));
  });

  it("is identity for a top-level node (1:1 scene delta)", () => {
    const c = compileScene(nested);
    expect(nodeParentMatrix(c, "top", 0)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("returns null for an unknown id", () => {
    const c = compileScene(nested);
    expect(nodeParentMatrix(c, "ghost", 0)).toBeNull();
  });
});

describe("removeNodes overlay verb", () => {
  const base = scene({
    id: "s",
    size,
    fps: 30,
    nodes: [rect({ id: "bg", x: 0, y: 0, width: 400, height: 300, fill: "#000" })],
    timeline: wait(1),
  });
  const added = rect({ id: "extra", x: 10, y: 10, width: 20, height: 20, fill: "#fff" });

  it("refuses to remove a base node (hide it instead) and reports it", () => {
    const { ir, report } = composeScene(base, { reframeOverlay: 1, removeNodes: ["bg"] });
    expect(ir.nodes.some((n) => n.id === "bg")).toBe(true); // still there
    expect(report.orphans.some((o) => o.address === "removeNodes.bg")).toBe(true);
  });

  it("removes an overlay-added node across layers", () => {
    const { ir, report } = composeScene(
      base,
      { reframeOverlay: 1, addNodes: [added] },
      { reframeOverlay: 1, removeNodes: ["extra"] },
    );
    expect(ir.nodes.some((n) => n.id === "extra")).toBe(false);
    expect(report.applied.some((a) => a.action === "remove-node")).toBe(true);
    expect(report.orphans).toEqual([]);
  });

  it("add-then-remove in one overlay round-trips to the base node set", () => {
    const { ir } = composeScene(base, { reframeOverlay: 1, addNodes: [added], removeNodes: ["extra"] });
    expect(ir.nodes.map((n) => n.id)).toEqual(base.nodes.map((n) => n.id));
  });

  it("an unknown removeNodes id orphans (nothing to remove)", () => {
    const { report } = composeScene(base, { reframeOverlay: 1, removeNodes: ["nope"] });
    expect(report.orphans.some((o) => o.address === "removeNodes.nope")).toBe(true);
  });
});

describe("nested-child edits survive regeneration", () => {
  it("a nested node's x/y patch reapplies by stable id even when its group is renamed", () => {
    const overlay = { reframeOverlay: 1, nodes: { label: { x: 999, y: 7 } } } as const;
    // base regenerated with a DIFFERENT group id but the same child id
    const regen = scene({
      id: "s",
      size,
      fps: 30,
      nodes: [group({ id: "wrapper-v2", x: 0, y: 0 }, [text({ id: "label", x: 1, y: 2, content: "hi", fontFamily: "Inter", fontSize: 24 })])],
      timeline: wait(1),
    });
    const { ir, report } = composeScene(regen, overlay);
    const label = (ir.nodes[0] as { children: { id: string; props: { x: number; y: number } }[] }).children[0]!;
    expect(label.props.x).toBe(999);
    expect(label.props.y).toBe(7);
    expect(report.orphans).toEqual([]);
  });
});
