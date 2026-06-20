import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AudioPlan } from "@reframe/core";
import { BGM_SYNTHS, SFX_NAMES } from "@reframe/core";
import { atempoChain, buildFilterGraph } from "../src/audio/mux.js";
import { resolveCueFile } from "../src/audio/sfx.js";
import { synthBgm, synthSfx } from "../src/audio/synth.js";
import { encodeWavMono16 } from "../src/audio/wav.js";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const stats = (samples: Float32Array) => {
  let peak = 0, sum = 0;
  for (const s of samples) { peak = Math.max(peak, Math.abs(s)); sum += s * s; }
  return { peak, rms: Math.sqrt(sum / samples.length) };
};

describe("procedural synth determinism", () => {
  it("every sfx: same name+seed → byte-identical WAV; different seed → different", () => {
    for (const name of SFX_NAMES) {
      const a = encodeWavMono16(synthSfx(name, { seed: 7 }));
      const b = encodeWavMono16(synthSfx(name, { seed: 7 }));
      expect(sha(a), name).toBe(sha(b));
      expect(a.length, name).toBeGreaterThan(1000);
      // a different seed shifts pitch/texture → different bytes
      expect(sha(encodeWavMono16(synthSfx(name, { seed: 1 })))).not.toBe(
        sha(encodeWavMono16(synthSfx(name, { seed: 4 }))),
      );
    }
  });

  it("every sfx is audible and clamp-safe", () => {
    for (const name of SFX_NAMES) {
      const { peak, rms } = stats(synthSfx(name, { seed: 1 }));
      expect(peak, name).toBeGreaterThan(0.1); // not silence
      expect(peak, `${name} clamp`).toBeLessThanOrEqual(1.0001);
      expect(rms, name).toBeGreaterThan(0.004);
    }
  });

  it("pitch param shifts the sound (explicit) and seed=0 is the neutral pitch", () => {
    // explicit pitch changes the bytes
    expect(sha(encodeWavMono16(synthSfx("blip", { seed: 0 })))).not.toBe(
      sha(encodeWavMono16(synthSfx("blip", { seed: 0, pitch: 1.5 }))),
    );
    // seed 0 == no params (neutral)
    expect(sha(encodeWavMono16(synthSfx("ding")))).toBe(sha(encodeWavMono16(synthSfx("ding", { seed: 0 }))));
  });

  it("every bgm synth is deterministic, audible, and the right length", () => {
    for (const name of BGM_SYNTHS) {
      const a = synthBgm(name, 2);
      expect(a.length, name).toBe(2 * 44100);
      expect(sha(encodeWavMono16(a)), name).toBe(sha(encodeWavMono16(synthBgm(name, 2))));
      expect(stats(a).peak, name).toBeGreaterThan(0.1);
    }
  });
});

