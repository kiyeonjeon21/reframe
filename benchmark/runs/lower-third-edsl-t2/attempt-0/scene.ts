import { scene, rect, text, seq, to, wait } from "@reframe/core";

// Broadcast lower third — "Dr. Maya Chen / Climate Scientist, NOAA"
// 1920x1080 @ 30fps, 5.0s total.
//
// Layout (finished design):
//   - Teal accent bar at x=120, spanning the full text block height.
//   - Name baseline block bottom at y=900 (68px, extra-bold, white).
//   - Role line bottom at y=944 (34px, regular, muted gray) — overall
//     block baseline sits around y=940 in the lower-left safe area.

const ACCENT = "#00C2A8";
const NAME_WHITE = "#FFFFFF";
const ROLE_GRAY = "#A8B0BD";

const BAR_X = 120;
const TEXT_X = 156;
const SLIDE = 44; // entrance slide-in distance from the left

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0E1116",
  nodes: [
    // Accent bar — grows upward from the block's bottom edge while sliding in.
    rect({
      id: "bar",
      x: BAR_X,
      y: 944,
      anchor: "bottom-left",
      width: 10,
      height: 112,
      fill: ACCENT,
    }),
    // Name line.
    text({
      id: "name",
      x: TEXT_X,
      y: 900,
      anchor: "bottom-left",
      content: "Dr. Maya Chen",
      fontFamily: "Inter",
      fontSize: 68,
      fontWeight: 800,
      fill: NAME_WHITE,
      letterSpacing: 0.5,
    }),
    // Role line.
    text({
      id: "role",
      x: TEXT_X,
      y: 944,
      anchor: "bottom-left",
      content: "Climate Scientist, NOAA",
      fontFamily: "Inter",
      fontSize: 34,
      fontWeight: 400,
      fill: ROLE_GRAY,
      letterSpacing: 1.5,
    }),
  ],

  states: {
    // Off-screen look: shifted left, invisible; bar collapsed.
    hidden: {
      bar: { opacity: 0, x: BAR_X - SLIDE, height: 0 },
      name: { opacity: 0, x: TEXT_X - SLIDE },
      role: { opacity: 0, x: TEXT_X - SLIDE },
    },
    // On-air look: the finished design.
    shown: {
      bar: { opacity: 1, x: BAR_X, height: 112 },
      name: { opacity: 1, x: TEXT_X },
      role: { opacity: 1, x: TEXT_X },
    },
    // Exit look: slight slide back to the left while fading.
    out: {
      bar: { opacity: 0, x: BAR_X - 28 },
      name: { opacity: 0, x: TEXT_X - 28 },
      role: { opacity: 0, x: TEXT_X - 28 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // 0.0–0.4s: empty frame.
    wait(0.4),
    // 0.4–1.19s: enter — bar leads, then name, then role (0.12s apart),
    // each decelerating into place.
    to("shown", { duration: 0.55, ease: "easeOutQuart", stagger: 0.12 }),
    // Hold fully visible until 4.2s.
    wait(3.01),
    // 4.2–4.81s: clean exit — fade + slight slide back, accelerating ease.
    to("out", { duration: 0.45, ease: "easeInCubic", stagger: 0.08 }),
    // Pad to exactly 5.0s total.
    wait(0.19),
  ),
});
