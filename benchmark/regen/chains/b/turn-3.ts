import { scene, group, rect, text, seq, par, to, tween, wait } from "@reframe/core";

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    group({ id: "lt", x: 120, y: 860 }, [
      // Anchored at its bottom edge so animating height draws it bottom-to-top.
      rect({
        id: "bar",
        x: 0,
        y: 110,
        width: 6,
        height: 110,
        anchor: "bottom-left",
        fill: "#FF5C39",
      }),
      text({
        id: "name",
        x: 28,
        y: 14,
        content: "Kiyeon Jeon",
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 800,
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
      // LIVE badge sits just above the name; pops in after the name lands.
      group({ id: "live", x: 80, y: -26, anchor: "center", scale: 0, opacity: 0 }, [
        rect({
          id: "live-plate",
          x: 0,
          y: 0,
          width: 104,
          height: 38,
          anchor: "center",
          fill: "#E11D48",
          radius: 10,
        }),
        text({
          id: "live-label",
          x: 0,
          y: 1,
          anchor: "center",
          content: "LIVE",
          fontFamily: "Inter",
          fontSize: 22,
          fontWeight: 800,
          fill: "#FFFFFF",
          letterSpacing: 3,
        }),
      ]),
    ]),
  ],

  // A state is a sparse override of node props. Base props are the finished design.
  // Entrance: text slides up from below; bar draws vertically bottom-to-top.
  states: {
    hidden: {
      bar: { height: 0, opacity: 0 },
      name: { opacity: 0, y: 44 },
      role: { opacity: 0, y: 104 },
    },
    shown: {
      bar: { height: 110, opacity: 1 },
      name: { opacity: 1, y: 14 },
      role: { opacity: 1, y: 74 },
    },
  },
  initial: "hidden",

  timeline: seq(
    to("shown", { duration: 0.6, ease: "easeOutCubic", stagger: 0.08 }),
    // Badge pops in after the name lands.
    par(
      tween("live", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("live", { scale: 1.15 }, { duration: 0.25, ease: "easeOutCubic" }),
    ),
    tween("live", { scale: 1 }, { duration: 0.12, ease: "easeInOutQuad" }),
    wait(3.0),
    par(
      to("hidden", { duration: 0.4, ease: "easeInCubic" }),
      tween("live", { opacity: 0, scale: 0.7 }, { duration: 0.4, ease: "easeInQuad" }),
    ),
  ),
});
