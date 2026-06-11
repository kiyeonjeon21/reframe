import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { collectImageSrcs } from "../src/assets.js";
import { group, image, scene, seq, tween, wait } from "../src/dsl.js";
import { evaluate, type DisplayOp } from "../src/evaluate.js";
import { SceneValidationError, validateScene } from "../src/validate.js";

const base = { x: 0, y: 0, width: 40, height: 20 };

describe("image node", () => {
  it("emits an image op with raw src, box and anchor offsets", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [image({ id: "a", src: "plates/p.png", ...base, anchor: "center" })],
    });
    const [op] = evaluate(compileScene(s), 0) as Extract<DisplayOp, { type: "image" }>[];
    expect(op).toMatchObject({
      type: "image",
      src: "plates/p.png", // raw, unresolved — consumers resolve it
      width: 40,
      height: 20,
      offsetX: -20,
      offsetY: -10,
    });
  });

  it("multiplies parent group opacity and culls at zero", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [
        group({ id: "g", x: 0, y: 0, opacity: 0.5 }, [
          image({ id: "a", src: "p.png", ...base }),
          image({ id: "b", src: "q.png", ...base, opacity: 0 }),
        ]),
      ],
    });
    const ops = evaluate(compileScene(s), 0);
    expect(ops).toHaveLength(1); // b culled
    expect(ops[0]!.opacity).toBeCloseTo(0.5);
  });

  it("steps src discretely at segment start (no crossfade)", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [image({ id: "a", src: "one.png", ...base })],
      timeline: seq(wait(0.5), tween("a", { src: "two.png" }, { duration: 1 })),
    });
    const c = compileScene(s);
    const srcAt = (t: number) => (evaluate(c, t)[0] as { src: string }).src;
    expect(srcAt(0.3)).toBe("one.png"); // before the segment
    expect(srcAt(0.7)).toBe("two.png"); // strings switch at segment start
  });

  it("rejects unknown props with the valid list", () => {
    expect(() =>
      validateScene({
        version: 1,
        id: "t",
        size: { width: 100, height: 100 },
        nodes: [{ type: "image", id: "a", props: { ...base, src: "p.png", fill: "#fff" } as never }],
        states: { s: { a: { fill: "#000" } } },
      }),
    ).toThrow(SceneValidationError);
  });

  it("collectImageSrcs finds base, state, and tween srcs, deduped", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [
        group({ id: "g", x: 0, y: 0 }, [image({ id: "a", src: "base.png", ...base })]),
        image({ id: "b", src: "base.png", ...base }),
      ],
      states: { alt: { a: { src: "state.png" } } },
      timeline: seq(tween("b", { src: "tweened.png" }, { duration: 0.5 })),
    });
    expect(collectImageSrcs(s)).toEqual(["base.png", "state.png", "tweened.png"]);
  });
});
