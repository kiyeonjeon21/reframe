import { describe, expect, it } from "vitest";
import { resolveAudioPlan } from "../src/audio.js";
import { compileScene } from "../src/compile.js";
import { scene, rect, seq, par, stagger, tween, video, wait } from "../src/dsl.js";
import type { AudioIR } from "../src/ir.js";

const base = (audio?: AudioIR) =>
  compileScene(
    scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })],
      timeline: seq(
        wait(0.5, "lead"),
        tween("a", { x: 100 }, { duration: 1, label: "move" }),
        par(tween("a", { opacity: 0 }, { duration: 0.5, label: "fade" })),
        wait(1, "tail"),
      ),
      ...(audio && { audio }),
    }),
  );

describe("labelTimes", () => {
  it("records absolute spans for labels, including inside par/stagger", () => {
    const c = compileScene(
      scene({
        id: "t",
        size: { width: 100, height: 100 },
        nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10 }), rect({ id: "b", x: 0, y: 0, width: 10, height: 10 })],
        timeline: seq(
          wait(1, "w"),
          par(
            tween("a", { x: 1 }, { duration: 2, label: "long" }),
            stagger(0.5, tween("b", { x: 1 }, { duration: 1, label: "inner" })),
          ),
        ),
      }),
    );
    expect(c.labelTimes.get("w")).toEqual({ t0: 0, t1: 1 });
    expect(c.labelTimes.get("long")).toEqual({ t0: 1, t1: 3 });
    expect(c.labelTimes.get("inner")).toEqual({ t0: 1, t1: 2 });
  });
});

describe("resolveAudioPlan", () => {
  it("returns null without an audio block", () => {
    expect(resolveAudioPlan(base())).toBeNull();
  });

  it("anchors cues to label starts, applies offsets, clamps to 0, sorts", () => {
    const plan = resolveAudioPlan(
      base({
        cues: [
          { at: "fade", sfx: "pop" },
          { at: "move", offset: -2, sfx: "tick" }, // clamps to 0
          { at: 2.0, sfx: "whoosh", gain: 0.8 },
        ],
      }),
    )!;
    expect(plan.cues.map((c) => c.t)).toEqual([0, 1.5, 2.0]);
    expect(plan.cues[2]).toMatchObject({ gain: 0.8, source: { kind: "sfx", name: "whoosh" } });
  });

  it("merges overlapping cue windows for ducking", () => {
    const plan = resolveAudioPlan(
      base({
        cues: [
          { at: 1.0, sfx: "whoosh" }, // 1.0–1.35
          { at: 1.3, sfx: "pop" }, // overlaps -> merged
          { at: 2.5, sfx: "tick" }, // separate
        ],
      }),
    )!;
    expect(plan.duckWindows).toEqual([
      { t0: 1.0, t1: 1.42 },
      { t0: 2.5, t1: 2.53 },
    ]);
  });

  it("drops cues past the end and warns on truncation", () => {
    const plan = resolveAudioPlan(
      base({
        cues: [
          { at: 99, sfx: "pop" },
          { at: "tail", offset: 0.9, sfx: "shimmer" }, // 2.9 + 0.9 long > 3.0 end
        ],
      }),
    )!;
    expect(plan.cues).toHaveLength(1);
    expect(plan.warnings.some((w) => w.includes("past the scene end (3.00s) — dropped"))).toBe(true);
    expect(plan.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });

  it("fills bgm defaults and respects duck: false", () => {
    const withDuck = resolveAudioPlan(base({ bgm: { synth: "ambient-pad" } }))!;
    expect(withDuck.bgm).toMatchObject({
      source: { kind: "synth", name: "ambient-pad" },
      gain: 0.5,
      duck: { depth: 0.5, attack: 0.05, release: 0.25 },
    });
    const noDuck = resolveAudioPlan(base({ bgm: { file: "m.mp3", duck: false } }))!;
    expect(noDuck.bgm?.duck).toBeNull();
  });
});

describe("clip audio (video nodes)", () => {
  const vscene = (props: Record<string, unknown>, audio?: AudioIR) =>
    compileScene(
      scene({
        id: "t",
        size: { width: 100, height: 100 },
        duration: 10,
        nodes: [video({ id: "v", src: "clip.mp4", x: 0, y: 0, width: 100, height: 100, ...props })],
        ...(audio && { audio }),
      }),
    );

  it("emits a clipAudio entry per audible video node (default volume 1)", () => {
    const plan = resolveAudioPlan(vscene({ start: 1, rate: 2, clipStart: 0.5 }))!;
    expect(plan).not.toBeNull();
    expect(plan.clipAudio).toEqual([
      { nodeId: "v", src: "clip.mp4", start: 1, rate: 2, clipStart: 0.5, gain: 1, fadeIn: 0, pan: 0 },
    ]);
    expect(plan.cues).toEqual([]);
    expect(plan.bgm).toBeNull();
  });

  it("volume 0 mutes the clip → no entry → null plan when nothing else", () => {
    expect(resolveAudioPlan(vscene({ volume: 0 }))).toBeNull();
  });

  it("coexists with scene cues/bgm", () => {
    const plan = resolveAudioPlan(
      vscene({ volume: 0.6 }, { bgm: { synth: "ambient-pad" } }),
    )!;
    expect(plan.clipAudio).toHaveLength(1);
    expect(plan.clipAudio[0]!.gain).toBe(0.6);
    expect(plan.bgm).not.toBeNull();
  });

  it("drops a clip whose start is past the scene end (with a warning)", () => {
    const plan = resolveAudioPlan(vscene({ start: 99 }));
    expect(plan).toBeNull(); // dropped → nothing else → null
  });
});

describe("audio validation", () => {
  const make = (audio: AudioIR) =>
    scene({
      id: "t",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10 })],
      timeline: seq(wait(1, "w")),
      audio,
    });

  it("rejects unknown labels with the known list", () => {
    expect(() => make({ cues: [{ at: "nope", sfx: "pop" }] })).toThrowError(
      /unknown timeline label "nope" — known labels: w/,
    );
  });

  it("requires exactly one of sfx/file and a known sfx name", () => {
    expect(() => make({ cues: [{ at: "w" }] })).toThrowError(/exactly one of "sfx" or "file"/);
    expect(() => make({ cues: [{ at: "w", sfx: "pop", file: "x.wav" }] })).toThrowError(/exactly one/);
    expect(() => make({ cues: [{ at: "w", sfx: "kaboom" as never }] })).toThrowError(/unknown sfx "kaboom"/);
  });
});
