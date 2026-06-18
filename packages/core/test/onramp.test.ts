import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, text, tween, seq } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { row, column, grid } from "../src/layout.js";

const size = { width: 1000, height: 800 };
const contentOf = (s: ReturnType<typeof scene>, t: number, id: string): string =>
  (evaluate(compileScene(s), t).find((o) => o.id === id) as { content: string }).content;

describe("numeric text prefix/suffix", () => {
  it("wraps a count-up so $2.4M reads from one node", () => {
    const s = scene({ id: "a", size, nodes: [text({ id: "kpi", x: 0, y: 0, content: 2.4, contentDecimals: 1, prefix: "$", suffix: "M", fontFamily: "Inter", fontSize: 40 })] });
    expect(contentOf(s, 0, "kpi")).toBe("$2.4M");
  });

  it("affixes stay fixed while the number counts up", () => {
    const s = scene({
      id: "a", size,
      nodes: [text({ id: "g", x: 0, y: 0, content: 0, suffix: "%", prefix: "+", fontFamily: "Inter", fontSize: 40 })],
      timeline: tween("g", { content: 32 }, { duration: 1, ease: "linear" }),
    });
    expect(contentOf(s, 0, "g")).toBe("+0%");
    expect(contentOf(s, 0.5, "g")).toBe("+16%");
    expect(contentOf(s, 1, "g")).toBe("+32%");
  });

  it("byte-identity: no prefix/suffix leaves content unchanged", () => {
    const plain = scene({ id: "a", size, nodes: [text({ id: "t", x: 0, y: 0, content: "hi", fontFamily: "Inter", fontSize: 40 })] });
    const withEmpty = scene({ id: "a", size, nodes: [text({ id: "t", x: 0, y: 0, content: "hi", fontFamily: "Inter", fontSize: 40 })] });
    expect(JSON.stringify(evaluate(compileScene(plain), 0))).toBe(JSON.stringify(evaluate(compileScene(withEmpty), 0)));
    expect(contentOf(plain, 0, "t")).toBe("hi");
  });
});

describe("layout helpers", () => {
  it("row packs fixed-width items centred", () => {
    const xs = row(3, { center: 960, gap: 60, itemWidth: 440 });
    expect(xs).toHaveLength(3);
    // symmetric about the centre
    expect(xs[1]).toBeCloseTo(960, 9);
    expect(xs[0]! + xs[2]!).toBeCloseTo(1920, 9);
    expect(xs[2]! - xs[1]!).toBeCloseTo(500, 9); // pitch = itemWidth + gap
  });

  it("row spreads centres across a span", () => {
    expect(row(3, { center: 0, span: 600 })).toEqual([-300, 0, 300]);
  });

  it("row handles 1 and 0", () => {
    expect(row(1, { center: 50 })).toEqual([50]);
    expect(row(0)).toEqual([]);
  });

  it("column is the row helper", () => {
    expect(column).toBe(row);
  });

  it("grid lays out rows x cols, row-major", () => {
    const cells = grid(2, 2, { center: { x: 0, y: 0 }, spanX: 200, spanY: 100 });
    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ x: -100, y: -50 });
    expect(cells[3]).toEqual({ x: 100, y: 50 });
  });
});
