import { describe, expect, it } from "vitest";
import { scene, seq } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { validateScene } from "../src/validate.js";
import { humanoid } from "../src/rig.js";
import { characterPreset, CHARACTER_PRESET_NAMES } from "../src/characterPreset.js";
import type { TimelineIR } from "../src/ir.js";

const JOINTS = new Set([
  "chest", "head", "armUpperL", "armLowerL", "armUpperR", "armLowerR",
  "legUpperL", "legLowerL", "legUpperR", "legLowerR",
]);

// flatten every tween in a timeline tree
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

describe("characterPreset", () => {
  it("every name → a matching beat with motion", () => {
    for (const name of CHARACTER_PRESET_NAMES) {
      const b = characterPreset(name, { target: "h" }) as Extract<TimelineIR, { kind: "beat" }>;
      expect(b.kind).toBe("beat");
      expect(b.name).toBe(name);
      expect(b.children.length).toBeGreaterThan(0);
      expect(tweens(b).length).toBeGreaterThan(0);
    }
  });

  it("only drives valid humanoid joints (and the outer group for body moves)", () => {
    for (const name of CHARACTER_PRESET_NAMES) {
      for (const { target } of tweens(characterPreset(name, { target: "h", at: [0, 0] }))) {
        const ok = target === "h" || (target.startsWith("h-") && JOINTS.has(target.slice(2)));
        expect(ok, `${name}: unexpected target ${target}`).toBe(true);
      }
    }
  });

  it("is deterministic; a different seed varies within the same structure", () => {
    const a = characterPreset("walk", { target: "h", seed: 1 });
    const a2 = characterPreset("walk", { target: "h", seed: 1 });
    const b = characterPreset("walk", { target: "h", seed: 2 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(a2)); // reproducible
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b)); // seed varies it
    // same family: same beat name + same set of targeted joints
    expect((a as { name?: string }).name).toBe((b as { name?: string }).name);
    const ids = (t: TimelineIR) => [...new Set(tweens(t).map((x) => x.target))].sort();
    expect(ids(a)).toEqual(ids(b));
  });

  it("speed scales durations (faster speed → shorter)", () => {
    const maxDur = (sp: number) =>
      Math.max(...tweens(characterPreset("walk", { target: "h", speed: sp })).map((t) => t.duration ?? 0));
    expect(maxDur(2)).toBeCloseTo(maxDur(1) / 2, 5);
  });

  it("composes over a humanoid: compiles and validates", () => {
    const s = scene({
      id: "s",
      size: { width: 1920, height: 1080 },
      fps: 30,
      nodes: [humanoid({ id: "h", x: 960, y: 520 })],
      timeline: seq(
        characterPreset("walk", { target: "h", at: [960, 520], cycles: 2 }),
        characterPreset("jump", { target: "h", at: [960, 520] }),
        characterPreset("cheer", { target: "h", at: [960, 520], cycles: 2 }),
      ),
    });
    expect(() => validateScene(s)).not.toThrow();
    expect(() => compileScene(s)).not.toThrow();
  });
});
