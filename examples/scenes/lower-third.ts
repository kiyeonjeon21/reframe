import { scene, group, rect, text, seq, to, wait } from "@reframe/core";

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    group({ id: "lt", x: 120, y: 860 }, [
      rect({
        id: "bar",
        x: 0,
        y: 0,
        width: 6,
        height: 110,
        anchor: "top-left",
        fill: "#FF4D00",
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
      text({
        id: "role",
        x: 28,
        y: 74,
        content: "Design Engineer",
        fontFamily: "Inter",
        fontSize: 28,
        fill: "#C9C9C9",
      }),
    ]),
  ],

  // A state is a sparse override of node props. Base props are the finished design.
  states: {
    hidden: {
      bar: { height: 0, opacity: 0 },
      name: { opacity: 0, x: 8 },
      role: { opacity: 0, x: 8 },
    },
    shown: {
      bar: { height: 110, opacity: 1 },
      name: { opacity: 1, x: 28 },
      role: { opacity: 1, x: 28 },
    },
  },
  initial: "hidden",

  timeline: seq(
    to("shown", { duration: 0.6, ease: "easeOutCubic", stagger: 0.08 }),
    wait(3.0),
    to("hidden", { duration: 0.4, ease: "easeInCubic" }),
  ),
});
