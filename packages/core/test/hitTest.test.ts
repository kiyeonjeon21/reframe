import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { group, motionPath, rect, scene, seq, text } from "../src/dsl.js";
import { hitTest, sceneGeometry } from "../src/hitTest.js";
import type { NodeIR, TimelineIR } from "../src/ir.js";

const compile = (nodes: NodeIR[], timeline?: TimelineIR) =>
  compileScene(scene({ id: "t", size: { width: 1000, height: 1000 }, fps: 30, nodes, ...(timeline && { timeline }) }));

describe("sceneGeometry + hitTest", () => {
  it("bounds match a centred rect's size; hit inside, miss outside", () => {
    const c = compile([rect({ id: "box", x: 100, y: 100, width: 50, height: 40, anchor: "center", fill: "#fff" })]);
    const g = sceneGeometry(c, 0);
    const box = g.nodes.find((n) => n.id === "box")!;
    expect(box.bounds.w).toBeCloseTo(50);
    expect(box.bounds.h).toBeCloseTo(40);
    expect(box.bounds.x).toBeCloseTo(75); // 100 - 50/2
    expect(hitTest(g, 100, 100)).toBe("box"); // centre
    expect(hitTest(g, 40, 100)).toBeNull(); // left of the box
  });

  it("returns the topmost (last-drawn) node at a point", () => {
    const c = compile([
      rect({ id: "a", x: 50, y: 50, width: 100, height: 100, anchor: "center", fill: "#f00" }),
      rect({ id: "b", x: 50, y: 50, width: 100, height: 100, anchor: "center", fill: "#0f0" }),
    ]);
    expect(hitTest(sceneGeometry(c, 0), 50, 50)).toBe("b");
  });

  it("group bounds = union of descendant leaves", () => {
    const c = compile([
      group({ id: "g", x: 0, y: 0 }, [
        rect({ id: "l", x: 10, y: 10, width: 20, height: 20, anchor: "center", fill: "#fff" }),
        rect({ id: "r", x: 90, y: 70, width: 20, height: 20, anchor: "center", fill: "#fff" }),
      ]),
    ]);
    const box = sceneGeometry(c, 0).groups.find((x) => x.id === "g")!;
    expect(box.bounds.x).toBeCloseTo(0); // 10 - 10
    expect(box.bounds.y).toBeCloseTo(0); // 10 - 10
    expect(box.bounds.w).toBeCloseTo(100); // (90+10) - 0
    expect(box.bounds.h).toBeCloseTo(80); // (70+10) - 0
  });

  it("text bounds use deterministic Inter advances (canvas-free, non-zero width)", () => {
    const c = compile([
      text({ id: "tt", x: 0, y: 0, anchor: "center", content: "Hello", fontFamily: "Inter", fontSize: 100, fontWeight: 400 }),
    ]);
    const tt = sceneGeometry(c, 0).nodes.find((n) => n.id === "tt")!;
    expect(tt.bounds.w).toBeGreaterThan(100); // "Hello" @100px is wider than 100px
    expect(tt.bounds.h).toBeCloseTo(120); // fontSize * 1.2
  });

  it("surfaces labelled motionPath waypoints in scene coords", () => {
    const c = compile(
      [rect({ id: "dot", x: 0, y: 0, width: 10, height: 10, anchor: "center", fill: "#fff" })],
      seq(motionPath("dot", [[100, 200], [300, 400]], { duration: 1, label: "path" })),
    );
    const wps = sceneGeometry(c, 0).waypoints;
    expect(wps).toHaveLength(2);
    expect(wps[0]).toMatchObject({ label: "path", index: 0, x: 100, y: 200 });
    expect(wps[1]).toMatchObject({ label: "path", index: 1, x: 300, y: 400 });
  });

  it("a rotated node still hit-tests at its centre; its AABB grows", () => {
    const c = compile([rect({ id: "r", x: 500, y: 500, width: 100, height: 20, anchor: "center", rotation: 45, fill: "#fff" })]);
    const g = sceneGeometry(c, 0);
    expect(hitTest(g, 500, 500)).toBe("r");
    expect(g.nodes.find((n) => n.id === "r")!.bounds.w).toBeGreaterThan(70); // diagonal > the 100px width's axis extent
  });
});
