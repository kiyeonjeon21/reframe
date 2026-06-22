import { group, image, par, scene, seq, tween, wait, wiggle } from "@reframe/core";

// "Glyph reveal" — the archival stop-motion format: one symbol re-rendered
// through different materials, hard-cut at ~7fps with a slow push-in and
// camera shake, a tick per cut, resolving into the reframe logo. Generate
// your own plates with any image model (symbol centered), drop them next
// to this file, done.
//
// The frame ids are stable addresses: swap any plate from an overlay or a
// batch row with  nodes.frame-3.src  — no code edit, and your retiming
// edits survive a regeneration.
//
// Plates live in ./glyph-frames/ (18 archival styles + logo finale;
// regenerate: npx tsx packages/render-cli/scripts/gen-glyph-frames.ts)

const PLATES = 18;
const CUT = 0.15; // seconds per plate — the recipe's 0.12–0.18 sweet spot
const CUTS_END = PLATES * CUT;
const LOGO_HOLD = 1.9;

// painter's order: later plates stack on top, so a cut is just a reveal
const plates = Array.from({ length: PLATES }, (_, i) => ({
  id: `frame-${i}`,
  src: `glyph-frames/frame-${i}.png`,
}));

export default scene({
  id: "glyph-reveal",
  size: { width: 1080, height: 1350 }, // 4:5 — the format lives on social
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
      // the finale: every R was reframe's R
      image({
        id: "logo",
        src: `glyph-frames/frame-${PLATES}.png`,
        x: -540,
        y: -675,
        width: 1080,
        height: 1350,
        opacity: 0,
      }),
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
      wait(CUT),
      tween("logo", { opacity: 1 }, { duration: 0.01, label: "logo-in" }),
      wait(LOGO_HOLD, "hold"),
    ),
    // the recipe's slow push-in, settling as the logo lands
    seq(
      tween("camera", { scale: 1.08 }, { duration: CUTS_END, ease: "linear" }),
      tween("camera", { scale: 1.0 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
  ),

  behaviors: [
    // handheld camera shake during the plate run, gone by the logo
    wiggle("camera", "x", { amplitude: 5, frequency: 7, seed: 11 }, { until: CUTS_END, ramp: 0.25 }),
    wiggle("camera", "y", { amplitude: 4, frequency: 6.3, seed: 47 }, { until: CUTS_END, ramp: 0.25 }),
  ],

  audio: {
    cues: [
      ...plates.slice(1).map((_, i) => ({ at: `cut-${i + 1}`, sfx: "tick" as const, gain: 0.5 })),
      { at: "logo-in", sfx: "whoosh", gain: 0.75 },
      { at: "logo-in", offset: 0.12, sfx: "thud", gain: 0.65 },
      { at: "hold", offset: 0.4, sfx: "shimmer", gain: 0.45 },
    ],
  },
});
