import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, ellipse, rect } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";

const size = { width: 100, height: 100 };
const opAt = (s: ReturnType<typeof scene>, t: number, id = "r") =>
  evaluate(compileScene(s), t).find((o) => o.id === id) as unknown as Record<string, unknown>;

describe("backdrop (liquid glass)", () => {
  it("an authored backdrop lands on the rect DisplayOp", () => {
    const s = scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", backdrop: { blur: 22, saturate: 1.3 } })] });
    expect(opAt(s, 0).backdrop).toEqual({ blur: 22, saturate: 1.3 });
  });

  it("works on an ellipse too", () => {
    const s = scene({ id: "a", size, nodes: [ellipse({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", backdrop: { blur: 8 } })] });
    expect(opAt(s, 0).backdrop).toEqual({ blur: 8 });
  });

  it("absent ⇒ no field (byte-identity guard)", () => {
    const s = scene({ id: "b", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })] });
    expect(opAt(s, 0).backdrop).toBeUndefined();
  });

  it("is deterministic", () => {
    const build = () => scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", backdrop: { blur: 16, saturate: 1.2, brightness: 1.05 } })] });
    expect(JSON.stringify(evaluate(compileScene(build()), 0))).toBe(JSON.stringify(evaluate(compileScene(build()), 0)));
  });
});
