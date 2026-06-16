import { describe, expect, it } from "vitest";
import { scene, seq, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { validateScene } from "../src/validate.js";
import { splitText, textIn, textLoop, textOut } from "../src/textFx.js";
import type { TimelineIR } from "../src/ir.js";

const T = splitText("MOTION IS DATA", { id: "t", x: 960, y: 470, fontSize: 130, fontWeight: 800 });

function tweens(tl: TimelineIR): { target: string; duration: number | undefined }[] {
  switch (tl.kind) {
    case "beat":
    case "seq":
    case "par":
    case "stagger":
      return tl.children.flatMap(tweens);
    case "tween":
      return [{ target: tl.target, duration: tl.duration }];
    default:
      return [];
  }
}

describe("splitText", () => {
  it("splits to per-glyph centred nodes, skipping spaces, left to right", () => {
    expect(T.glyphs.length).toBe(12); // "MOTION IS DATA" minus 2 spaces
    expect(T.nodes.length).toBe(12);
    expect(T.ids).toEqual(T.glyphs.map((g) => g.id));
    // monotonic left-to-right, total width positive
    for (let i = 1; i < T.glyphs.length; i++) expect(T.glyphs[i]!.x).toBeGreaterThan(T.glyphs[i - 1]!.x);
    expect(T.width).toBeGreaterThan(0);
    // centred about x: midpoint of the line's left & right edges ≈ 960
    const left = T.glyphs[0]!.x - T.glyphs[0]!.advance / 2;
    const right = T.glyphs[11]!.x + T.glyphs[11]!.advance / 2;
    expect((left + right) / 2).toBeCloseTo(960, 1);
  });

  it("word unit makes one node per word", () => {
    const W = splitText("MOTION IS DATA", { id: "w", x: 960, y: 470, fontSize: 100, unit: "word" });
    expect(W.glyphs.map((g) => g.ch)).toEqual(["MOTION", "IS", "DATA"]);
  });
});

describe("textIn / textLoop / textOut", () => {
  it("every textIn name → a matching beat that drives only the block's glyphs", () => {
    for (const name of ["typewriter", "cascade", "rise", "bounce", "assemble", "decode"] as const) {
      const b = textIn(name, T) as Extract<TimelineIR, { kind: "beat" }>;
      expect(b.kind).toBe("beat");
      expect(b.name).toBe(`text-in-${name}`);
      const ids = new Set(T.ids);
      for (const { target } of tweens(b)) expect(ids.has(target)).toBe(true);
    }
  });

  it("textOut names → beats over the glyphs", () => {
    for (const name of ["shatter", "fly", "dissolve", "fall", "collapse"] as const) {
      const b = textOut(name, T, { seed: 2 }) as Extract<TimelineIR, { kind: "beat" }>;
      expect(b.name).toBe(`text-out-${name}`);
      expect(tweens(b).length).toBeGreaterThan(0);
    }
  });

  it("textLoop → one oscillate behavior per glyph over the glyph ids", () => {
    const bs = textLoop("wave", T, { from: 1.6, until: 3.6 });
    expect(bs.length).toBe(T.glyphs.length);
    expect(bs.map((b) => b.target)).toEqual(T.ids);
    expect(bs[0]!.from).toBe(1.6);
  });

  it("is deterministic; speed scales the entrance duration", () => {
    expect(JSON.stringify(textIn("assemble", T, { seed: 1 }))).toBe(JSON.stringify(textIn("assemble", T, { seed: 1 })));
    expect(JSON.stringify(textOut("shatter", T, { seed: 1 }))).not.toBe(JSON.stringify(textOut("shatter", T, { seed: 2 })));
    const maxDur = (sp: number) => Math.max(...tweens(textIn("cascade", T, { speed: sp })).map((t) => t.duration ?? 0));
    expect(maxDur(2)).toBeCloseTo(maxDur(1) / 2, 5);
  });

  it("composes into a scene that compiles and validates", () => {
    const s = scene({
      id: "s", size: { width: 1920, height: 1080 }, fps: 30,
      nodes: [...T.nodes],
      timeline: seq(textIn("typewriter", T), wait(1), textOut("shatter", T)),
      behaviors: textLoop("wave", T, { from: 0.5, until: 1.5 }),
    });
    expect(() => validateScene(s)).not.toThrow();
    expect(() => compileScene(s)).not.toThrow();
  });
});
