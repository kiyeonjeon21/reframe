import { scene, rect, seq, tween, wait } from "@reframe/core";

// A sub-frame-duration jump (effective teleport on the frame grid) followed
// by a fast-but-eased move of the same distance. C3: exactly one spike, and
// the eased move must NOT be flagged.
export default scene({
  id: "cal-teleport",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    rect({ id: "box", x: 300, y: 390, width: 300, height: 300, fill: "#E8E8F0" }),
  ],
  timeline: seq(
    wait(1.0, "hold1"),
    tween("box", { x: 900 }, { duration: 0.01, label: "jump" }), // < 1 frame = teleport
    wait(1.0, "hold2"),
    tween("box", { x: 1230 }, { duration: 0.5, ease: "easeOutQuad", label: "fast-eased" }),
    wait(1.0, "hold3"),
  ),
});
