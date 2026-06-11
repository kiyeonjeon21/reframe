import { scene, group, rect, text, seq, par, to, wait } from "@reframe/core";

// Lower third, mirrored to the lower-right corner of frame.
// Entrance: the whole unit rises from below the bottom frame edge while the
// accent bar draws in horizontally (width) and the text settles up into place,
// right-aligned against the bar. Exit reverses the motion back down.

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    // Group origin sits at the LEFT edge of the accent bar; the bar occupies
    // x 0..10 and the text hangs off to the left, right-aligned at x = -30.
    // Frame-space: bar right edge at 1800 -> 120px right margin.
    group({ id: "lt", x: 1790, y: 860 }, [
      rect({
        id: "bar",
        x: 0,
        y: 0,
        width: 10,
        height: 110,
        anchor: "top-left",
        fill: "#FF4D00",
      }),
      text({
        id: "name",
        x: -30,
        y: 14,
        anchor: "top-right",
        content: "Kiyeon Jeon",
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
      text({
        id: "role",
        x: -30,
        y: 74,
        anchor: "top-right",
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
      lt: { y: 1130 }, // whole unit parked fully below the 1080px frame edge
      bar: { width: 0, opacity: 0 },
      name: { opacity: 0, y: 32 },
      role: { opacity: 0, y: 92 },
    },
    shown: {
      lt: { y: 860 },
      bar: { width: 10, opacity: 1 },
      name: { opacity: 1, y: 14 },
      role: { opacity: 1, y: 74 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // Entrance: rise from below, then the bar wipes in and the text settles up.
    par(
      to("shown", { duration: 0.55, ease: "easeOutCubic", filter: ["lt"] }),
      seq(
        wait(0.22),
        to("shown", { duration: 0.35, ease: "easeOutCubic", filter: ["bar"] }),
      ),
      seq(
        wait(0.32),
        to("shown", {
          duration: 0.4,
          ease: "easeOutCubic",
          stagger: 0.08,
          filter: ["name", "role"],
        }),
      ),
    ),
    wait(3.0),
    // Exit mirrors the entrance: text drops away, bar retracts, unit sinks
    // back below the frame edge.
    par(
      to("hidden", {
        duration: 0.28,
        ease: "easeInQuad",
        stagger: 0.05,
        filter: ["role", "name", "bar"],
      }),
      seq(
        wait(0.1),
        to("hidden", { duration: 0.4, ease: "easeInCubic", filter: ["lt"] }),
      ),
    ),
    wait(0.2),
  ),
});
