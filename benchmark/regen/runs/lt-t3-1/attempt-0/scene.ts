import { scene, group, rect, text, seq, par, to, wait } from "@reframe/core";

// Boxed lower third: semi-transparent dark backing panel, a thin accent line
// running along the panel's top edge, and name/role set inside the panel.
// In: panel rises and fades in first, then the accent draws across while the
// text slides up in a stagger. Out: content exits first, panel last.

const PANEL_W = 660;
const PANEL_H = 156;

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    group({ id: "lt", x: 120, y: 836 }, [
      // Semi-transparent backing panel
      rect({
        id: "panel",
        x: 0,
        y: 0,
        width: PANEL_W,
        height: PANEL_H,
        anchor: "top-left",
        fill: "#0B0B10",
        opacity: 0.82,
        radius: 8,
      }),
      // Accent: thin line along the panel's top edge
      rect({
        id: "bar",
        x: 0,
        y: 0,
        width: PANEL_W,
        height: 4,
        anchor: "top-left",
        fill: "#FF4D00",
        radius: 2,
      }),
      text({
        id: "name",
        x: 40,
        y: 36,
        content: "Kiyeon Jeon",
        fontFamily: "Inter",
        fontSize: 46,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
      text({
        id: "role",
        x: 40,
        y: 100,
        content: "DESIGN ENGINEER",
        fontFamily: "Inter",
        fontSize: 23,
        fontWeight: 400,
        letterSpacing: 3,
        fill: "#A9A9B3",
      }),
    ]),
  ],

  // States are sparse overrides; base props above are the finished design.
  states: {
    hidden: {
      panel: { opacity: 0, y: 26 },
      bar: { width: 0, opacity: 0 },
      name: { opacity: 0, y: 52 },
      role: { opacity: 0, y: 116 },
    },
    shown: {
      panel: { opacity: 0.82, y: 0 },
      bar: { width: PANEL_W, opacity: 1 },
      name: { opacity: 1, y: 36 },
      role: { opacity: 1, y: 100 },
    },
  },
  initial: "hidden",

  timeline: seq(
    wait(0.2),
    // 1. Panel rises into place
    to("shown", { duration: 0.45, ease: "easeOutCubic", filter: ["panel"] }),
    // 2. Accent draws across the top edge while the text slides up, staggered
    par(
      to("shown", { duration: 0.6, ease: "easeOutQuart", filter: ["bar"] }),
      to("shown", {
        duration: 0.5,
        ease: "easeOutCubic",
        stagger: 0.1,
        filter: ["name", "role"],
      }),
    ),
    wait(3.0),
    // Out: content leaves first, panel follows
    to("hidden", {
      duration: 0.28,
      ease: "easeInQuad",
      stagger: 0.05,
      filter: ["role", "name", "bar"],
    }),
    to("hidden", { duration: 0.32, ease: "easeInCubic", filter: ["panel"] }),
    wait(0.2),
  ),
});
