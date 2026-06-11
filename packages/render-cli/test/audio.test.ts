import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AudioPlan } from "@reframe/core";
import { buildFilterGraph } from "../src/audio/mux.js";
import { synthAmbientPad, synthSfx } from "../src/audio/synth.js";
import { encodeWavMono16 } from "../src/audio/wav.js";

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 16);

describe("procedural synth determinism", () => {
  it("same name+seed produce byte-identical WAVs", () => {
    for (const name of ["whoosh", "pop", "tick", "rise", "shimmer", "thud"] as const) {
      const a = encodeWavMono16(synthSfx(name, { seed: 7 }));
      const b = encodeWavMono16(synthSfx(name, { seed: 7 }));
      expect(sha(a), name).toBe(sha(b));
      expect(a.length, name).toBeGreaterThan(1000);
    }
    expect(sha(encodeWavMono16(synthSfx("pop", { seed: 1 })))).not.toBe(
      sha(encodeWavMono16(synthSfx("pop", { seed: 2 }))),
    );
  });

  it("synthesized audio is audible and clamp-safe", () => {
    for (const name of ["whoosh", "pop", "tick", "rise", "shimmer", "thud"] as const) {
      const samples = synthSfx(name);
      let peak = 0;
      let sum = 0;
      for (const s of samples) {
        peak = Math.max(peak, Math.abs(s));
        sum += s * s;
      }
      expect(peak, name).toBeGreaterThan(0.1); // not silence
      expect(Math.sqrt(sum / samples.length), name).toBeGreaterThan(0.005);
    }
    const pad = synthAmbientPad(2);
    expect(pad.length).toBe(2 * 44100);
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
      { t: 1.5, gain: 0.9, duration: 0.35, source: { kind: "sfx", name: "whoosh", params: {} } },
      { t: 4.0, gain: 0.7, duration: 0.12, source: { kind: "sfx", name: "pop", params: {} } },
    ],
    duckWindows: [
      { t0: 1.5, t1: 1.85 },
      { t0: 4.0, t1: 4.12 },
    ],
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
});
