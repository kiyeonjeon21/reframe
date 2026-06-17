import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, group, rect, text } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { SceneValidationError } from "../src/validate.js";

const size = { width: 100, height: 100 };
const r = (id: string) => rect({ id, x: 0, y: 0, width: 10, height: 10, fill: "#fff" });
const types = (s: ReturnType<typeof scene>) => evaluate(compileScene(s), 0).map((o) => o.type);

describe("track matte markers", () => {
  it("brackets the matte child + content children with push/sep/pop", () => {
    const s = scene({
      id: "a", size,
      nodes: [group({ id: "m", x: 0, y: 0, matte: "alpha" }, [text({ id: "mask", x: 0, y: 0, content: "HI", fontFamily: "Inter", fontSize: 40 }), r("c1"), r("c2")])],
    });
    expect(types(s)).toEqual(["matte-push", "text", "matte-sep", "rect", "rect", "matte-pop"]);
    const ops = evaluate(compileScene(s), 0);
    expect(ops[0]).toMatchObject({ type: "matte-push", id: "m", mode: "alpha" });
    expect(ops.at(-1)).toMatchObject({ type: "matte-pop", id: "m" });
  });

  it("a non-matte group emits no markers (byte-identity guard)", () => {
    const s = scene({ id: "a", size, nodes: [group({ id: "g", x: 0, y: 0 }, [r("c1"), r("c2")])] });
    expect(types(s)).toEqual(["rect", "rect"]);
  });

  it("a matte group with <2 children is rejected by validation", () => {
    expect(() => scene({ id: "a", size, nodes: [group({ id: "m", x: 0, y: 0, matte: "alpha" }, [r("only")])] })).toThrow(SceneValidationError);
  });

  it("rejects an unknown matte mode", () => {
    expect(() => scene({ id: "a", size, nodes: [group({ id: "m", x: 0, y: 0, matte: "wipe" as never }, [r("c1"), r("c2")])] })).toThrow(SceneValidationError);
  });

  it("supports luma mode and is deterministic", () => {
    const build = () => scene({ id: "a", size, nodes: [group({ id: "m", x: 0, y: 0, matte: "luma" }, [r("mask"), r("c")])] });
    expect((evaluate(compileScene(build()), 0)[0] as { mode?: string }).mode).toBe("luma");
    expect(JSON.stringify(evaluate(compileScene(build()), 0))).toBe(JSON.stringify(evaluate(compileScene(build()), 0)));
  });
});
