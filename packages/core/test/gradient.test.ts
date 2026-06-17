import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, rect, path } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { linearGradient, radialGradient, conicGradient, isGradient } from "../src/gradient.js";
import { pathBBox } from "../src/path.js";
import { SceneValidationError } from "../src/validate.js";

const size = { width: 100, height: 100 };
const opOf = (s: ReturnType<typeof scene>, id: string) =>
  evaluate(compileScene(s), 0).find((o) => o.id === id) as unknown as Record<string, unknown>;

describe("gradient builders", () => {
  it("string[] stops get even offsets; ColorStop[] passes through; opts are kept", () => {
    expect(linearGradient(["#FF0000", "#0000FF"])).toEqual({
      kind: "linear",
      stops: [{ offset: 0, color: "#FF0000" }, { offset: 1, color: "#0000FF" }],
    });
    expect(linearGradient(["#000", "#888", "#fff"])).toEqual({
      kind: "linear",
      stops: [{ offset: 0, color: "#000" }, { offset: 0.5, color: "#888" }, { offset: 1, color: "#fff" }],
    });
    expect(linearGradient(["#000", "#fff"], { angle: 90 })).toMatchObject({ kind: "linear", angle: 90 });
    expect(radialGradient(["#000", "#fff"], { cx: 0.3, r: 0.8 })).toMatchObject({ kind: "radial", cx: 0.3, r: 0.8 });
    expect(conicGradient([{ offset: 0, color: "#000" }, { offset: 1, color: "#fff" }], { angle: 45 })).toMatchObject({
      kind: "conic",
      angle: 45,
    });
  });

  it("isGradient distinguishes paints", () => {
    expect(isGradient(linearGradient(["#000", "#fff"]))).toBe(true);
    expect(isGradient("#ffffff")).toBe(false);
    expect(isGradient(undefined)).toBe(false);
  });
});

describe("gradient evaluation", () => {
  it("a gradient fill passes through to the DisplayOp as an object (not coerced to a string)", () => {
    const grad = linearGradient(["#FF0000", "#0000FF"], { angle: 90 });
    const s = scene({ id: "g", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 50, height: 50, fill: grad })] });
    expect(opOf(s, "r").fill).toEqual(grad);
  });

  it("a string fill is unchanged and adds no bbox (byte-identity guard)", () => {
    const s = scene({ id: "g", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 50, height: 50, fill: "#ffffff" })] });
    const op = opOf(s, "r");
    expect(op.fill).toBe("#ffffff");
    expect(op.bbox).toBeUndefined();
  });

  it("a path with a gradient paint gets a bbox; with a string paint it does not", () => {
    const withGrad = scene({ id: "g", size, nodes: [path({ id: "p", x: 0, y: 0, d: "M0 0 L40 0 L40 30 Z", fill: radialGradient(["#fff", "#000"]) })] });
    expect(opOf(withGrad, "p").bbox).toEqual([0, 0, 40, 30]);
    const withStr = scene({ id: "g2", size, nodes: [path({ id: "p", x: 0, y: 0, d: "M0 0 L40 0 L40 30 Z", fill: "#fff" })] });
    expect(opOf(withStr, "p").bbox).toBeUndefined();
  });

  it("pathBBox reads coordinate extents", () => {
    expect(pathBBox("M0 0 L40 0 L40 30 Z")).toEqual([0, 0, 40, 30]);
    expect(pathBBox("M-10 5 L20 -8 L4 16")).toEqual([-10, -8, 30, 24]);
  });

  it("is deterministic: same scene + t → byte-identical ops", () => {
    const build = () => scene({ id: "g", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 50, height: 50, fill: conicGradient(["#000", "#fff"], { angle: 30 }) })] });
    expect(JSON.stringify(evaluate(compileScene(build()), 0))).toBe(JSON.stringify(evaluate(compileScene(build()), 0)));
  });
});

describe("gradient validation", () => {
  const withFill = (fill: unknown) =>
    scene({ id: "v", size, nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, fill: fill as never })] });

  it("rejects an unknown gradient kind", () => {
    expect(() => withFill({ kind: "sweep", stops: [{ offset: 0, color: "#000" }] })).toThrow(SceneValidationError);
  });
  it("rejects empty stops", () => {
    expect(() => withFill({ kind: "linear", stops: [] })).toThrow(SceneValidationError);
  });
  it("rejects an out-of-range stop offset", () => {
    expect(() => withFill(linearGradient([{ offset: 2, color: "#fff" }, { offset: 0, color: "#000" }]))).toThrow(SceneValidationError);
  });
  it("accepts a valid gradient", () => {
    expect(() => withFill(linearGradient(["#000", "#fff"], { angle: 45 }))).not.toThrow();
  });
});
