import { describe, expect, it } from "vitest";
import { evaluate } from "../src/evaluate.js";
import { scene, rect, group } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";

const size = { width: 1000, height: 800 };
// the draw-op ids in paint order (skips the matte/group-fx boundary markers)
const DRAW = new Set(["rect", "ellipse", "line", "text", "image", "video", "path"]);
const order = (s: ReturnType<typeof scene>, t = 0): string[] =>
  evaluate(compileScene(s), t).filter((o) => DRAW.has(o.type)).map((o) => o.id);

const card = (id: string, z: number, extra: Record<string, unknown> = {}) =>
  rect({ id, x: 500, y: 400, width: 100, height: 100, anchor: "center", fill: "#fff", z, ...extra });

describe("z-sort occlusion", () => {
  it("BYTE-IDENTITY GUARD: z without zSort keeps array paint order", () => {
    const nodes = [card("near", 0), card("far", 500)];
    const noSort = scene({ id: "a", size, camera: { perspective: 900 }, nodes });
    expect(order(noSort)).toEqual(["near", "far"]); // declared order, unchanged
    // and the whole DisplayList equals the same scene without zSort declared
    const explicitOff = scene({ id: "a", size, camera: { perspective: 900, zSort: false }, nodes: [card("near", 0), card("far", 500)] });
    expect(JSON.stringify(evaluate(compileScene(explicitOff), 0))).toBe(
      JSON.stringify(evaluate(compileScene(noSort), 0)),
    );
  });

  it("zSort draws far→near so a later-declared near node lands on top", () => {
    // far is declared SECOND but sits behind; with zSort it must paint FIRST
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, zSort: true },
      nodes: [card("near", 0), card("far", 500), card("mid", 250)],
    });
    expect(order(s)).toEqual(["far", "mid", "near"]); // far (500) → mid (250) → near (0)
  });

  it("equal-depth siblings keep their authored order (stable)", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, zSort: true },
      nodes: [card("a", 100), card("b", 100), card("c", 100)],
    });
    expect(order(s)).toEqual(["a", "b", "c"]);
  });

  it("a fixed HUD stays on top regardless of depth", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, zSort: true },
      nodes: [card("hud", 0, { fixed: true }), card("far", 500), card("near", 0)],
    });
    // far→near for the projected nodes, then the HUD last (drawn on top)
    expect(order(s)).toEqual(["far", "near", "hud"]);
  });

  it("z-sorts nested group children too", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, zSort: true },
      nodes: [
        group({ id: "g", x: 0, y: 0 }, [card("gnear", 0), card("gfar", 400)]),
      ],
    });
    expect(order(s)).toEqual(["gfar", "gnear"]);
  });

  it("a track-matte group keeps its child order (first child is the mask)", () => {
    const s = scene({
      id: "a", size,
      camera: { perspective: 900, zSort: true },
      nodes: [
        group({ id: "m", x: 0, y: 0, matte: "alpha" }, [card("mask", 500), card("content", 0)]),
      ],
    });
    // even though content (z 0) is nearer, the mask stays first — matte is exempt
    expect(order(s)).toEqual(["mask", "content"]);
  });

  it("zSort without perspective is inert (no reorder)", () => {
    const s = scene({ id: "a", size, camera: { zSort: true }, nodes: [card("near", 0), card("far", 500)] });
    expect(order(s)).toEqual(["near", "far"]);
  });
});
