import { scene, rect, ellipse, text, seq, par, motionPath, tween, wait } from "@reframe/core";

// A hand-authored scene for the mouse-refine loop (reframe preview):
//   - drag the "title" text (a top-level node) to reposition it
//   - drag the dot's motionPath waypoints (the "fly" curve)
//   - hit ✎ on the "grow" tween to reshape its ease curve
// Every edit maps to a literal here, so it folds cleanly back into this file.
export default scene({
  id: "motion-lab",
  size: { width: 1280, height: 720 },
  fps: 30,
  background: "#0D1117",
  nodes: [
    rect({ id: "bg", x: 0, y: 0, width: 1280, height: 720, fill: "#0D1117" }),
    text({ id: "title", x: 640, y: 110, anchor: "center", content: "motion lab", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#E6EDF3" }),
    ellipse({ id: "dot", x: 200, y: 400, width: 90, height: 90, anchor: "center", fill: "#58A6FF", scale: 0.4, opacity: 0 }),
  ],
  timeline: seq(
    wait(0.2),
    par(
      motionPath("dot", [[200, 400], [500, 200], [800, 520], [1080, 360]], { duration: 2.2, ease: "easeInOutCubic", label: "fly" }),
      tween("dot", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "grow" }),
    ),
    wait(0.6, "hold"),
  ),
});
