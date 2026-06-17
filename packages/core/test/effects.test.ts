import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, rect, tween } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { glow, dropShadow } from "../src/effects.js";
import { SceneValidationError } from "../src/validate.js";

const size = { width: 100, height: 100 };
const opAt = (s: ReturnType<typeof scene>, t: number, id = "r") =>
  evaluate(compileScene(s), t).find((o) => o.id === id) as unknown as Record<string, unknown>;

describe("shadow / glow / blur", () => {
  it("glow / dropShadow build the right partial props", () => {
    expect(glow("#FFD24B", 28)).toEqual({ shadowColor: "#FFD24B", shadowBlur: 28, shadowX: 0, shadowY: 0 });
    expect(dropShadow("#0008", 40, 0, 16)).toEqual({ shadowColor: "#0008", shadowBlur: 40, shadowX: 0, shadowY: 16 });
  });

  it("authored effects land on the DisplayOp", () => {
    const s = scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", blur: 6, ...dropShadow("#000", 30, 2, 8) })] });
    const op = opAt(s, 0);
    expect(op).toMatchObject({ blur: 6, shadowColor: "#000", shadowBlur: 30, shadowX: 2, shadowY: 8 });
  });

  it("a node with no effects adds no fields (byte-identity guard)", () => {
    const s = scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })] });
    const op = opAt(s, 0);
    for (const k of ["blur", "shadowColor", "shadowBlur", "shadowX", "shadowY"]) expect(op[k]).toBeUndefined();
  });

  it("shadowBlur and blur animate through tween/sampleProp", () => {
    const s = scene({
      id: "a",
      size,
      nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", shadowColor: "#000", shadowBlur: 0, blur: 0 })],
      timeline: tween("r", { shadowBlur: 40, blur: 8 }, { duration: 1, ease: "linear" }),
    });
    const c = compileScene(s);
    const at = (t: number) => evaluate(c, t).find((o) => o.id === "r") as { shadowBlur: number; blur: number };
    expect(at(0)).toMatchObject({ shadowBlur: 0, blur: 0 });
    expect(at(0.5)).toMatchObject({ shadowBlur: 20, blur: 4 });
    expect(at(1)).toMatchObject({ shadowBlur: 40, blur: 8 });
  });

  it("shadowColor lerps as a color", () => {
    const s = scene({
      id: "a",
      size,
      nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", shadowColor: "#000000" })],
      timeline: tween("r", { shadowColor: "#ffffff" }, { duration: 1, ease: "linear" }),
    });
    expect((opAt(s, 0.5).shadowColor as string).toLowerCase()).toBe("#808080");
  });

  it("is deterministic", () => {
    const build = () => scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", ...glow("#FFC24B", 24) })] });
    expect(JSON.stringify(evaluate(compileScene(build()), 0))).toBe(JSON.stringify(evaluate(compileScene(build()), 0)));
  });

  it("validation rejects negative blur / shadowBlur", () => {
    expect(() => scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, blur: -2 })] })).toThrow(SceneValidationError);
    expect(() => scene({ id: "b", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, shadowColor: "#000", shadowBlur: -5 })] })).toThrow(SceneValidationError);
  });
});
