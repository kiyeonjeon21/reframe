// Edit-survival demo, base v2 — the SAME scene "redesigned by the AI". A totally
// different take: horizontal lockup (mark left of the wordmark), an underline
// flourish, new timing. Per the regeneration contract it KEEPS every stable
// address (ids disc/mark/wordmark/tagline/lockup, states hidden/revealed, label
// reveal) — so the human overlay (survive-edits.json) reapplies untouched even
// though the layout changed completely. Pure/deterministic.

import { scene, group, ellipse, rect, text, seq, par, to, tween, wait, oscillate, glow } from "@reframe/core";

const BG = "#0A0B10";
const BRAND = "#FF5A1F";

export default scene({
  id: "survive-demo",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "lockup", x: 960, y: 540 }, [
      ellipse({ id: "disc", x: -360, y: 0, width: 168, height: 168, anchor: "center", fill: BRAND, ...glow(BRAND, 52) }),
      rect({ id: "mark", x: -360, y: 0, width: 66, height: 66, anchor: "center", fill: BG, radius: 14 }),
      text({ id: "wordmark", x: -230, y: -18, anchor: "center-left", content: "reframe", fontFamily: "Inter", fontSize: 112, fontWeight: 800, fill: "#FFFFFF" }),
      rect({ id: "underline", x: -230, y: 66, width: 560, height: 5, fill: "#2A3040", radius: 2 }),
      text({ id: "tagline", x: -230, y: 112, anchor: "center-left", content: "motion, declared", fontFamily: "Inter", fontSize: 32, fontWeight: 500, fill: "#8B93A7" }),
    ]),
  ],

  states: {
    hidden: {
      disc: { scale: 0, opacity: 0 },
      mark: { scale: 0, rotation: 180, opacity: 0 },
      wordmark: { opacity: 0, x: -280 },
      underline: { width: 0, opacity: 0 },
      tagline: { opacity: 0, y: 142 },
    },
    revealed: {
      disc: { scale: 1, opacity: 1 },
      mark: { scale: 1, rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, x: -230 },
      underline: { width: 560, opacity: 1 },
      tagline: { opacity: 1, y: 112 },
    },
  },
  initial: "hidden",

  timeline: seq(
    wait(0.2),
    to("revealed", { duration: 0.9, ease: "easeOutExpo", stagger: 0.1, label: "reveal" }),
    wait(1.8, "hold"),
    par(
      tween("lockup", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }),
      tween("lockup", { x: 1040 }, { duration: 0.6, ease: "easeInCubic" }),
    ),
  ),

  behaviors: [
    oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 }),
    oscillate("disc", "rotation", { amplitude: 5, frequency: 0.3 }),
  ],
});
