import { describe, expect, it } from "vitest";
import {
  scene,
  rect,
  ellipse,
  text,
  token,
  brand,
  compileScene,
  composeScene,
  sceneManifest,
  evaluate,
  linearGradient,
  isGradient,
  type SceneInput,
} from "../src/index.js";

const base = (nodes: SceneInput["nodes"], design?: SceneInput["design"]): SceneInput => ({
  id: "t",
  size: { width: 100, height: 100 },
  fps: 30,
  duration: 1,
  nodes,
  ...(design ? { design } : {}),
});

const box = (fill: string) => rect({ id: "box", x: 0, y: 0, width: 10, height: 10, anchor: "center", fill });

describe("token()", () => {
  it("produces a deferred sentinel string", () => {
    expect(token("color.accent")).toBe("$color.accent");
  });
});

describe("compile-time token resolution", () => {
  it("resolves a color token against the house brand by default", () => {
    const c = compileScene(scene(base([box(token("color.accent"))])));
    expect(c.initialValues.get("box.fill")).toBe(brand.color.accent);
    expect(c.hasDesign).toBe(true);
  });

  it("resolves against the scene's design (deferred, not baked at author time)", () => {
    const c = compileScene(scene(base([box(token("color.accent"))], { color: { accent: "#1E90FF" } })));
    expect(c.initialValues.get("box.fill")).toBe("#1E90FF");
  });

  it("falls back to brand for tokens the partial design does not set", () => {
    const c = compileScene(
      scene(
        base(
          [rect({ id: "box", x: 0, y: 0, width: 10, height: 10, anchor: "center", fill: token("color.bg") })],
          { color: { accent: "#1E90FF" } }, // only accent overridden
        ),
      ),
    );
    expect(c.initialValues.get("box.fill")).toBe(brand.color.bg);
  });

  it("only resolves on color props — a text content of '$5M' is never touched", () => {
    const c = compileScene(
      scene(
        base([
          text({ id: "tx", x: 0, y: 0, anchor: "center", content: "$5M", fontFamily: "Inter", fontSize: 40, fill: token("color.fg") }),
        ]),
      ),
    );
    expect(c.initialValues.get("tx.content")).toBe("$5M"); // not a color prop -> untouched
    expect(c.initialValues.get("tx.fill")).toBe(brand.color.fg); // color prop -> resolved
  });

  it("leaves an unknown token literal rather than crashing", () => {
    const c = compileScene(scene(base([box("$color.nope")])));
    expect(c.initialValues.get("box.fill")).toBe("$color.nope");
  });

  it("is golden-safe: no design and no token ref -> hasDesign false, literal untouched", () => {
    const c = compileScene(scene(base([box("#123456")])));
    expect(c.hasDesign).toBe(false);
    expect(c.initialValues.get("box.fill")).toBe("#123456");
  });
});

describe("overlay re-skin (design.* address)", () => {
  it("patches a design token and re-skins every ref on recompile", () => {
    const s = scene(base([box(token("color.accent"))]));
    const { ir, report } = composeScene(s, { reframeOverlay: 1, design: { "color.accent": "#22C55E" } });
    expect(report.orphans).toHaveLength(0);
    expect(report.applied.some((a) => a.address === "design.color.accent")).toBe(true);
    expect(compileScene(ir).initialValues.get("box.fill")).toBe("#22C55E");
  });

  it("reports an unknown token path as an orphan, never throws", () => {
    const s = scene(base([box(token("color.accent"))]));
    const { report } = composeScene(s, { reframeOverlay: 1, design: { "color.nope": "#000000" } });
    expect(report.orphans.some((o) => o.address === "design.color.nope")).toBe(true);
  });

  it("survives a regen: the same patch re-applies to a redesigned base that keeps the token", () => {
    // v2 has completely different node ids/types but still references color.accent
    const v2 = scene(base([ellipse({ id: "newshape", x: 0, y: 0, width: 20, height: 20, anchor: "center", fill: token("color.accent") })]));
    const { ir, report } = composeScene(v2, { reframeOverlay: 1, design: { "color.accent": "#22C55E" } });
    expect(report.orphans).toHaveLength(0);
    expect(compileScene(ir).initialValues.get("newshape.fill")).toBe("#22C55E");
  });
});

describe("scene background tokens", () => {
  it("resolves a background token onto CompiledScene.background", () => {
    const c = compileScene(scene({ ...base([box("#fff")]), background: token("color.bg") }));
    expect(c.background).toBe(brand.color.bg);
  });

  it("leaves a literal background untouched (golden-safe)", () => {
    const c = compileScene(scene({ ...base([box("#fff")]), background: "#123456" }));
    expect(c.background).toBe("#123456");
    expect(c.hasDesign).toBe(false);
  });
});

describe("gradient-stop tokens", () => {
  const gbox = (fill: ReturnType<typeof linearGradient>) =>
    rect({ id: "g", x: 0, y: 0, width: 10, height: 10, anchor: "center", fill });

  it("resolves a token in a gradient stop at evaluate time", () => {
    const c = compileScene(
      scene(base([gbox(linearGradient([token("color.accent"), "#ffffff"]))], { color: { accent: "#1E90FF" } })),
    );
    const op = evaluate(c, 0).find((o) => o.id === "g");
    const fill = op && "fill" in op ? op.fill : undefined;
    expect(isGradient(fill) ? fill.stops[0]?.color : undefined).toBe("#1E90FF");
  });

  it("returns the same gradient object when no stop is a token (byte-identical)", () => {
    const grad = linearGradient(["#aaaaaa", "#bbbbbb"]);
    const c = compileScene(scene(base([gbox(grad)])));
    const op = evaluate(c, 0).find((o) => o.id === "g");
    const evFill = op && "fill" in op ? op.fill : undefined;
    const node = c.nodeById.get("g");
    const srcFill = node && "fill" in node.props ? node.props.fill : undefined;
    expect(evFill).toBe(srcFill); // referential equality preserved
  });
});

describe("manifest surfaces design tokens", () => {
  it("lists design.<path> addresses with the current effective value", () => {
    const m = sceneManifest(compileScene(scene(base([box(token("color.accent"))], { color: { accent: "#1E90FF" } }))));
    const accent = m.design.find((d) => d.path === "color.accent");
    expect(accent?.address).toBe("design.color.accent");
    expect(accent?.value).toBe("#1E90FF"); // reflects the scene's design override
  });
});
