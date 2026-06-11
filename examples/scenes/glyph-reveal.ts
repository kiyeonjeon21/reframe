import { group, image, par, scene, seq, tween, wait, wiggle } from "@reframe/core";

// "Glyph reveal" — the archival stop-motion format: one symbol re-rendered
// through different materials, hard-cut at ~7fps with a slow push-in and
// camera shake, a tick per cut. Generate your own frames with any image
// model (square-ish, symbol centered), drop them next to this file, done.
//
// The frame ids are stable addresses: swap any plate from an overlay or a
// batch row with  nodes.frame-3.src  — no code edit, and your retiming
// edits survive a regeneration.
//
// Placeholder plates live in ./glyph-frames/
// (regenerate: npx tsx packages/render-cli/scripts/gen-glyph-frames.ts)

const FRAMES = 10;
const CUT = 0.15; // seconds per plate — the recipe's 0.12–0.18 sweet spot
const HOLD = 1.4; // final plate hold
const TOTAL = FRAMES * CUT + HOLD;

// painter's order: later plates stack on top, so a cut is just a reveal
const plates = Array.from({ length: FRAMES }, (_, i) => ({
  id: `frame-${i}`,
  src: `glyph-frames/frame-${i}.png`,
}));

export default scene({
  id: "glyph-reveal",
  size: { width: 1080, height: 1350 }, // 4:5 — the format lives on social
  fps: 30,
  background: "#0E0C09",
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
    ]),
  ],

  timeline: par(
    // hard cuts: 0.01s opacity steps land between 30fps samples — true cuts
    seq(
      ...plates.slice(1).map((p, i) =>
        seq(
          wait(CUT - 0.01),
          tween(p.id, { opacity: 1 }, { duration: 0.01, label: `cut-${i + 1}` }),
        ),
      ),
      wait(HOLD, "hold"),
    ),
    // the recipe's slow push-in
    tween("camera", { scale: 1.07 }, { duration: TOTAL, ease: "linear" }),
  ),

  behaviors: [
    // handheld camera shake, calming into the final hold
    wiggle("camera", "x", { amplitude: 5, frequency: 7, seed: 11 }, { until: TOTAL - HOLD + 0.3, ramp: 0.3 }),
    wiggle("camera", "y", { amplitude: 4, frequency: 6.3, seed: 47 }, { until: TOTAL - HOLD + 0.3, ramp: 0.3 }),
  ],

  audio: {
    cues: [
      ...plates.slice(1).map((_, i) => ({ at: `cut-${i + 1}`, sfx: "tick" as const, gain: 0.5 })),
      { at: "hold", sfx: "whoosh", gain: 0.7 },
      { at: "hold", offset: 0.15, sfx: "thud", gain: 0.6 },
      { at: "hold", offset: 0.5, sfx: "shimmer", gain: 0.4 },
    ],
  },
});
