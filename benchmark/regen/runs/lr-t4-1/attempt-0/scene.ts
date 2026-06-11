import { scene, group, rect, text, line, seq, par, to, tween, wait, oscillate } from "@reframe/core";

// Logo reveal: the mark assembles (rounded badge pops, inner square spins into
// place), the wordmark slides up, the URL fades in and its highlight underline
// draws across, then the whole lockup floats gently before scaling away.
export default scene({
  id: "logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0A0C",
  nodes: [
    group({ id: "lockup", x: 960, y: 540 }, [
      // Rounded-corner square badge sitting behind the inner mark.
      rect({
        id: "disc",
        x: 0,
        y: -60,
        width: 220,
        height: 220,
        anchor: "center",
        fill: "#FF4D00",
        radius: 52,
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
        id: "url",
        x: 0,
        y: 212,
        anchor: "center",
        content: "reframe.dev",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 400,
        fill: "#8B93A7",
        letterSpacing: 2,
      }),
      // Short highlight underline that draws in beneath the URL.
      line({
        id: "underline",
        x1: -92,
        y1: 244,
        x2: 92,
        y2: 244,
        stroke: "#FF4D00",
        strokeWidth: 5,
        progress: 0,
      }),
    ]),
  ],

  states: {
    hidden: {
      disc: { scale: 0, opacity: 0, rotation: -24 },
      mark: { scale: 0, rotation: -135, opacity: 0 },
      wordmark: { opacity: 0, y: 170 },
      url: { opacity: 0, y: 240 },
      underline: { progress: 0, opacity: 0 },
    },
    revealed: {
      disc: { scale: 1, opacity: 1, rotation: 0 },
      mark: { scale: 1, rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, y: 130 },
      url: { opacity: 1, y: 212 },
      underline: { opacity: 1 },
    },
  },
  initial: "hidden",

  timeline: seq(
    to("revealed", { duration: 0.7, ease: "easeOutExpo", stagger: 0.12, label: "reveal" }),
    // The underline sweeps across once the URL has settled.
    tween("underline", { progress: 1 }, { duration: 0.45, ease: "easeOutCubic" }),
    wait(2.2, "hold"),
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
