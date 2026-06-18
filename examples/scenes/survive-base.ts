// Edit-survival demo, base v1 (the scene "an AI wrote"). A centered logo sting:
// a glowing disc with a cut-out mark pops, the wordmark + tagline rise. Stable
// addresses (ids disc/mark/wordmark/tagline/lockup, states hidden/revealed,
// label reveal) so a human overlay can ride on top and survive a regeneration.
// Pair: survive-regen.ts (v2) + survive-edits.json (the overlay). Pure/deterministic.

import { scene, group, ellipse, rect, text, seq, par, to, tween, wait, oscillate, glow } from "@reframe/core";

const BG = "#0A0B10";
const BRAND = "#FF5A1F"; // the AI's default brand colour (the human recolours it)

export default scene({
  id: "survive-demo",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "lockup", x: 960, y: 540 }, [
      ellipse({ id: "disc", x: 0, y: -50, width: 200, height: 200, anchor: "center", fill: BRAND, ...glow(BRAND, 60) }),
      rect({ id: "mark", x: 0, y: -50, width: 80, height: 80, anchor: "center", fill: BG, radius: 16 }),
      text({ id: "wordmark", x: 0, y: 120, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 88, fontWeight: 800, fill: "#FFFFFF" }),
      text({ id: "tagline", x: 0, y: 196, anchor: "center", content: "motion, declared", fontFamily: "Inter", fontSize: 30, fontWeight: 500, fill: "#8B93A7" }),
    ]),
  ],

  states: {
    hidden: {
      disc: { scale: 0, opacity: 0 },
      mark: { scale: 0, rotation: -135, opacity: 0 },
      wordmark: { opacity: 0, y: 160 },
      tagline: { opacity: 0, y: 226 },
    },
    revealed: {
      disc: { scale: 1, opacity: 1 },
      mark: { scale: 1, rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, y: 120 },
      tagline: { opacity: 1, y: 196 },
    },
  },
  initial: "hidden",

  timeline: seq(
    to("revealed", { duration: 0.7, ease: "easeOutExpo", stagger: 0.12, label: "reveal" }),
    wait(2.0, "hold"),
    par(
      tween("lockup", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("lockup", { scale: 1.06 }, { duration: 0.5, ease: "easeInCubic" }),
    ),
  ),

  behaviors: [
    oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 }),
    oscillate("mark", "rotation", { amplitude: 4, frequency: 0.25, phase: 1.2 }),
  ],
});
