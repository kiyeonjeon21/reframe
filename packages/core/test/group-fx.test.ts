import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, group, rect, tween } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";

const size = { width: 100, height: 100 };
const r = (id: string) => rect({ id, x: 0, y: 0, width: 10, height: 10, fill: "#fff" });
const types = (s: ReturnType<typeof scene>) => evaluate(compileScene(s), 0).map((o) => o.type);

describe("group composite-effect markers", () => {
  it("wraps the subtree with group-fx-push/pop when the group has blur", () => {
    const s = scene({ id: "a", size, nodes: [group({ id: "g", x: 0, y: 0, blur: 8 }, [r("c1"), r("c2")])] });
    expect(types(s)).toEqual(["group-fx-push", "rect", "rect", "group-fx-pop"]);
    const ops = evaluate(compileScene(s), 0);
    expect(ops[0]).toMatchObject({ type: "group-fx-push", id: "g", blur: 8 });
    expect(ops.at(-1)).toMatchObject({ type: "group-fx-pop", id: "g" });
  });

  it("carries blend and shadow on the push marker", () => {
    const s = scene({
      id: "a", size,
      nodes: [group({ id: "g", x: 0, y: 0, blend: "screen", shadowColor: "#00f", shadowBlur: 12, shadowX: 2, shadowY: 3 }, [r("c1"), r("c2")])],
    });
    expect(evaluate(compileScene(s), 0)[0]).toMatchObject({ type: "group-fx-push", blend: "screen", shadowColor: "#00f", shadowBlur: 12, shadowX: 2, shadowY: 3 });
  });

  it("a plain group (and blend:normal) emits no markers — byte-identity guard", () => {
    const plain = scene({ id: "a", size, nodes: [group({ id: "g", x: 0, y: 0 }, [r("c1"), r("c2")])] });
    expect(types(plain)).toEqual(["rect", "rect"]);
    const normal = scene({ id: "a", size, nodes: [group({ id: "g", x: 0, y: 0, blend: "normal" }, [r("c1"), r("c2")])] });
    expect(types(normal)).toEqual(["rect", "rect"]);
  });

  it("wraps the matte sequence when a group has both matte and fx (fx outermost)", () => {
    const s = scene({
      id: "a", size,
      nodes: [group({ id: "g", x: 0, y: 0, matte: "alpha", blur: 4 }, [r("mask"), r("c1"), r("c2")])],
    });
    expect(types(s)).toEqual(["group-fx-push", "matte-push", "rect", "matte-sep", "rect", "rect", "matte-pop", "group-fx-pop"]);
  });

  it("group blur is animatable and deterministic", () => {
    const build = () => scene({
      id: "a", size,
      nodes: [group({ id: "g", x: 0, y: 0, blur: 0 }, [r("c")])],
      timeline: tween("g", { blur: 20 }, { duration: 1, ease: "linear" }),
    });
    const at = (t: number) => (evaluate(compileScene(build()), t)[0] as { blur?: number }).blur;
    expect(at(0)).toBe(0);
    expect(at(0.5)).toBeCloseTo(10);
    expect(at(1)).toBe(20);
    expect(JSON.stringify(evaluate(compileScene(build()), 0.5))).toBe(JSON.stringify(evaluate(compileScene(build()), 0.5)));
  });
});
