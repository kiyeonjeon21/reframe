import { scene, rect, wait, seq, oscillate } from "@reframe/core";

// A visible block oscillates gently during a hold — low amplitude (below the
// activity floor, so NO discrete events) but a clear periodicity to detect.
export default scene({
  id: "trace-hold",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    rect({ id: "box", x: 960, y: 540, width: 360, height: 360, anchor: "center", fill: "#E8E8F0" }),
  ],
  timeline: seq(wait(6.0, "hold")),
  behaviors: [oscillate("box", "x", { amplitude: 6, frequency: 0.4 })],
});
