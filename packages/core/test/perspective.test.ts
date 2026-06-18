import { describe, expect, it } from "vitest";
import { localMatrix, evaluate, type Mat2D } from "../src/evaluate.js";
import { scene, rect, group, text, seq, tween } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";

const size = { width: 1000, height: 800 };
const opOf = (s: ReturnType<typeof scene>, t: number, id: string) =>
  evaluate(compileScene(s), t).find((o) => o.id === id) as { transform: Mat2D; clips?: { transform: Mat2D }[] };
const transformOf = (s: ReturnType<typeof scene>, t: number, id: string): Mat2D => opOf(s, t, id).transform;

// evaluate places a node as multiply(parent=IDENTITY, localMatrix(...)); mirror that
// so expected matrices normalise -0 the same way (a raw localMatrix keeps -0).
const ID: Mat2D = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat2D, n: Mat2D): Mat2D => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const placed = (x: number, y: number): Mat2D => mul(ID, localMatrix(x, y, 0, 1));

const r = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  rect({ id, x, y, width: 100, height: 100, anchor: "center", fill: "#fff", ...extra });

describe("projected 2.5D perspective", () => {
  it("BYTE-IDENTITY GUARD: z / rotateY with no camera.perspective is inert", () => {
    // a node carrying depth props but NO camera.perspective must project nothing
    const withDepth = scene({ id: "a", size, nodes: [r("r", 200, 200, { z: 500, rotateY: 30 })] });
    expect(transformOf(withDepth, 0, "r")).toEqual(placed(200, 200));
    // and the whole DisplayList equals the same scene without the depth props
    const plain = scene({ id: "a", size, nodes: [r("r", 200, 200)] });
    expect(JSON.stringify(evaluate(compileScene(withDepth), 0))).toBe(JSON.stringify(evaluate(compileScene(plain), 0)));
  });

  it("z=0 under perspective is an exact passthrough (no -0)", () => {
    const s = scene({ id: "a", size, camera: { perspective: 900 }, nodes: [r("r", 200, 200, { z: 0 })] });
    const tf = transformOf(s, 0, "r");
    expect(tf).toEqual(placed(200, 200));
    for (const v of tf) expect(Object.is(v, -0)).toBe(false);
  });

  it("a node at depth z is pulled toward the vanishing point by exactly p=d/(d+z)", () => {
    // VP = screen centre (500,400); node at (200,200), d=900, z=900 → p=0.5
    const s = scene({ id: "a", size, camera: { perspective: 900 }, nodes: [r("r", 200, 200, { z: 900 })] });
    const tf = transformOf(s, 0, "r");
    const p = 900 / (900 + 900);
    expect(tf[0]).toBeCloseTo(p, 10); // linear part scaled by p
    expect(tf[4]).toBeCloseTo(500 + (200 - 500) * p, 6); // e pulled toward VP
    expect(tf[5]).toBeCloseTo(400 + (200 - 400) * p, 6);
  });

  it("depth converges to the frame centre (the optical axis), not the scene origin", () => {
    // a node ON the camera look-at lands at frame centre, so projecting about the centre
    // leaves it fixed regardless of depth (it's on the optical axis)
    const s = scene({ id: "a", size, camera: { x: 200, y: 200, perspective: 900 }, nodes: [r("r", 200, 200, { z: 500 })] });
    const tf = transformOf(s, 0, "r");
    expect(tf[4]).toBeCloseTo(500, 6);
    expect(tf[5]).toBeCloseTo(400, 6);
    // an off-axis node recedes toward the frame centre as z grows
    const off = scene({ id: "a", size, camera: { perspective: 900 }, nodes: [r("o", 100, 100, { z: 900 })] });
    const t2 = transformOf(off, 0, "o");
    expect(t2[4]).toBeCloseTo(500 + (100 - 500) * 0.5, 6); // pulled halfway to centre (p=0.5)
    expect(t2[5]).toBeCloseTo(400 + (100 - 400) * 0.5, 6);
  });

  it("parallax: a near node moves more in screen-x than a far node when the camera pans", () => {
    const build = (camX: number) =>
      scene({
        id: "a", size, camera: { x: camX, y: 400, perspective: 800 },
        nodes: [r("near", 500, 400, { z: 0 }), r("far", 500, 400, { z: 800 })],
      });
    const nearShift = transformOf(build(600), 0, "near")[4] - transformOf(build(400), 0, "near")[4];
    const farShift = transformOf(build(600), 0, "far")[4] - transformOf(build(400), 0, "far")[4];
    // far node (p=0.5) shifts half as much as the near node (p=1)
    expect(Math.abs(farShift)).toBeCloseTo(Math.abs(nearShift) * 0.5, 4);
  });

  it("dolly: animating camera.perspective changes the depth factor monotonically", () => {
    const s = scene({
      id: "a", size, camera: { perspective: 600 },
      nodes: [r("r", 200, 200, { z: 600 })],
      timeline: tween("camera", { perspective: 1800 }, { duration: 1, ease: "linear" }),
    });
    const scaleAt = (t: number) => transformOf(s, t, "r")[0];
    // p = d/(d+600): d 600→1800 ⇒ p 0.5→0.75, strictly increasing
    expect(scaleAt(0)).toBeCloseTo(0.5, 6);
    expect(scaleAt(1)).toBeCloseTo(0.75, 6);
    expect(scaleAt(0.5)).toBeGreaterThan(scaleAt(0));
    expect(scaleAt(1)).toBeGreaterThan(scaleAt(0.5));
  });

  it("card flip: rotateY foreshortens scaleX by cos (≈0 edge-on at 90°)", () => {
    const at = (deg: number) =>
      transformOf(scene({ id: "a", size, camera: { perspective: 900 }, nodes: [r("r", 500, 400, { rotateY: deg })] }), 0, "r")[0];
    expect(at(0)).toBeCloseTo(1, 6);
    expect(at(60)).toBeCloseTo(0.5, 6); // |cos 60| = 0.5
    expect(at(90)).toBeCloseTo(0, 6); // edge-on
  });

  it("a fixed HUD node ignores depth convergence (perspective is part of the camera)", () => {
    const s = scene({
      id: "a", size, camera: { perspective: 900 },
      nodes: [rect({ id: "hud", x: 100, y: 100, width: 50, height: 50, anchor: "center", fill: "#fff", fixed: true, z: 500 })],
    });
    // fixed → no camera, no projection → raw local matrix
    expect(transformOf(s, 0, "hud")).toEqual(placed(100, 100));
  });

  it("a clipped group's clip transform is projected by the group depth", () => {
    const s = scene({
      id: "a", size, camera: { perspective: 800 },
      nodes: [
        group({ id: "g", x: 0, y: 0, z: 800, clip: { kind: "rect", x: 0, y: 0, width: 200, height: 200 } }, [
          r("child", 100, 100),
        ]),
      ],
    });
    const child = opOf(s, 0, "child");
    // the inherited clip transform is projected (≠ the un-projected group matrix)
    expect(child.clips?.[0]?.transform).toBeDefined();
    expect(child.clips![0]!.transform).not.toEqual([1, 0, 0, 1, 0, 0]);
    // child and its clip share the group depth → same projection factor p=0.5
    expect(child.transform[0]).toBeCloseTo(0.5, 6);
    expect(child.clips![0]!.transform[0]).toBeCloseTo(0.5, 6);
  });

  it("a tilted GROUP foreshortens its whole subtree (cos folds into children)", () => {
    const s = scene({
      id: "a", size, camera: { perspective: 900 },
      nodes: [group({ id: "g", x: 0, y: 0, rotateY: 60 }, [r("c", 500, 400)])],
    });
    // the group's cos(60)=0.5 is inherited by the child's linear part
    expect(transformOf(s, 0, "c")[0]).toBeCloseTo(0.5, 6);
  });

  it("is deterministic (same compile → identical ops)", () => {
    const build = () =>
      scene({
        id: "a", size, camera: { perspective: 900 },
        nodes: [r("r", 300, 300, { z: 400, rotateY: 25 })],
        timeline: seq(tween("r", { z: 1200 }, { duration: 1, ease: "easeInOutCubic" })),
      });
    expect(JSON.stringify(evaluate(compileScene(build()), 0.5))).toBe(JSON.stringify(evaluate(compileScene(build()), 0.5)));
  });
});
