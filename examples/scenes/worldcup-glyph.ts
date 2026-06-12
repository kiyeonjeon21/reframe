import { group, image, par, scene, seq, tween, wait, wiggle } from "@reframe/core";

// World Cup 2026, in the archival glyph-reveal format: the "26" built from
// footballs, chalk tactics, stadium blueprints, stamps, tickets, pennants,
// confetti, medals, floodlights — resolving into the tournament lockup.
// Same grammar as glyph-reveal.ts, different glyph, different materials:
// that IS the format's promise (recipe fixed, symbol and plates swap).
//
// Plates: ./glyph-frames-wc/ (regenerate:
// npx tsx packages/render-cli/scripts/gen-worldcup-frames.ts)

const PLATES = 12;
const CUT = 0.17; // a touch slower than glyph-reveal — these plates are denser
const CUTS_END = PLATES * CUT;
const FINALE_HOLD = 2.0;

const plates = Array.from({ length: PLATES }, (_, i) => ({
  id: `frame-${i}`,
  src: `glyph-frames-wc/frame-${i}.png`,
}));

export default scene({
  id: "worldcup-glyph",
  size: { width: 1080, height: 1350 },
  fps: 30,
  background: "#0A0A0C",
  nodes: [
    group({ id: "camera", x: 540, y: 675, anchor: "center" }, [
      ...plates.map((p, i) =>
        image({
          id: p.id,
          src: p.src,
          x: -540,
          y: -675,
          width: 1080,
          height: 1350,
          opacity: i === 0 ? 1 : 0,
        }),
      ),
      image({
        id: "finale",
        src: `glyph-frames-wc/frame-${PLATES}.png`,
        x: -540,
        y: -675,
        width: 1080,
        height: 1350,
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
      tween("camera", { scale: 1.08 }, { duration: CUTS_END, ease: "linear" }),
      tween("camera", { scale: 1.0 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
  ),

  behaviors: [
    wiggle("camera", "x", { amplitude: 5, frequency: 7, seed: 23 }, { until: CUTS_END, ramp: 0.25 }),
    wiggle("camera", "y", { amplitude: 4, frequency: 6.3, seed: 71 }, { until: CUTS_END, ramp: 0.25 }),
  ],

  audio: {
    cues: [
      ...plates.slice(1).map((_, i) => ({ at: `cut-${i + 1}`, sfx: "tick" as const, gain: 0.5 })),
      { at: "cut-9", offset: -0.4, sfx: "rise", gain: 0.5 },
      { at: "finale-in", sfx: "whoosh", gain: 0.75 },
      { at: "finale-in", offset: 0.12, sfx: "thud", gain: 0.7 },
      { at: "hold", offset: 0.45, sfx: "shimmer", gain: 0.45 },
    ],
  },
});
