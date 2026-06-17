import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, ellipse, rect } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { SceneValidationError } from "../src/validate.js";

const size = { width: 100, height: 100 };
const opAt = (s: ReturnType<typeof scene>, t: number, id = "r") =>
  evaluate(compileScene(s), t).find((o) => o.id === id) as unknown as Record<string, unknown>;

describe("blend modes", () => {
  it("an authored blend lands on the DisplayOp", () => {
    const s = scene({ id: "a", size, nodes: [ellipse({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", blend: "screen" })] });
    expect(opAt(s, 0).blend).toBe("screen");
  });

  it('"normal" and absent add no field (byte-identity guard)', () => {
    const normal = scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", blend: "normal" })] });
    const none = scene({ id: "b", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })] });
    expect(opAt(normal, 0).blend).toBeUndefined();
    expect(opAt(none, 0).blend).toBeUndefined();
  });

  it("validation rejects an unknown blend mode", () => {
    expect(() =>
      scene({ id: "a", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, blend: "glow" as never })] }),
    ).toThrow(SceneValidationError);
  });

  it("is deterministic", () => {
    const build = () => scene({ id: "a", size, nodes: [ellipse({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", blend: "add" })] });
    expect(JSON.stringify(evaluate(compileScene(build()), 0))).toBe(JSON.stringify(evaluate(compileScene(build()), 0)));
  });

  it("composes with shadow/blur effects on one node", () => {
    const s = scene({ id: "a", size, nodes: [ellipse({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: "#fff", blend: "screen", blur: 4, shadowColor: "#FFD24B", shadowBlur: 20 })] });
    expect(opAt(s, 0)).toMatchObject({ blend: "screen", blur: 4, shadowColor: "#FFD24B", shadowBlur: 20 });
  });
});
