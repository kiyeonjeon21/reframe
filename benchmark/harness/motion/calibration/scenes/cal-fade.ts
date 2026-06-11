import { scene, rect, text, seq, tween, wait } from "@reframe/core";

// Stationary content, opacity-only animation. C4: diff sees it, displacement
// does not (movingFraction ~0, nonGeometricRatio high).
export default scene({
  id: "cal-fade",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    rect({ id: "panel", x: 660, y: 340, width: 600, height: 400, fill: "#D8D8E4", radius: 24 }),
    text({
      id: "label",
      x: 960,
      y: 540,
      anchor: "center",
      content: "FADE ONLY",
      fontFamily: "Inter",
      fontSize: 72,
      fontWeight: 800,
      fill: "#101014",
    }),
  ],
  timeline: seq(
    wait(0.5, "hold1"),
    tween("panel", { opacity: 0 }, { duration: 1.0, ease: "easeInQuad", label: "fade-out-panel" }),
    tween("label", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad", label: "fade-out-label" }),
    wait(0.5, "hold2"),
    tween("panel", { opacity: 1 }, { duration: 1.0, ease: "easeOutQuad", label: "fade-in-panel" }),
    tween("label", { opacity: 1 }, { duration: 0.6, ease: "easeOutQuad", label: "fade-in-label" }),
    wait(0.5, "hold3"),
  ),
});
