import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { scene, video } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { SceneValidationError } from "../src/validate.js";
import type { SceneIR } from "../src/ir.js";

const size = { width: 1920, height: 1080 };
const base = { x: 0, y: 0, width: 1920, height: 1080 };
const videoOp = (s: ReturnType<typeof scene>, t: number, id = "v") =>
  evaluate(compileScene(s), t).find((o) => o.id === id) as unknown as Record<string, unknown>;

describe("video node", () => {
  it("computes the source frame index from scene fps", () => {
    const s = scene({ id: "a", size, fps: 30, nodes: [video({ id: "v", src: "clip.mp4", ...base })] });
    expect(videoOp(s, 0).frame).toBe(0);
    expect(videoOp(s, 1).frame).toBe(30); // 1s @ 30fps
    expect(videoOp(s, 0.5).frame).toBe(15);
  });

  it("honors start, rate, and clipStart", () => {
    const s = scene({
      id: "a", size, fps: 30,
      nodes: [video({ id: "v", src: "clip.mp4", ...base, start: 1, rate: 2, clipStart: 0.5 })],
    });
    // before start: frame at clipStart
    expect(videoOp(s, 0).frame).toBe(Math.round(0.5 * 30)); // 15
    expect(videoOp(s, 0.5).frame).toBe(15);
    // 1s after start at 2x: src time = 0.5 + 1*2 = 2.5s → 75
    expect(videoOp(s, 2).frame).toBe(Math.round(2.5 * 30));
  });

  it("defaults fps to 30 when the scene omits it", () => {
    const s = scene({ id: "a", size, nodes: [video({ id: "v", src: "clip.mp4", ...base })] });
    expect(videoOp(s, 1).frame).toBe(30);
  });

  it("carries fit:cover when set, nothing when absent (byte-identity guard)", () => {
    const cover = scene({ id: "a", size, nodes: [video({ id: "v", src: "c.mp4", ...base, fit: "cover" })] });
    const none = scene({ id: "b", size, nodes: [video({ id: "v", src: "c.mp4", ...base })] });
    expect(videoOp(cover, 0).fit).toBe("cover");
    expect(videoOp(none, 0).fit).toBeUndefined();
  });

  it("is deterministic and JSON round-trips", () => {
    const build = () => scene({ id: "a", size, fps: 24, nodes: [video({ id: "v", src: "c.mp4", ...base, fit: "cover", rate: 1.5 })] });
    const a = JSON.stringify(evaluate(compileScene(build()), 0.7));
    const b = JSON.stringify(evaluate(compileScene(build()), 0.7));
    expect(a).toBe(b);
    const rt = compileScene(JSON.parse(JSON.stringify(build())) as SceneIR);
    expect(evaluate(rt, 0.7)).toEqual(evaluate(compileScene(build()), 0.7));
  });

  it("validation rejects an unknown prop / bad fit", () => {
    expect(() =>
      scene({ id: "a", size, nodes: [video({ id: "v", src: "c.mp4", ...base, fit: "stretch" as never })] }),
    ).toThrow(SceneValidationError);
  });
});
