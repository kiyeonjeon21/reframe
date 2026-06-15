import { scene, rect, seq, tween, wait } from "@reframe/core";

// One block, visible throughout, does a scale pop (1 → 1.35 → 1) in place.
// Truth: 1 emphasis event (present before/after, transient, returns).
export default scene({
  id: "trace-emphasis",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    rect({ id: "box", x: 960, y: 540, width: 360, height: 360, anchor: "center", fill: "#E8E8F0" }),
  ],
  timeline: seq(
    wait(0.9, "lead"),
    tween("box", { scale: 1.35 }, { duration: 0.28, ease: "easeOutCubic", label: "pop-up" }),
    tween("box", { scale: 1 }, { duration: 0.28, ease: "easeInOutQuad", label: "pop-down" }),
    wait(0.8, "hold"),
  ),
});
