import { scene, group, ellipse, rect, text, seq, par, to, tween, wait, oscillate } from "@reframe/core";

// Logo reveal: a mark assembles (disc pops, inner square spins into place),
// the wordmark slides up, then the whole lockup floats gently.
// Stresses behaviors (oscillate) composing additively on top of the timeline.
export default scene({
  id: "logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0A0C",
  nodes: [
    group({ id: "lockup", x: 960, y: 540 }, [
      ellipse({
        id: "disc",
        x: 0,
        y: -60,
        width: 220,
        height: 220,
        anchor: "center",
        fill: "#FF4D00",
      }),
      rect({
        id: "mark",
        x: 0,
        y: -60,
        width: 88,
        height: 88,
        anchor: "center",
        fill: "#0A0A0C",
        radius: 18,
      }),
      text({
        id: "wordmark",
        x: 0,
        y: 130,
        anchor: "center",
        content: "reframe",
        fontFamily: "Inter",
        fontSize: 84,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
      text({
        id: "tagline",
        x: 0,
        y: 210,
        anchor: "center",
        content: "motion, declared",
        fontFamily: "Inter",
        fontSize: 30,
        fill: "#8B93A7",
      }),
    ]),
  ],

  states: {
    hidden: {
      disc: { scale: 0, opacity: 0 },
      mark: { scale: 0, rotation: -135, opacity: 0 },
      wordmark: { opacity: 0, y: 170 },
      tagline: { opacity: 0, y: 240 },
    },
    revealed: {
      disc: { scale: 1, opacity: 1 },
      mark: { scale: 1, rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, y: 130 },
      tagline: { opacity: 1, y: 210 },
    },
  },
  initial: "hidden",

  timeline: seq(
    to("revealed", { duration: 0.7, ease: "easeOutExpo", stagger: 0.12 }),
    wait(2.2),
    par(
      tween("lockup", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("lockup", { scale: 1.06 }, { duration: 0.5, ease: "easeInCubic" }),
    ),
  ),

  // The lockup breathes while it holds — composed on top of timeline values.
  behaviors: [
    oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 }),
    oscillate("mark", "rotation", { amplitude: 4, frequency: 0.25, phase: 1.2 }),
  ],
});
