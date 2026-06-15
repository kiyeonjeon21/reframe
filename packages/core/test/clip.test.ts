import { describe, expect, it } from "vitest";
import { scene, group, rect, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { evaluate } from "../src/evaluate.js";
import { SceneValidationError } from "../src/validate.js";

const size = { width: 400, height: 300 };

describe("clip", () => {
  const s = scene({
    id: "s",
    size,
    fps: 30,
    nodes: [
      group({ id: "screen", x: 100, y: 50, clip: { kind: "rect", x: 0, y: 0, width: 80, height: 120, radius: 10 } }, [
        rect({ id: "content", x: 0, y: 0, width: 200, height: 400, fill: "#fff" }),
      ]),
      rect({ id: "outside", x: 0, y: 0, width: 10, height: 10, fill: "#000" }),
    ],
    timeline: wait(1),
  });

  it("a clipped group's child carries the clip (shape + group matrix); outside nodes don't", () => {
    const ops = evaluate(compileScene(s), 0);
    const content = ops.find((o) => o.id === "content")!;
    expect(content.clips).toBeDefined();
    expect(content.clips![0]!.shape).toEqual({ kind: "rect", x: 0, y: 0, width: 80, height: 120, radius: 10 });
    // the clip transform is the group's matrix (top-level group at 100,50)
    expect(content.clips![0]!.transform).toEqual([1, 0, 0, 1, 100, 50]);
    expect(ops.find((o) => o.id === "outside")!.clips).toBeUndefined();
  });

  it("is additive — a scene with no clip emits no `clips` field", () => {
    const plain = scene({ id: "p", size, fps: 30, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })], timeline: wait(1) });
    expect(evaluate(compileScene(plain), 0)[0]!.clips).toBeUndefined();
  });

  it("rejects a clip with non-positive size", () => {
    expect(() =>
      scene({ id: "s", size, fps: 30, nodes: [group({ id: "g", x: 0, y: 0, clip: { kind: "rect", x: 0, y: 0, width: 0, height: 100 } }, [])], timeline: wait(1) }),
    ).toThrow(SceneValidationError);
  });
});
