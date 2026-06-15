import { scene, rect, par, tween, seq, wait } from "@reframe/core";

// Two blocks fade in SIMULTANEOUSLY, left and right. Frame-scalar signals
// would merge these into one event; spatial separation must keep them apart.
export default scene({
  id: "trace-concurrent",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    rect({ id: "left", x: 360, y: 540, width: 320, height: 320, anchor: "center", fill: "#E8E8F0", opacity: 0 }),
    rect({ id: "right", x: 1560, y: 540, width: 320, height: 320, anchor: "center", fill: "#E8E8F0", opacity: 0 }),
  ],
  timeline: seq(
    wait(0.6, "lead"),
    par(
      tween("left", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "enter-left" }),
      tween("right", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "enter-right" }),
    ),
    wait(0.8, "hold"),
  ),
});
