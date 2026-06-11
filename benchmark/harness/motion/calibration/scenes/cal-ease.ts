import { scene, rect, seq, tween, wait } from "@reframe/core";

// Single high-contrast block translating in three segments with known eases.
// Ground truth for C1 (speed accuracy) and C2 (easing classification).
export default scene({
  id: "cal-ease",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    rect({ id: "box", x: 200, y: 390, width: 300, height: 300, fill: "#E8E8F0" }),
  ],
  // Distances keep peak speeds inside the tracker's ±48 px/frame (full-res)
  // band: linear 1200px/1.2s = 33 const; cubic peaks at 3x mean -> 480px/1.2s
  // peaks at 40. Out-of-band behavior is cal-teleport's job, not this scene's.
  timeline: seq(
    wait(0.3, "lead"),
    tween("box", { x: 1400 }, { duration: 1.2, ease: "linear", label: "seg-linear" }),
    wait(0.5, "gap1"),
    tween("box", { x: 920 }, { duration: 1.2, ease: "easeOutCubic", label: "seg-out" }),
    wait(0.5, "gap2"),
    tween("box", { x: 1400 }, { duration: 1.2, ease: "easeInCubic", label: "seg-in" }),
    wait(0.3, "tail"),
  ),
});
