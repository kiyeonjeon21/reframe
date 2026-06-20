import { describe, expect, it } from "vitest";
import { scene, rect, seq, tween, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { autoFoley } from "../src/autoFoley.js";
import type { NodeIR, TimelineIR } from "../src/ir.js";

const base = (nodes: NodeIR[], timeline: TimelineIR) =>
  compileScene(scene({ id: "af", size: { width: 1920, height: 1080 }, fps: 30, background: "#000", nodes, timeline }));

describe("autoFoley", () => {
  it("a fast move that stops → a whoosh during the move + an impact at the settle", () => {
    const c = base(
      [rect({ id: "box", x: 200, y: 540, width: 300, height: 200, anchor: "center" })],
      seq(tween("box", { x: 1600 }, { duration: 0.4 }), wait(1)),
    );
    const cues = autoFoley(c);
    const sfx = cues.map((q) => q.sfx);
    expect(sfx.some((s) => s === "whoosh" || s === "swish")).toBe(true);
    expect(sfx.some((s) => s === "thud" || s === "knock")).toBe(true);
    // the impact lands at/after the move ends (~0.4s)
    const impact = cues.find((q) => q.sfx === "thud" || q.sfx === "knock")!;
    expect(impact.at as number).toBeGreaterThanOrEqual(0.36);
    expect(impact.at as number).toBeLessThan(0.6);
  });

  it("a scale-in → a pop", () => {
    const c = base(
      [rect({ id: "card", x: 960, y: 540, width: 200, height: 120, anchor: "center", scale: 0 })],
      seq(tween("card", { scale: 1 }, { duration: 0.3 }), wait(1)),
    );
    const cues = autoFoley(c);
    expect(cues.some((q) => q.sfx === "pop")).toBe(true);
  });

  it("a static scene produces no cues", () => {
    const c = base(
      [rect({ id: "still", x: 960, y: 540, width: 200, height: 120, anchor: "center" })],
      seq(wait(1)),
    );
    expect(autoFoley(c)).toEqual([]);
  });

  it("is deterministic (same compiled → identical cues)", () => {
    const c = base(
      [rect({ id: "box", x: 200, y: 540, width: 300, height: 200, anchor: "center" })],
      seq(tween("box", { x: 1600 }, { duration: 0.4 }), wait(1)),
    );
    expect(JSON.stringify(autoFoley(c))).toBe(JSON.stringify(autoFoley(c)));
  });

  it("pan follows the node's x side; maxCues caps the count", () => {
    // a node moving on the LEFT half → negative pan
    const left = base(
      [rect({ id: "l", x: 100, y: 540, width: 300, height: 200, anchor: "center" })],
      seq(tween("l", { y: 120 }, { duration: 0.3 }), wait(1)),
    );
    const lc = autoFoley(left).find((q) => q.pan !== undefined);
    expect(lc && (lc.pan as number)).toBeLessThan(0);

    // four movers, capped to 2
    const many = base(
      [0, 1, 2, 3].map((i) => rect({ id: `m${i}`, x: 200 + i * 300, y: 540, width: 200, height: 200, anchor: "center" })),
      seq(...[0, 1, 2, 3].map((i) => tween(`m${i}`, { y: 100 }, { duration: 0.3 })), wait(1)),
    );
    expect(autoFoley(many, undefined as never).length); // smoke
    expect(autoFoley(many, { maxCues: 2 }).length).toBeLessThanOrEqual(2);
  });
});
