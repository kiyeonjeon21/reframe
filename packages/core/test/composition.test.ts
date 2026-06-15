import { describe, expect, it } from "vitest";
import { scene, composition, rect, ellipse, tween, seq, beat, wait } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { compileComposition } from "../src/composeComposition.js";
import { evaluate } from "../src/evaluate.js";
import { composeScene } from "../src/compose.js";
import { resolveCompositionAudioPlan } from "../src/audio.js";
import { validateComposition, SceneValidationError } from "../src/validate.js";

const size = { width: 400, height: 300 };
const box = () => rect({ id: "box", x: 0, y: 0, width: 40, height: 40, fill: "#fff" });
const dot = () => ellipse({ id: "dot", x: 0, y: 0, width: 20, height: 20, fill: "#0ff" });

const intro = () => scene({ id: "intro", size, fps: 30, nodes: [box()], timeline: tween("box", { x: 50 }, { duration: 1 }) });
const outro = () => scene({ id: "outro", size, fps: 30, nodes: [dot()], timeline: tween("dot", { y: 50 }, { duration: 2 }) });

describe("composition layout", () => {
  it("cut: sequential start times + total duration", () => {
    const cc = compileComposition(composition({ id: "c", scenes: [{ scene: intro() }, { scene: outro() }] }));
    expect(cc.scenes[0]!.start).toBe(0);
    expect(cc.scenes[1]!.start).toBe(1); // after intro's 1s
    expect(cc.scenes[1]!.overlap).toBe(0);
    expect(cc.duration).toBe(3); // 1 + 2
  });

  it("crossfade overlaps by the default", () => {
    const cc = compileComposition(composition({ id: "c", scenes: [{ scene: intro() }, { scene: outro(), transition: "crossfade" }] }));
    expect(cc.scenes[1]!.start).toBe(0.5); // 1 - 0.5
    expect(cc.scenes[1]!.overlap).toBe(0.5);
    expect(cc.duration).toBe(2.5);
  });

  it("at strings shift the append point; a number is absolute", () => {
    const overlap = compileComposition(composition({ id: "c", scenes: [{ scene: intro() }, { scene: outro(), at: "-0.5" }] }));
    expect(overlap.scenes[1]!.start).toBe(0.5);
    const gap = compileComposition(composition({ id: "c", scenes: [{ scene: intro() }, { scene: outro(), at: "+0.5" }] }));
    expect(gap.scenes[1]!.start).toBe(1.5);
    const abs = compileComposition(composition({ id: "c", scenes: [{ scene: intro() }, { scene: outro(), at: 5 }] }));
    expect(abs.scenes[1]!.start).toBe(5);
  });
});

describe("scene independence", () => {
  it("a scene inside a composition compiles+evaluates identically to rendering it alone", () => {
    const s = outro();
    const cc = compileComposition(composition({ id: "c", scenes: [{ scene: intro() }, { scene: s }] }));
    const alone = compileScene(s);
    expect(cc.scenes[1]!.compiled.duration).toBe(alone.duration);
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const t = alone.duration * frac;
      expect(evaluate(cc.scenes[1]!.compiled, t)).toEqual(evaluate(alone, t));
    }
  });
});

describe("beat owns nodes (additive intent metadata)", () => {
  const mk = (opts: { nodes?: string[] }) =>
    scene({ id: "s", size, fps: 30, nodes: [box()], timeline: beat("b", opts, [tween("box", { x: 100 }, { duration: 1, label: "m" })]) });

  it("beat(name,{nodes},…) compiles+evaluates byte-identical to beat(name,{},…)", () => {
    const a = compileScene(mk({}));
    const b = compileScene(mk({ nodes: ["box"] }));
    expect(b.duration).toBe(a.duration);
    for (const frac of [0, 0.5, 1]) {
      expect(evaluate(b, a.duration * frac)).toEqual(evaluate(a, a.duration * frac));
    }
  });

  it("the dsl carries nodes through to the beat IR", () => {
    const b = beat("b", { nodes: ["box", "dot"] }, []);
    expect((b as { nodes?: string[] }).nodes).toEqual(["box", "dot"]);
  });
});

describe("composition audio plan", () => {
  const sa = () => scene({ id: "a", size, fps: 30, nodes: [box()], timeline: tween("box", { x: 1 }, { duration: 1, label: "m" }), audio: { cues: [{ at: "m", sfx: "pop" }] } });
  const sb = () => scene({ id: "b", size, fps: 30, nodes: [dot()], timeline: tween("dot", { y: 1 }, { duration: 2, label: "n" }), audio: { cues: [{ at: "n", offset: 0.3, sfx: "tick" }] } });

  it("offsets per-scene cues by scene start, spans a composition bgm, byte-stable", () => {
    const cc = compileComposition(composition({
      id: "c",
      scenes: [{ scene: sa() }, { scene: sb() }],
      audio: { bgm: { synth: "ambient-pad" }, cues: [{ at: 0.2, sfx: "whoosh" }] },
    }));
    const plan = resolveCompositionAudioPlan(cc)!;
    expect(plan.duration).toBe(cc.duration); // 3
    expect(plan.bgm).not.toBeNull();
    // pop @ scene a start 0; tick @ scene b start (1) + 0.3 = 1.3; whoosh @ 0.2
    const times = plan.cues.map((c) => c.t).sort((x, y) => x - y);
    expect(times).toEqual([0, 0.2, 1.3]);
    // determinism: resolving twice is byte-identical
    expect(resolveCompositionAudioPlan(cc)).toEqual(plan);
  });
});

describe("survival: a beat owning nodes keeps overlay addressing", () => {
  it("a beat-retime + an owned-node edit both survive a base regen by stable id", () => {
    const base = () => scene({
      id: "s",
      size,
      fps: 30,
      nodes: [box()],
      timeline: seq(wait(1), beat("intro", { nodes: ["box"] }, [tween("box", { x: 100 }, { duration: 1, label: "m" })])),
    });
    const overlay = { reframeOverlay: 1, timeline: { intro: { gap: 0.5 } }, nodes: { box: { x: 7 } } } as const;
    const { ir, report } = composeScene(base(), overlay);
    expect(report.orphans).toEqual([]);
    expect((ir.nodes[0] as { props: { x: number } }).props.x).toBe(7);
    // the beat moved later by gap 0.5 → the scene got longer
    expect(compileScene(ir).duration).toBeGreaterThan(compileScene(base()).duration - 1e-9);
  });
});

describe("validateComposition", () => {
  it("rejects duplicate scene ids", () => {
    expect(() => composition({ id: "c", scenes: [{ scene: intro() }, { scene: intro() }] })).toThrow(SceneValidationError);
  });
  it("rejects an unknown transition", () => {
    expect(() => composition({ id: "c", scenes: [{ scene: intro() }, { scene: outro(), transition: "wipe" as never }] })).toThrow(/unknown transition/);
  });
  it("rejects a beat owning an unknown node (via scene validation)", () => {
    expect(() => scene({ id: "s", size, fps: 30, nodes: [box()], timeline: beat("b", { nodes: ["ghost"] }, [wait(1)]) })).toThrow(/unknown node "ghost"/);
  });
  it("validateComposition runs standalone too", () => {
    expect(() => validateComposition({ version: 1, id: "c", scenes: [] })).toThrow(/no scenes/);
  });
});