describe("buildFilterGraph", () => {
  const plan: AudioPlan = {
    duration: 10,
    bgm: {
      source: { kind: "synth", name: "ambient-pad" },
      gain: 0.35,
      fadeIn: 1,
      fadeOut: 2,
      duck: { depth: 0.5, attack: 0.05, release: 0.25 },
    },
    cues: [
      { t: 1.5, gain: 0.9, duration: 0.35, fadeIn: 0, fadeOut: 0, pan: 0, source: { kind: "sfx", name: "whoosh", params: {} } },
      { t: 4.0, gain: 0.7, duration: 0.12, fadeIn: 0, fadeOut: 0, pan: 0, source: { kind: "sfx", name: "pop", params: {} } },
    ],
    duckWindows: [
      { t0: 1.5, t1: 1.85 },
      { t0: 4.0, t1: 4.12 },
    ],
    clipAudio: [],
    warnings: [],
  };

  it("emits anchor, bgm chain with duck ramps, per-cue adelay, normalize=0", () => {
    const graph = buildFilterGraph(plan, { cueFiles: ["a.wav", "b.wav"], bgmFile: "pad.wav" });
    expect(graph).toMatchSnapshot();
    expect(graph).toContain("normalize=0");
    expect(graph).toContain("eval=frame");
    expect(graph).toContain("adelay=1500:all=1");
    expect(graph).toContain("adelay=4000:all=1");
    expect(graph).toContain("afade=t=out:st=8.000");
    expect(graph).toContain("amix=inputs=4"); // anchor + bgm + 2 cues
  });

  it("works without bgm", () => {
    const graph = buildFilterGraph({ ...plan, bgm: null }, { cueFiles: ["a.wav", "b.wav"], bgmFile: null });
    expect(graph).toContain("amix=inputs=3");
    expect(graph).not.toContain("afade");
  });

  it("adds a clip-audio chain (trim + tempo + delay) after the cues", () => {
    const clipPlan: AudioPlan = {
      duration: 10, bgm: null, cues: [], duckWindows: [],
      clipAudio: [{ nodeId: "v", src: "clip.mp4", start: 2, rate: 2, clipStart: 1.5, gain: 0.8, fadeIn: 0, pan: 0 }],
      warnings: [],
    };
    const graph = buildFilterGraph(clipPlan, {
      cueFiles: [], bgmFile: null,
      clipFiles: [{ audio: clipPlan.clipAudio[0]!, file: "v.wav" }],
    });
    expect(graph).toContain("atrim=start=1.500");
    expect(graph).toContain("asetpts=PTS-STARTPTS");
    expect(graph).toContain("atempo=2.0"); // rate 2 → single legal factor
    expect(graph).toContain("volume=0.8");
    expect(graph).toContain("adelay=2000:all=1");
    expect(graph).toContain("amix=inputs=2"); // anchor + 1 clip
  });

  it("injects cue fade in/out + pan, in order, before the delay", () => {
    const p: AudioPlan = {
      duration: 10, bgm: null, duckWindows: [], clipAudio: [], warnings: [],
      cues: [{ t: 2, gain: 1, duration: 1.5, fadeIn: 0.3, fadeOut: 0.5, pan: -1, source: { kind: "file", path: "c.wav" } }],
    };
    const graph = buildFilterGraph(p, { cueFiles: ["c.wav"], bgmFile: null });
    expect(graph).toContain("afade=t=in:st=0:d=0.3");
    expect(graph).toContain("afade=t=out:st=1.000:d=0.5"); // duration 1.5 - fadeOut 0.5
    expect(graph).toContain("pan=stereo|c0=1.0000*c0|c1=0.0000*c1"); // pan -1 = full left
    // pan/fade sit before the delay
    expect(graph.indexOf("pan=stereo")).toBeLessThan(graph.indexOf("adelay=2000"));
  });

  it("injects clip fade in + pan (no clip fade-out — clips have no plan duration)", () => {
    const p: AudioPlan = {
      duration: 10, bgm: null, cues: [], duckWindows: [], warnings: [],
      clipAudio: [{ nodeId: "v", src: "v.mp4", start: 1, rate: 1, clipStart: 0, gain: 1, fadeIn: 0.4, pan: 1 }],
    };
    const graph = buildFilterGraph(p, { cueFiles: [], bgmFile: null, clipFiles: [{ audio: p.clipAudio[0]!, file: "v.wav" }] });
    expect(graph).toContain("afade=t=in:st=0:d=0.4");
    expect(graph).toContain("pan=stereo|c0=0.0000*c0|c1=1.0000*c1"); // pan +1 = full right
  });

  it("BYTE-IDENTICAL: zero fade/pan produces the pre-feature chain", () => {
    const base: AudioPlan = {
      duration: 10, bgm: null, duckWindows: [], warnings: [],
      cues: [{ t: 2, gain: 0.9, duration: 0.35, fadeIn: 0, fadeOut: 0, pan: 0, source: { kind: "sfx", name: "whoosh", params: {} } }],
      clipAudio: [{ nodeId: "v", src: "v.mp4", start: 1, rate: 1, clipStart: 0, gain: 1, fadeIn: 0, pan: 0 }],
    };
    const graph = buildFilterGraph(base, { cueFiles: ["a.wav"], bgmFile: null, clipFiles: [{ audio: base.clipAudio[0]!, file: "v.wav" }] });
    expect(graph).not.toContain("afade");
    expect(graph).not.toContain("pan=stereo");
    expect(graph).toContain("volume=0.9,adelay=2000:all=1[c0]"); // cue chain unchanged
  });
});

describe("sample-default routing (sfx → wav vs synth)", () => {
  const cue = (name: string, params: Record<string, number> = {}) =>
    ({ t: 0, gain: 1, duration: 0.3, fadeIn: 0, fadeOut: 0, pan: 0, source: { kind: "sfx" as const, name: name as never, params } });

  it("a hero name (whoosh) defaults to the curated .wav sample", async () => {
    expect(await resolveCueFile(cue("whoosh"), "/tmp")).toMatch(/assets[/\\]sfx[/\\]whoosh\.wav$/);
  });
  it("params.synth forces the varying synth for a hero name", async () => {
    const p = await resolveCueFile(cue("whoosh", { synth: 1 }), "/tmp");
    expect(p).not.toMatch(/whoosh\.wav$/);
    expect(p).toMatch(/whoosh-/); // synthesized cache file
  });
  it("a non-hero name (boom) always synthesizes", async () => {
    const p = await resolveCueFile(cue("boom"), "/tmp");
    expect(p).not.toMatch(/assets[/\\]sfx/);
    expect(p).toMatch(/boom-/);
  });
});

describe("atempoChain", () => {
  it("omits for rate 1, single factor in range, decomposes out of range", () => {
    expect(atempoChain(1)).toEqual([]);
    expect(atempoChain(1.5)).toEqual(["atempo=1.5000"]);
    expect(atempoChain(4)).toEqual(["atempo=2.0", "atempo=2.0000"]);
    expect(atempoChain(0.25)).toEqual(["atempo=0.5", "atempo=0.5000"]);
  });
});
