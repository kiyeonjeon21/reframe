import {
  scene,
  group,
  line,
  ellipse,
  text,
  seq,
  to,
  wait,
  oscillate,
} from "@reframe/core";

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    group({ id: "lt", x: 120, y: 860 }, [
      // Accent bar rebuilt as a stroked line that draws on via `progress`.
      line({
        id: "bar",
        x1: 3,
        y1: 0,
        x2: 3,
        y2: 110,
        stroke: "#FF4D00",
        strokeWidth: 6,
        progress: 1,
      }),
      text({
        id: "name",
        x: 28,
        y: 14,
        content: "Kiyeon Jeon",
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
      // Social handle row: dot — @kiyeon — dot
      ellipse({
        id: "dot-left",
        x: 34,
        y: 95,
        width: 8,
        height: 8,
        anchor: "center",
        fill: "#FF4D00",
      }),
      text({
        id: "handle",
        x: 52,
        y: 78,
        content: "@kiyeon",
        fontFamily: "Inter",
        fontSize: 26,
        fontWeight: 400,
        fill: "#C9C9C9",
        letterSpacing: 1,
      }),
      ellipse({
        id: "dot-right",
        x: 172,
        y: 95,
        width: 8,
        height: 8,
        anchor: "center",
        fill: "#FF4D00",
      }),
    ]),
  ],

  // A state is a sparse override of node props. Base props are the finished design.
  states: {
    hidden: {
      bar: { progress: 0, opacity: 0 },
      name: { opacity: 0, x: 8 },
      "dot-left": { opacity: 0, scale: 0 },
      handle: { opacity: 0, x: 32 },
      "dot-right": { opacity: 0, scale: 0 },
    },
    shown: {
      bar: { progress: 1, opacity: 1 },
      name: { opacity: 1, x: 28 },
      "dot-left": { opacity: 1, scale: 1 },
      handle: { opacity: 1, x: 52 },
      "dot-right": { opacity: 1, scale: 1 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // Bar draws on first, then name, then the handle row cascades in.
    to("shown", { duration: 0.55, ease: "easeOutCubic", stagger: 0.09 }),
    wait(3.0),
    to("hidden", { duration: 0.4, ease: "easeInCubic" }),
  ),

  behaviors: [
    // Gentle counter-phased pulse on the flanking dots during the hold.
    oscillate(
      "dot-left",
      "scale",
      { amplitude: 0.18, frequency: 0.9 },
      { from: 1.2, until: 3.6 },
    ),
    oscillate(
      "dot-right",
      "scale",
      { amplitude: 0.18, frequency: 0.9, phase: Math.PI },
      { from: 1.2, until: 3.6 },
    ),
  ],
});
