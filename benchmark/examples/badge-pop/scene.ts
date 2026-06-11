import { scene, group, rect, text, seq, par, tween, wait, oscillate } from "@reframe/core";

// "NEW" badge: pops in with overshoot, hangs with a gentle tilt wiggle,
// then drops away.
export default scene({
  id: "badge-pop",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#15151A",
  nodes: [
    group({ id: "badge", x: 960, y: 540, scale: 0, opacity: 0 }, [
      rect({
        id: "plate",
        x: 0,
        y: 0,
        width: 420,
        height: 160,
        anchor: "center",
        fill: "#E11D48",
        radius: 28,
      }),
      text({
        id: "label",
        x: 0,
        y: 6,
        anchor: "center",
        content: "NEW",
        fontFamily: "Inter",
        fontSize: 88,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 6,
      }),
    ]),
  ],

  timeline: seq(
    wait(0.2),
    // Overshoot pop: scale past 1, settle back.
    par(
      tween("badge", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("badge", { scale: 1.18 }, { duration: 0.28, ease: "easeOutCubic" }),
    ),
    tween("badge", { scale: 1 }, { duration: 0.18, ease: "easeInOutQuad" }),
    wait(1.6),
    // Drop away.
    par(
      tween("badge", { y: 720 }, { duration: 0.35, ease: "easeInCubic" }),
      tween("badge", { opacity: 0 }, { duration: 0.35, ease: "easeInQuad" }),
    ),
    wait(0.2),
  ),

  // Continuous tilt wiggle while visible — additive on top of the timeline.
  behaviors: [oscillate("badge", "rotation", { amplitude: 2.5, frequency: 0.8 })],
});
