import { describe, expect, it } from "vitest";
import { localMatrix, evaluate, type Mat2D } from "../src/evaluate.js";
import { cameraMatrix } from "../src/camera.js";
import { scene, rect, group, text, seq, tween, motionPath, oscillate } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { SceneValidationError } from "../src/validate.js";

const size = { width: 1000, height: 800 };
const transformOf = (s: ReturnType<typeof scene>, t: number, id: string): Mat2D =>
  (evaluate(compileScene(s), t).find((o) => o.id === id) as { transform: Mat2D }).transform;

// multiply mirror (evaluate's is not exported) for the expected-matrix assertions
const mul = (m: Mat2D, n: Mat2D): Mat2D => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

describe("camera primitive", () => {
  it("default camera (focal=centre, zoom 1, rot 0) renders identically to no camera", () => {
    const nodes = () => [rect({ id: "r", x: 100, y: 100, width: 50, height: 50, fill: "#fff" })];
    const without = scene({ id: "a", size, nodes: nodes() });
    const withDefault = scene({ id: "b", size, camera: {}, nodes: nodes() });
    expect(transformOf(withDefault, 0, "r")).toEqual(transformOf(without, 0, "r"));
  });

  it("a scene with no camera leaves a node at its raw coords (root is identity)", () => {
    const s = scene({ id: "a", size, nodes: [rect({ id: "r", x: 120, y: 60, width: 10, height: 10, fill: "#fff" })] });
    expect(transformOf(s, 0, "r")).toEqual([1, 0, 0, 1, 120, 60]);
  });

  it("static camera pre-multiplies every node by the camera matrix", () => {
    const cam = { x: 300, y: 400, zoom: 2, rotation: 30 };
    const s = scene({ id: "a", size, camera: cam, nodes: [rect({ id: "r", x: 100, y: 50, width: 20, height: 20, fill: "#fff" })] });
    const expected = mul(cameraMatrix(cam, size), localMatrix(100, 50, 0, 1));
    expect(transformOf(s, 0, "r")).toEqual(expected);
  });

  it("zooms exactly about the focal point (the focal scene point stays put)", () => {
    // a node placed at the focal point maps to the frame centre at any zoom
    const s = scene({ id: "a", size, camera: { x: 300, y: 200, zoom: 4 }, nodes: [rect({ id: "r", x: 300, y: 200, width: 2, height: 2, fill: "#fff" })] });
    const m = transformOf(s, 0, "r");
    expect(m[4]).toBeCloseTo(size.width / 2, 6);
    expect(m[5]).toBeCloseTo(size.height / 2, 6);
  });

  it("animates via tween('camera', …) and interpolates across t", () => {
    const s = scene({
      id: "a",
      size,
      camera: { x: 500, y: 400, zoom: 1 },
      nodes: [rect({ id: "r", x: 500, y: 400, width: 2, height: 2, fill: "#fff" })],
      timeline: tween("camera", { zoom: 3 }, { duration: 1, ease: "linear", label: "push" }),
    });
    const c = compileScene(s);
    const scaleAt = (t: number) => (evaluate(c, t).find((o) => o.id === "r") as { transform: Mat2D }).transform[0];
    expect(scaleAt(0)).toBeCloseTo(1, 6);
    expect(scaleAt(0.5)).toBeCloseTo(2, 6);
    expect(scaleAt(1)).toBeCloseTo(3, 6);
  });

  it("pans along a motionPath('camera', …)", () => {
    const s = scene({
      id: "a",
      size,
      camera: { x: 0, y: 0, zoom: 1 },
      nodes: [rect({ id: "r", x: 0, y: 0, width: 2, height: 2, fill: "#fff" })],
      timeline: motionPath("camera", [[0, 0], [200, 0]], { duration: 1, ease: "linear" }),
    });
    const c = compileScene(s);
    const exAt = (t: number) => (evaluate(c, t).find((o) => o.id === "r") as { transform: Mat2D }).transform[4];
    // focal pans from 0 → 200, so the node (at 0,0) slides left in frame by ~200
    expect(exAt(1) - exAt(0)).toBeCloseTo(-200, 6);
  });

  it("a behavior can ride on the camera (handheld drift)", () => {
    const s = scene({
      id: "a",
      size,
      camera: { x: 500, y: 400, zoom: 1, rotation: 0 },
      nodes: [rect({ id: "r", x: 500, y: 400, width: 2, height: 2, fill: "#fff" })],
      behaviors: [oscillate("camera", "rotation", { amplitude: 5, frequency: 1, phase: 0.25 })],
    });
    const c = compileScene(s);
    // rotation oscillates, so the matrix's a-term (cos·zoom) dips below 1 somewhere
    const aTerms = [0, 0.1, 0.2, 0.3, 0.4].map((t) => (evaluate(c, t).find((o) => o.id === "r") as { transform: Mat2D }).transform[0]);
    expect(Math.min(...aTerms)).toBeLessThan(1);
  });

  it("a top-level fixed node ignores the camera (screen-pinned HUD)", () => {
    const s = scene({
      id: "a",
      size,
      camera: { x: 100, y: 100, zoom: 4 },
      nodes: [
        rect({ id: "world", x: 100, y: 100, width: 10, height: 10, fill: "#fff" }),
        text({ id: "hud", x: 40, y: 40, content: "HUD", fontFamily: "Inter", fontSize: 20, fixed: true }),
      ],
    });
    // the pinned node renders at its raw coords; the world node does not
    expect(transformOf(s, 0, "hud")).toEqual([1, 0, 0, 1, 40, 40]);
    expect(transformOf(s, 0, "world")).not.toEqual([1, 0, 0, 1, 100, 100]);
  });

  it("the camera moves a clipped group's contents together with its clip", () => {
    const s = scene({
      id: "a",
      size,
      camera: { x: 200, y: 200, zoom: 2 },
      nodes: [
        group({ id: "g", x: 0, y: 0, clip: { kind: "rect", x: 0, y: 0, width: 100, height: 100 } }, [
          rect({ id: "inner", x: 10, y: 10, width: 5, height: 5, fill: "#fff" }),
        ]),
      ],
    });
    const op = evaluate(compileScene(s), 0).find((o) => o.id === "inner") as { clips?: { transform: Mat2D }[] };
    // the clip's transform is camera-composed (not identity), so it moves with the scene
    expect(op.clips?.[0]?.transform).not.toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("a node named 'camera' keeps node semantics (back-compat) and the camera stays inactive", () => {
    const s = scene({
      id: "a",
      size,
      nodes: [group({ id: "camera", x: 500, y: 400, scale: 1, anchor: "center" }, [rect({ id: "r", x: 0, y: 0, width: 2, height: 2, fill: "#fff" })])],
      timeline: tween("camera", { scale: 2 }, { duration: 1, ease: "linear" }),
    });
    expect(compileScene(s).hasCamera).toBe(false);
    // the tween scales the node group, not a scene camera
    const sAt = (t: number) => (evaluate(compileScene(s), t).find((o) => o.id === "r") as { transform: Mat2D }).transform[0];
    expect(sAt(1)).toBeCloseTo(2, 6);
  });

  it("rejects a scene camera colliding with a node named 'camera'", () => {
    expect(() =>
      scene({ id: "a", size, camera: { zoom: 2 }, nodes: [rect({ id: "camera", x: 0, y: 0, width: 1, height: 1, fill: "#fff" })] }),
    ).toThrow(SceneValidationError);
  });

  it("rejects unknown camera props (static field and tween target)", () => {
    expect(() => scene({ id: "a", size, camera: { scale: 2 } as never, nodes: [rect({ id: "r", x: 0, y: 0, width: 1, height: 1, fill: "#fff" })] })).toThrow(SceneValidationError);
    expect(() =>
      scene({ id: "b", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 1, height: 1, fill: "#fff" })], timeline: tween("camera", { scale: 2 }, { duration: 1 }) }),
    ).toThrow(SceneValidationError);
  });

  it("is deterministic: same scene + t → byte-identical ops", () => {
    const build = () => scene({ id: "a", size, camera: { x: 300, y: 200, zoom: 2, rotation: 12 }, nodes: [rect({ id: "r", x: 100, y: 100, width: 20, height: 20, fill: "#fff" })], timeline: tween("camera", { zoom: 5 }, { duration: 1 }) });
    const a = evaluate(compileScene(build()), 0.5);
    const b = evaluate(compileScene(build()), 0.5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
