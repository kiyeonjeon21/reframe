import { scene, ellipse, text, seq, par, stagger, tween, wait } from "@reframe/core";

// Countdown sting: 3 → 2 → 1 → GO! Each number pops inside a ring,
// then GO! takes over the frame.
const numbers = ["3", "2", "1"];

export default scene({
  id: "countdown",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    ellipse({
      id: "ring",
      x: 960,
      y: 540,
      width: 360,
      height: 360,
      anchor: "center",
      stroke: "#3B82F6",
      strokeWidth: 10,
      opacity: 0,
    }),
    ...numbers.map((n, i) =>
      text({
        id: `num-${i}`,
        x: 960,
        y: 540,
        anchor: "center",
        content: n,
        fontFamily: "Inter",
        fontSize: 220,
        fontWeight: 800,
        fill: "#FFFFFF",
        opacity: 0,
        scale: 0.5,
      }),
    ),
    text({
      id: "go",
      x: 960,
      y: 540,
      anchor: "center",
      content: "GO!",
      fontFamily: "Inter",
      fontSize: 320,
      fontWeight: 800,
      fill: "#FF4D00",
      opacity: 0,
      scale: 0.5,
    }),
  ],

  timeline: seq(
    tween("ring", { opacity: 1, scale: 1 }, { duration: 0.3, ease: "easeOutCubic" }),
    // Each number: pop in, hold, snap out — exactly one second per number.
    ...numbers.map((_, i) =>
      seq(
        par(
          tween(`num-${i}`, { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween(`num-${i}`, { scale: 1.1 }, { duration: 0.2, ease: "easeOutCubic" }),
        ),
        tween(`num-${i}`, { scale: 1 }, { duration: 0.1, ease: "easeInOutQuad" }),
        wait(0.45),
        tween(`num-${i}`, { opacity: 0, scale: 0.7 }, { duration: 0.1, ease: "easeInQuad" }),
      ),
    ),
    // GO! bursts past the ring.
    par(
      tween("go", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("go", { scale: 1.15 }, { duration: 0.25, ease: "easeOutCubic" }),
      tween("ring", { scale: 1.6, opacity: 0 }, { duration: 0.4, ease: "easeOutCubic" }),
    ),
    tween("go", { scale: 1 }, { duration: 0.15, ease: "easeInOutQuad" }),
    wait(0.6),
  ),
});
