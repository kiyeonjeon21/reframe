import { scene, rect, par, seq, tween, wait } from "@reframe/core";

// Three high-contrast blocks fade in, staggered, in left/center/right regions.
// Truth: 3 enter events at staggered onsets, spatially separable.
const blocks = [
  { id: "a", x: 300 },
  { id: "b", x: 960 },
  { id: "c", x: 1620 },
];

export default scene({
  id: "trace-enter",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: blocks.map((b) =>
    rect({ id: b.id, x: b.x, y: 540, width: 320, height: 320, anchor: "center", fill: "#E8E8F0", opacity: 0 }),
  ),
  timeline: seq(
    wait(0.4, "lead"),
    tween("a", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "enter-a" }),
    wait(0.1, "g1"),
    tween("b", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "enter-b" }),
    wait(0.1, "g2"),
    tween("c", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "enter-c" }),
    wait(0.6, "hold"),
  ),
});
