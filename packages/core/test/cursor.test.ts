import { describe, expect, it } from "vitest";
import { scene, seq, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { validateScene } from "../src/validate.js";
import { cursor, cursorTo, cursorClick, cursorDouble } from "../src/cursor.js";
import { deviceScreenPoint } from "../src/devicePreset.js";
import type { NodeIR, TimelineIR } from "../src/ir.js";

const childIds = (n: NodeIR): string[] => (n.type === "group" ? [n.id, ...n.children.flatMap(childIds)] : [n.id]);
function tweens(tl: TimelineIR): string[] {
  switch (tl.kind) {
    case "beat": case "seq": case "par": case "stagger": return tl.children.flatMap(tweens);
    case "tween": return [tl.target];
    default: return [];
  }
}

describe("cursor", () => {
  it("cursor() → a group with the ripple + art children; styles vary the art", () => {
    const ids = childIds(cursor({ id: "c" }));
    expect(ids).toContain("c");
    expect(ids).toContain("c-ripple");
    expect(ids).toContain("c-arrow");
    expect(childIds(cursor({ id: "c", style: "dot" }))).toContain("c-dot");
    expect(childIds(cursor({ id: "c", style: "ring" }))).toContain("c-ring");
  });

  it("cursorTo → a motionPath from→to that lands the hotspot on the target", () => {
    const tl = cursorTo("c", [100, 200], [800, 500]) as Extract<TimelineIR, { kind: "motionPath" }>;
    expect(tl.kind).toBe("motionPath");
    expect(tl.target).toBe("c");
    expect(tl.points[0]).toEqual([100, 200]);
    expect(tl.points[tl.points.length - 1]).toEqual([800, 500]);
  });

  it("cursorClick → a beat that taps the art, ripples, and presses a target", () => {
    const t = tweens(cursorClick("c", { press: "btn" }));
    expect(t).toContain("c-art");
    expect(t).toContain("c-ripple");
    expect(t).toContain("btn");
    // ripple can be suppressed
    expect(tweens(cursorClick("c", { ripple: false }))).not.toContain("c-ripple");
  });

  it("deviceScreenPoint maps screen-local → scene coords", () => {
    // browser screenCenter = {x:0,y:24}; at (1180,452) scale 0.82
    expect(deviceScreenPoint("browser", { x: 1180, y: 452, scale: 0.82 }, [0, 0])).toEqual([1180, 1180 * 0 + 452 + 0.82 * 24]);
    const [sx, sy] = deviceScreenPoint("browser", { x: 1180, y: 452, scale: 0.82 }, [-362, 156.24]);
    expect(sx).toBeCloseTo(883.16, 1);
    expect(sy).toBeCloseTo(599.8, 1);
  });

  it("is deterministic and composes into a valid scene", () => {
    expect(JSON.stringify(cursorTo("c", [0, 0], [500, 300]))).toBe(JSON.stringify(cursorTo("c", [0, 0], [500, 300])));
    const s = scene({
      id: "s", size: { width: 1920, height: 1080 }, fps: 30,
      nodes: [cursor({ id: "c", x: 100, y: 200 })],
      timeline: seq(cursorTo("c", [100, 200], [800, 500]), cursorClick("c"), cursorDouble("c"), wait(0.2)),
    });
    expect(() => validateScene(s)).not.toThrow();
    expect(() => compileScene(s)).not.toThrow();
  });
});
