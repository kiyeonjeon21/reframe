import { scene, rect, text, seq, to, wait } from "@reframe/core";

// Broadcast lower third — "Dr. Maya Chen / Climate Scientist, NOAA"
// 1920x1080 @ 30fps, 5.0s total.
//
// Layout (lower-left safe area):
//   - Teal accent bar at x=120, rising to just above the name's cap height.
//   - Name baseline at y=940, role line tucked beneath it.
// Motion:
//   - 0.0–0.4s  empty frame.
//   - 0.4–1.2s  staggered entrance (bar → name → role), slide-in from left
//               with fade, decelerating ease. Bar additionally grows upward.
//   - 1.2–4.2s  hold.
//   - 4.2–5.0s  clean exit: fade + slight slide back left, accelerating ease.

const SLIDE = 38; // px of horizontal travel for the slide-in/out

export default scene({
  id: "lower-third-maya-chen",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0E1116",
  nodes: [
    // Accent bar — anchored at its bottom so it can grow upward on entry.
    rect({
      id: "accent",
      x: 120,
      y: 996,
      width: 8,
      height: 122,
      anchor: "bottom-left",
      fill: "#00C2A8",
      radius: 2,
      opacity: 0,
    }),
    // Name line — large, bold, white.
    text({
      id: "name",
      x: 158,
      y: 940,
      anchor: "bottom-left",
      content: "Dr. Maya Chen",
      fontFamily: "Inter",
      fontSize: 66,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 0.5,
      opacity: 0,
    }),
    // Role line — smaller, muted gray, slight tracking for hierarchy.
    text({
      id: "role",
      x: 160,
      y: 988,
      anchor: "bottom-left",
      content: "Climate Scientist, NOAA",
      fontFamily: "Inter",
      fontSize: 31,
      fontWeight: 400,
      fill: "#A8B0BD",
      letterSpacing: 1.2,
      opacity: 0,
    }),
  ],

  states: {
    // Pre-entry: shifted left, invisible; bar collapsed so it grows in.
    hidden: {
      accent: { opacity: 0, x: 120 - SLIDE, height: 0 },
      name: { opacity: 0, x: 158 - SLIDE },
      role: { opacity: 0, x: 160 - SLIDE },
    },
    // Fully composed lower third.
    shown: {
      accent: { opacity: 1, x: 120, height: 122 },
      name: { opacity: 1, x: 158 },
      role: { opacity: 1, x: 160 },
    },
    // Exit: fade out with a slight slide back left (no bar collapse —
    // keeps the out-animation clean and uniform).
    out: {
      accent: { opacity: 0, x: 120 - SLIDE },
      name: { opacity: 0, x: 158 - SLIDE },
      role: { opacity: 0, x: 160 - SLIDE },
    },
  },
  initial: "hidden",

  timeline: seq(
    // 0.0–0.4s: empty frame.
    wait(0.4),
    // 0.4–1.2s: accent leads, then name, then role (0.15s apart);
    // each element takes 0.5s — snappy, decelerating slide + fade.
    to("shown", { duration: 0.5, ease: "easeOutQuart", stagger: 0.15 }),
    // Hold fully visible until 4.2s.
    wait(3.0),
    // 4.2–4.75s: accelerate out — fade + slight slide back.
    to("out", { duration: 0.55, ease: "easeInCubic" }),
    // Settle on an empty frame through 5.0s.
    wait(0.25),
  ),
});
