import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { rect, scene } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { sketchToTimeline, type MotionSketch } from "../src/motion.js";

const reliable = { class: "decelerating", thirdsRatio: 2, reliable: true };
const sketch = (events: MotionSketch["events"]): MotionSketch => ({
  duration: 4,
  fps: 30,
  events,
  rhythm: { periodicityHz: null, beatCount: events.length },
});

/** A scene whose nodes start hidden (opacity 0), driven by the emitted timeline. */
function sceneWith(timeline: ReturnType<typeof sketchToTimeline>, n: number) {
  return scene({
    id: "t",
    size: { width: 1920, height: 1080 },
    fps: 30,
    nodes: Array.from({ length: n }, (_, i) =>
      rect({ id: `n${i}`, x: 100 * i, y: 0, width: 50, height: 50, fill: "#fff", opacity: 0 }),
    ),
    timeline,
  });
}

const op = (c: ReturnType<typeof compileScene>, t: number, id: string) =>
  evaluate(c, t).find((o) => o.id === id);

describe("sketchToTimeline", () => {
  it("enter event drives opacity 0→1 over [t0,t1] with the event's onset", () => {
    const tl = sketchToTimeline(
      sketch([{ t0: 1.0, t1: 1.6, kind: "enter", region: { x: 0, y: 0, w: 0.2, h: 0.2 }, magnitude: 0.1, easing: reliable }]),
      ["n0"],
    );
    const c = compileScene(sceneWith(tl, 1));
    expect(op(c, 0.5, "n0")).toBeUndefined(); // before onset: opacity 0 → culled
    const mid = op(c, 1.3, "n0");
    expect(mid).toBeDefined();
    expect(mid!.opacity).toBeGreaterThan(0.1);
    expect(mid!.opacity).toBeLessThan(0.99);
    expect(op(c, 1.6, "n0")!.opacity).toBeCloseTo(1, 2);
  });

  it("assigns events to nodes in onset order", () => {
    const tl = sketchToTimeline(
      sketch([
        { t0: 1.2, t1: 1.6, kind: "enter", region: { x: 0.5, y: 0, w: 0.2, h: 0.2 }, magnitude: 0.1, easing: reliable },
        { t0: 0.4, t1: 0.8, kind: "enter", region: { x: 0, y: 0, w: 0.2, h: 0.2 }, magnitude: 0.1, easing: reliable },
      ]),
      ["n0", "n1"],
    );
    const c = compileScene(sceneWith(tl, 2));
    // earliest onset (0.4) maps to n0; it is already revealing at t=0.6
    expect(op(c, 0.7, "n0")!.opacity).toBeGreaterThan(0.1);
    // later onset (1.2) maps to n1; still hidden at 0.7
    expect(op(c, 0.7, "n1")).toBeUndefined();
    expect(op(c, 1.5, "n1")!.opacity).toBeGreaterThan(0.1);
  });

  it("emphasis pulses scale up then back to 1", () => {
    const start = { id: "n0" };
    void start;
    const tl = sketchToTimeline(
      sketch([{ t0: 0.5, t1: 1.1, kind: "emphasis", region: { x: 0, y: 0, w: 0.3, h: 0.3 }, magnitude: 0.2, easing: reliable }]),
      ["n0"],
    );
    // node visible from the start so scale is observable
    const s = scene({
      id: "t",
      size: { width: 1920, height: 1080 },
      fps: 30,
      nodes: [rect({ id: "n0", x: 100, y: 100, width: 50, height: 50, anchor: "center", fill: "#fff" })],
      timeline: tl,
    });
    const c = compileScene(s);
    const scaleAt = (t: number) => {
      const o = op(c, t, "n0")!;
      return Math.hypot(o.transform[0]!, o.transform[1]!); // |scale*cos, scale*sin|
    };
    expect(scaleAt(0.5)).toBeCloseTo(1, 1); // before pulse
    expect(scaleAt(0.8)).toBeGreaterThan(1.05); // mid pulse, scaled up
    expect(scaleAt(1.1)).toBeCloseTo(1, 1); // returns to 1
  });

  it("empty sketch emits a no-op timeline", () => {
    const tl = sketchToTimeline(sketch([]), ["n0"]);
    const c = compileScene(sceneWith(tl, 1));
    expect(c.duration).toBeGreaterThanOrEqual(0);
  });
});
