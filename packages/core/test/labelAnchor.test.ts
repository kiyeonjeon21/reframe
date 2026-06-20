import { describe, expect, it } from "vitest";
import { scene, rect, seq, par, beat, tween, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { validateScene, SceneValidationError } from "../src/validate.js";

// A montage-like base: a sequential "track" with labeled steps, plus an overlay
// layer (a title beat) anchored to one of those labels via `at: "<label>"`.
const build = (firstDur: number, anchorGap = 0) =>
  scene({
    id: "anchor",
    size: { width: 100, height: 100 },
    nodes: [
      rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" }),
      rect({ id: "b", x: 0, y: 0, width: 10, height: 10, fill: "#fff" }),
      rect({ id: "t", x: 0, y: 0, width: 10, height: 10, fill: "#f00", opacity: 0 }),
    ],
    timeline: par(
      // the "track": shot-0 then shot-1, sequential
      seq(
        tween("a", { x: 50 }, { duration: firstDur, label: "shot-0" }),
        tween("b", { x: 50 }, { duration: 1, label: "shot-1" }),
      ),
      // the "overlay": a title anchored to shot-1's start
      beat("title", { at: "shot-1", gap: anchorGap }, [tween("t", { opacity: 1 }, { duration: 0.3 })]),
    ),
  });

describe("label-anchored beat placement", () => {
  it("a beat with at:'<label>' starts at that label's t0", () => {
    const c = compileScene(build(2));
    expect(c.labelTimes.get("shot-1")!.t0).toBe(2); // shot-0 (dur 2) then shot-1
    expect(c.beatTimes.get("title")!.t0).toBe(2); // the anchored title lands on shot-1
  });

  it("`gap` offsets the anchor", () => {
    const c = compileScene(build(2, 0.5));
    expect(c.beatTimes.get("title")!.t0).toBeCloseTo(2.5, 5);
  });

  it("ripples: lengthening shot-0 moves shot-1 AND the anchored title together", () => {
    const c = compileScene(build(4)); // shot-0 now 4s long
    expect(c.labelTimes.get("shot-1")!.t0).toBe(4);
    expect(c.beatTimes.get("title")!.t0).toBe(4); // followed the retime, not pinned to 2
  });

  it("resolves a label defined AFTER the anchor in the tree (order-independent)", () => {
    const s = scene({
      id: "fwd",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "t", x: 0, y: 0, width: 10, height: 10, fill: "#f00" }), rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })],
      timeline: par(
        beat("title", { at: "late" }, [tween("t", { opacity: 1 }, { duration: 0.3 })]), // anchor first
        seq(wait(1), tween("a", { x: 9 }, { duration: 1, label: "late" })), // target defined later
      ),
    });
    expect(compileScene(s).beatTimes.get("title")!.t0).toBe(1);
  });

  it("numeric `at` is unchanged, and a no-anchor scene compiles byte-identically", () => {
    const numeric = scene({
      id: "num", size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })],
      timeline: beat("b", { at: 1.5 }, [tween("a", { x: 9 }, { duration: 0.5 })]),
    });
    expect(compileScene(numeric).beatTimes.get("b")!.t0).toBe(1.5);
  });

  it("validateScene rejects an unknown or self anchor", () => {
    const unknown = () =>
      scene({ id: "u", size: { width: 100, height: 100 }, nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })], timeline: beat("b", { at: "nope" }, [tween("a", { x: 9 }, { duration: 0.5 })]) });
    expect(unknown).toThrow(SceneValidationError);
    expect(unknown).toThrow(/unknown timeline label/);
    const self = () =>
      scene({ id: "s", size: { width: 100, height: 100 }, nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })], timeline: beat("b", { at: "b" }, [tween("a", { x: 9 }, { duration: 0.5 })]) });
    expect(self).toThrow(/cannot anchor to itself/);
  });

  it("is deterministic — same scene compiles to identical beat times", () => {
    const a = compileScene(build(3));
    const b = compileScene(build(3));
    expect([...a.beatTimes]).toEqual([...b.beatTimes]);
  });
});
