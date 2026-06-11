import { scene, group, rect, text, seq, par, to, tween, wait } from "@reframe/core";

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    // Lower-right corner: the bar sits on the right edge of the group,
    // text right-aligns against it, mirroring the original left layout.
    group({ id: "lt", x: 1800, y: 860 }, [
      // Anchored at its bottom edge so animating height draws it bottom-to-top.
      rect({
        id: "bar",
        x: 0,
        y: 110,
        width: 6,
        height: 110,
        anchor: "bottom-right",
        fill: "#FF5C39",
      }),
      text({
        id: "name",
        x: -28,
        y: 14,
        anchor: "top-right",
        content: "Kiyeon Jeon",
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 800,
        fill: "#FFFFFF",
      }),
      // Handle line replaces the old role text: smaller and letter-spaced.
      text({
        id: "handle",
        x: -28,
        y: 76,
        anchor: "top-right",
        content: "@reframe",
        fontFamily: "Inter",
        fontSize: 22,
        fill: "#C9C9C9",
        letterSpacing: 4,
      }),
      // LIVE badge sits just above the name, right-aligned with the text edge;
      // pops in after the name lands.
      group({ id: "live", x: -80, y: -26, anchor: "center", scale: 0, opacity: 0 }, [
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
      handle: { opacity: 0, y: 106 },
    },
    shown: {
      bar: { height: 110, opacity: 1 },
      name: { opacity: 1, y: 14 },
      handle: { opacity: 1, y: 76 },
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
