import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { composeScene } from "../src/compose.js";
import { beat, rect, scene, seq, tween, wait } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";

const size = { width: 1920, height: 1080 };
const card = (extra = {}) =>
  rect({ id: "card", x: 0, y: 0, width: 50, height: 50, fill: "#111111", opacity: 0, ...extra });

describe("beats", () => {
  it("beat(name, {}, [...]) is equivalent to seq([...]) (additive)", () => {
    const steps = () => [tween("card", { opacity: 1 }, { duration: 0.5, label: "in" }), wait(0.5)];
    const withBeat = compileScene(scene({ id: "b", size, nodes: [card()], timeline: beat("rev", {}, steps()) }));
    const withSeq = compileScene(scene({ id: "s", size, nodes: [card()], timeline: seq(...steps()) }));
    expect(withBeat.duration).toBe(withSeq.duration);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(evaluate(withBeat, t)).toEqual(evaluate(withSeq, t));
    }
    expect([...withBeat.beatTimes.keys()]).toEqual(["rev"]); // beat addressable
    expect(withBeat.labelTimes.get("in")?.t0).toBe(0); // child label intact
  });

  it("beat retime is rigid: child label shifts exactly, and a sub-beat edit survives", () => {
    const base = scene({
      id: "demo",
      size,
      nodes: [card()],
      timeline: seq(
        wait(0.5),
        beat("reveal", {}, [tween("card", { opacity: 1 }, { duration: 0.5, label: "card-in" })]),
      ),
    });
    expect(compileScene(base).labelTimes.get("card-in")?.t0).toBe(0.5);

    const { ir, report } = composeScene(base, {
      reframeOverlay: 1,
      name: "edits",
      target: "demo",
      nodes: { card: { fill: "#FF0000" } }, // a sub-beat edit (the node the beat animates)
      timeline: { reveal: { gap: 1.0 } }, // move the whole beat +1.0s
    });
    const c = compileScene(ir);
    expect(report.orphans).toHaveLength(0);
    // (a) the node edit survived the beat move
    expect(c.initialValues.get("card.fill")).toBe("#FF0000");
    // (b) the child's absolute time shifted by exactly +1.0s
    expect(c.labelTimes.get("card-in")?.t0).toBeCloseTo(1.5, 6);
    expect(c.beatTimes.get("reveal")?.t0).toBeCloseTo(1.5, 6);
  });

  it("reorder via overlay `order` swaps beats and recomputes child times", () => {
    const base = scene({
      id: "demo",
      size,
      nodes: [card()],
      timeline: seq(
        beat("a", {}, [tween("card", { opacity: 1 }, { duration: 0.5, label: "La" })]),
        beat("b", {}, [tween("card", { opacity: 0.5 }, { duration: 0.5, label: "Lb" })]),
      ),
    });
    const c0 = compileScene(base);
    expect(c0.labelTimes.get("La")?.t0).toBe(0);
    expect(c0.labelTimes.get("Lb")?.t0).toBe(0.5);

    const { ir, report } = composeScene(base, {
      reframeOverlay: 1,
      name: "swap",
      target: "demo",
      timeline: { a: { order: 1 }, b: { order: 0 } },
    });
    const c = compileScene(ir);
    expect(report.orphans).toHaveLength(0);
    expect(c.labelTimes.get("Lb")?.t0).toBe(0); // b now runs first
    expect(c.labelTimes.get("La")?.t0).toBe(0.5);
  });

  it("removeTimeline splices a beat out of its seq and later steps ripple up", () => {
    const base = scene({
      id: "demo",
      size,
      nodes: [card()],
      timeline: seq(
        beat("a", {}, [tween("card", { opacity: 1 }, { duration: 0.5, label: "La" })]),
        beat("b", {}, [tween("card", { opacity: 0.5 }, { duration: 0.5, label: "Lb" })]),
        beat("c", {}, [tween("card", { opacity: 0.2 }, { duration: 0.5, label: "Lc" })]),
      ),
    });
    expect(compileScene(base).labelTimes.get("Lc")?.t0).toBe(1.0);

    const { ir, report } = composeScene(base, {
      reframeOverlay: 1,
      name: "drop",
      target: "demo",
      removeTimeline: ["b"],
    });
    const c = compileScene(ir);
    expect(report.orphans).toHaveLength(0);
    expect(report.applied.some((a) => a.action === "remove-timeline" && a.address === "removeTimeline.b")).toBe(true);
    expect(c.beatTimes.has("b")).toBe(false); // gone
    expect(c.labelTimes.has("Lb")).toBe(false); // its child went with it
    expect(c.labelTimes.get("La")?.t0).toBe(0); // a unchanged
    expect(c.labelTimes.get("Lc")?.t0).toBe(0.5); // c rippled up by b's 0.5s
    expect(c.duration).toBeCloseTo(1.0, 6); // two 0.5s beats remain
  });

  it("removeTimeline orphans an unknown label and leaves the timeline intact", () => {
    const base = scene({
      id: "demo",
      size,
      nodes: [card()],
      timeline: seq(beat("a", {}, [tween("card", { opacity: 1 }, { duration: 0.5, label: "La" })])),
    });
    const { ir, report } = composeScene(base, {
      reframeOverlay: 1,
      name: "x",
      target: "demo",
      removeTimeline: ["nope"],
    });
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]!.address).toBe("removeTimeline.nope");
    expect(compileScene(ir).labelTimes.get("La")?.t0).toBe(0); // untouched
  });

  it("scale stretches the interior proportionally", () => {
    const c = compileScene(
      scene({
        id: "sc",
        size,
        nodes: [card()],
        timeline: beat("rev", { scale: 2 }, [
          tween("card", { opacity: 1 }, { duration: 0.5, label: "in" }),
          wait(0.5),
        ]),
      }),
    );
    expect(c.duration).toBe(2);
    expect(c.labelTimes.get("in")?.t1).toBe(1); // 0.5s tween stretched to 1.0s
  });

  it("orphans an unknown beat and rejects a non-patchable key", () => {
    const base = scene({
      id: "demo",
      size,
      nodes: [card()],
      timeline: beat("reveal", {}, [tween("card", { opacity: 1 }, { duration: 0.5 })]),
    });
    const miss = composeScene(base, {
      reframeOverlay: 1,
      name: "x",
      target: "demo",
      timeline: { nope: { gap: 1 } },
    });
    expect(miss.report.orphans).toHaveLength(1);

    const bad = composeScene(base, {
      reframeOverlay: 1,
      name: "y",
      target: "demo",
      timeline: { reveal: { ease: "linear" } }, // ease is not patchable on a beat
    });
    expect(bad.report.orphans).toHaveLength(1);
  });
});
