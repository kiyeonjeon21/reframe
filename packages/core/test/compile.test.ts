import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, rect, seq, par, stagger, to, tween, wait } from "../src/dsl.js";

const box = (id: string, x = 0) =>
  rect({ id, x, y: 0, width: 100, height: 100, fill: "#ff0000", opacity: 1 });

describe("compileScene timing", () => {
  it("seq lays children end to end and infers duration", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box("a")],
      timeline: seq(
        tween("a", { x: 50 }, { duration: 1 }),
        wait(0.5),
        tween("a", { x: 100 }, { duration: 2 }),
      ),
    });
    expect(s.duration).toBe(3.5);
    const segs = compileScene(s).segments.get("a.x")!;
    expect(segs.map((g) => [g.t0, g.t1])).toEqual([
      [0, 1],
      [1.5, 3.5],
    ]);
  });

  it("par starts children together, duration is the max", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box("a"), box("b")],
      timeline: par(
        tween("a", { x: 50 }, { duration: 1 }),
        tween("b", { x: 50 }, { duration: 2 }),
      ),
    });
    expect(s.duration).toBe(2);
    expect(compileScene(s).segments.get("b.x")![0]!.t0).toBe(0);
  });

  it("stagger offsets children by the interval", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box("a"), box("b"), box("c")],
      timeline: stagger(
        0.25,
        tween("a", { x: 1 }, { duration: 1 }),
        tween("b", { x: 1 }, { duration: 1 }),
        tween("c", { x: 1 }, { duration: 1 }),
      ),
    });
    expect(compileScene(s).segments.get("c.x")![0]!.t0).toBe(0.5);
    expect(s.duration).toBe(1.5);
  });

  it("to() bakes from-values from the running current value", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box("a")],
      states: {
        out: { a: { x: 200, opacity: 0 } },
        in: { a: { x: 0, opacity: 1 } },
      },
      initial: "out",
      timeline: seq(to("in", { duration: 1 }), to("out", { duration: 1 })),
    });
    const segs = compileScene(s).segments.get("a.x")!;
    // starts from the initial-state value, not the base prop
    expect(segs[0]).toMatchObject({ from: 200, to: 0 });
    // second transition starts from where the first ended
    expect(segs[1]).toMatchObject({ from: 0, to: 200, t0: 1, t1: 2 });
  });

  it("to() with stagger offsets nodes in declaration order and extends the step", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box("a"), box("b"), box("c")],
      states: { go: { a: { x: 1 }, b: { x: 1 }, c: { x: 1 } } },
      timeline: to("go", { duration: 0.5, stagger: 0.1 }),
    });
    const c = compileScene(s);
    expect(c.segments.get("a.x")![0]!.t0).toBe(0);
    expect(c.segments.get("b.x")![0]!.t0).toBeCloseTo(0.1);
    expect(c.segments.get("c.x")![0]!.t0).toBeCloseTo(0.2);
    expect(s.duration).toBeCloseTo(0.7);
  });

  it("explicit scene duration overrides the inferred one", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      duration: 10,
      nodes: [box("a")],
      timeline: tween("a", { x: 1 }, { duration: 1 }),
    });
    expect(compileScene(s).duration).toBe(10);
  });
});

describe("validation", () => {
  it("rejects unknown state references with a helpful message", () => {
    expect(() =>
      scene({
        id: "t",
        size: { width: 100, height: 100 },
        nodes: [box("a")],
        states: { shown: { a: { x: 1 } } },
        timeline: to("visible"),
      }),
    ).toThrowError(/to\("visible"\) references an undefined state.*shown/s);
  });

  it("rejects props that do not exist on the node type", () => {
    expect(() =>
      scene({
        id: "t",
        size: { width: 100, height: 100 },
        nodes: [box("a")],
        states: { s: { a: { fontSize: 12 } } },
      }),
    ).toThrowError(/"fontSize" is not a prop of rect "a"/);
  });

  it("rejects duplicate node ids", () => {
    expect(() =>
      scene({
        id: "t",
        size: { width: 100, height: 100 },
        nodes: [box("a"), box("a")],
      }),
    ).toThrowError(/duplicate node id "a"/);
  });
});

describe("static scene duration", () => {
  // A still (no animation) must still get a positive duration so it renders a frame —
  // before this fallback, an absent/empty timeline left duration 0/undefined and the
  // CLI crashed (compiled.duration.toFixed of undefined).
  it("a scene with no timeline gets the default still duration", () => {
    const s = scene({ id: "t", size: { width: 100, height: 100 }, nodes: [box("a")] });
    expect(compileScene(s).duration).toBe(1);
  });

  it("a scene whose timeline produces no spans falls back to the still duration", () => {
    const s = scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [box("a")],
      timeline: seq(),
    });
    expect(compileScene(s).duration).toBe(1);
  });

  it("an explicit scene duration still wins over the fallback", () => {
    const s = scene({ id: "t", size: { width: 100, height: 100 }, nodes: [box("a")], duration: 4 });
    expect(compileScene(s).duration).toBe(4);
  });
});
