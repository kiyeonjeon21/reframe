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
        height: 124,
        anchor: "top-left",
        fill: "#00C2A8",
      }),
      text({
        id: "name",
        x: 36,
        y: 12,
        content: "Kiyeon Jeon",
        fontFamily: "Inter",
        fontSize: 56,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
      text({
        id: "role",
        x: 36,
        y: 82,
        content: "Design Engineer",
        fontFamily: "Inter",
        fontSize: 32,
        fill: "#C9C9C9",
      }),
    ]),
  ],

  // A state is a sparse override of node props. Base props are the finished design.
  states: {
    hidden: {
      bar: { height: 0, opacity: 0 },
      name: { opacity: 0, x: 16 },
      role: { opacity: 0, x: 16 },
    },
    shown: {
      bar: { height: 124, opacity: 1 },
      name: { opacity: 1, x: 36 },
      role: { opacity: 1, x: 36 },
    },
  },
  initial: "hidden",

  timeline: seq(
    to("shown", { duration: 0.6, ease: "easeOutCubic", stagger: 0.08 }),
    wait(3.0),
    to("hidden", { duration: 0.4, ease: "easeInCubic" }),
  ),
});
