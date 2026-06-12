import { group, image, par, scene, seq, tween, wait, wiggle } from "@reframe/core";

// World Cup 2026, in the archival glyph-reveal format: a one-line "2026"
// built from football materials — balls, chalk tactics, stadium blueprints,
// stamps, tickets, pennants, jerseys, stud marks, goal nets, fan scarves —
// resolving into the tournament lockup. Full soundtrack: Kokoro narration,
// an ACE-Step generated stadium-promo bed, label-anchored SFX.
//
// Plates + audio: ./glyph-frames-wc/ (regenerate plates:
// npx tsx packages/render-cli/scripts/gen-worldcup-frames.ts)

const PLATES = 18;
const CUT = 0.22;
const CUTS_END = PLATES * CUT; // 3.96
const FINALE_HOLD = 2.6;

const plates = Array.from({ length: PLATES }, (_, i) => ({
  id: `frame-${i}`,
  src: `glyph-frames-wc/frame-${i}.png`,
}));

export default scene({
  id: "worldcup-glyph",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0A0C",
  nodes: [
    group({ id: "camera", x: 960, y: 540, anchor: "center" }, [
      ...plates.map((p, i) =>
        image({
          id: p.id,
          src: p.src,
          x: -960,
          y: -540,
          width: 1920,
          height: 1080,
          opacity: i === 0 ? 1 : 0,
        }),
      ),
      image({
        id: "finale",
        src: `glyph-frames-wc/frame-${PLATES}.png`,
        x: -960,
        y: -540,
        width: 1920,
        height: 1080,
        opacity: 0,
      }),
    ]),
  ],

  timeline: par(
    seq(
      ...plates.slice(1).map((p, i) =>
        seq(
          wait(CUT - 0.01),
          tween(p.id, { opacity: 1 }, { duration: 0.01, label: `cut-${i + 1}` }),
        ),
      ),
      wait(CUT),
      tween("finale", { opacity: 1 }, { duration: 0.01, label: "finale-in" }),
      wait(FINALE_HOLD, "hold"),
    ),
    seq(
      tween("camera", { scale: 1.07 }, { duration: CUTS_END, ease: "linear" }),
      tween("camera", { scale: 1.0 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
  ),

  behaviors: [
    wiggle("camera", "x", { amplitude: 5, frequency: 7, seed: 23 }, { until: CUTS_END, ramp: 0.25 }),
    wiggle("camera", "y", { amplitude: 4, frequency: 6.3, seed: 71 }, { until: CUTS_END, ramp: 0.25 }),
  ],

  audio: {
    // ACE-Step generated anthem (melodic, prominent), light duck under cues
    bgm: { file: "glyph-frames-wc/anthem.wav", gain: 0.8, fadeIn: 0.25, fadeOut: 1.4, duck: { depth: 0.3 } },
    cues: [
      // Kokoro narration (am_michael): the run, then the title
      { at: "cut-1", offset: -0.1, file: "glyph-frames-wc/narr-1.wav", gain: 1.15 },
      { at: "finale-in", offset: 0.25, file: "glyph-frames-wc/narr-2.wav", gain: 1.15 },
      // escalating cut hits, a sharper pop every 4th so the run stays alive
      ...plates.slice(1).map((_, i) =>
        (i + 1) % 4 === 0
          ? { at: `cut-${i + 1}`, sfx: "pop" as const, gain: 0.6 + i * 0.012 }
          : { at: `cut-${i + 1}`, sfx: "tick" as const, gain: 0.62 + i * 0.015 },
      ),
      { at: "cut-15", sfx: "rise", gain: 0.6 },
      { at: "finale-in", sfx: "whoosh", gain: 0.85 },
      { at: "finale-in", offset: 0.12, sfx: "thud", gain: 0.8 },
      { at: "hold", offset: 0.6, sfx: "shimmer", gain: 0.45 },
    ],
  },
});
