import { scene, rect, text, seq, to, wait } from "@reframe/core";

// Broadcast lower third — "Dr. Maya Chen / Climate Scientist, NOAA"
// 1920x1080 @ 30fps, 5.0s total.
//
// Layout (lower-left safe area):
//   accent bar : x=120, spans the full text block height, #00C2A8
//   name       : baseline block bottom at y=940, Inter 800, white
//   role       : sits below the name, Inter 400, muted #A8B0BD
//
// Timing:
//   0.00–0.40  empty hold
//   0.40–1.20  entrance — bar leads (grows up + fades), name and role follow,
//              each 0.12s later, sliding in from the left (easeOutCubic)
//   1.20–4.20  hold fully visible
//   4.20–4.65  exit — fade + slide back left (easeInCubic)
//   4.65–5.00  empty hold

const LEFT = 120;       // safe-area left edge (accent bar)
const TEXT_X = 156;     // text column, offset from the bar
const SLIDE = 28;       // entrance slide distance

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0E1116",
  nodes: [
    // Accent bar — declared first so it leads the staggered entrance.
    rect({
      id: "bar",
      x: LEFT,
      y: 996,
      width: 8,
      height: 116,
      anchor: "bottom-left", // grows upward from its base
      fill: "#00C2A8",
      radius: 2,
      opacity: 0,
    }),
    text({
      id: "name",
      x: TEXT_X - SLIDE,
      y: 940,
      anchor: "bottom-left",
      content: "Dr. Maya Chen",
      fontFamily: "Inter",
      fontSize: 62,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 0.5,
      opacity: 0,
    }),
    text({
      id: "role",
      x: TEXT_X - SLIDE,
      y: 990,
      anchor: "bottom-left",
      content: "Climate Scientist, NOAA",
      fontFamily: "Inter",
      fontSize: 30,
      fontWeight: 400,
      fill: "#A8B0BD",
      letterSpacing: 1.2,
      opacity: 0,
    }),
  ],
  states: {
    hidden: {
      bar: { height: 0, opacity: 0, x: LEFT },
      name: { x: TEXT_X - SLIDE, opacity: 0 },
      role: { x: TEXT_X - SLIDE, opacity: 0 },
    },
    shown: {
      bar: { height: 116, opacity: 1, x: LEFT },
      name: { x: TEXT_X, opacity: 1 },
      role: { x: TEXT_X, opacity: 1 },
    },
    out: {
      bar: { height: 116, opacity: 0, x: LEFT - 18 },
      name: { x: TEXT_X - 22, opacity: 0 },
      role: { x: TEXT_X - 22, opacity: 0 },
    },
  },
  initial: "hidden",
  timeline: seq(
    // 1) empty frame
    wait(0.4),
    // 2) entrance: bar -> name -> role, 0.12s apart; last element lands at 1.2s
    to("shown", { duration: 0.56, ease: "easeOutCubic", stagger: 0.12 }),
    // 3) hold fully visible until 4.2s
    wait(3.0),
    // 4) clean exit: fade + slight slide back, accelerating
    to("out", { duration: 0.45, ease: "easeInCubic" }),
    // pad to exactly 5.0s
    wait(0.35),
  ),
});
