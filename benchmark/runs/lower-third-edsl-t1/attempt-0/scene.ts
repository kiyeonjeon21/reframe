import { scene, group, rect, text, seq, par, to, tween, wait } from "@reframe/core";

// Broadcast lower third — "Dr. Maya Chen / Climate Scientist, NOAA"
// 1920x1080 @ 30fps, total 5.0s.
//
// Layout (finished design):
//   accent bar  : x=120, 10px wide, spans the full text block (y 868..992)
//   name        : Inter 800 / 64px white, baseline ~940, x=152
//   role        : Inter 400 / 32px #A8B0BD, sits just under the name
//
// Timing:
//   0.0–0.4   empty hold
//   0.4–1.2   enter — bar leads (grows up), name then role slide in from the
//             left and fade, 0.125s apart, easeOutCubic (snappy, decelerating)
//   1.2–4.2   hold fully visible
//   4.2–4.65  exit — whole unit fades and slides back left, accelerating ease
//   4.65–5.0  empty hold

export default scene({
  id: "lower-third",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0E1116",
  nodes: [
    group({ id: "l3", x: 0, y: 0 }, [
      // Accent bar: anchored at its bottom so it grows upward as it enters.
      rect({
        id: "bar",
        x: 120,
        y: 992,
        width: 10,
        height: 0,
        anchor: "bottom-left",
        fill: "#00C2A8",
        radius: 2,
        opacity: 0,
      }),
      text({
        id: "name",
        x: 116,
        y: 940,
        anchor: "bottom-left",
        content: "Dr. Maya Chen",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 0.5,
        opacity: 0,
      }),
      text({
        id: "role",
        x: 116,
        y: 954,
        anchor: "top-left",
        content: "Climate Scientist, NOAA",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 400,
        fill: "#A8B0BD",
        letterSpacing: 1,
        opacity: 0,
      }),
    ]),
  ],

  states: {
    hidden: {
      bar: { height: 0, opacity: 0 },
      name: { x: 116, opacity: 0 },
      role: { x: 116, opacity: 0 },
    },
    shown: {
      bar: { height: 124, opacity: 1 },
      name: { x: 152, opacity: 1 },
      role: { x: 152, opacity: 1 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // 1) Empty frame.
    wait(0.4),

    // 2) Entrance: bar -> name -> role, 0.125s apart, each 0.55s.
    //    Last element starts at 0.25, so the step spans 0.8s (0.4 -> 1.2).
    to("shown", { duration: 0.55, ease: "easeOutCubic", stagger: 0.125 }),

    // 3) Hold fully visible until 4.2s.
    wait(3.0),

    // 4) Exit: the whole unit slides back left while fading, accelerating.
    par(
      tween("l3", { x: -36 }, { duration: 0.45, ease: "easeInCubic" }),
      tween("l3", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
    ),

    // Pad out to exactly 5.0s.
    wait(0.35),
  ),
});
