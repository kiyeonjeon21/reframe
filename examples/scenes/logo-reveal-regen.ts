import { scene, group, ellipse, rect, text, seq, par, to, tween, wait, oscillate } from "@reframe/core";

// Simulated AI regeneration of logo-reveal: same brief, different take —
// horizontal lockup (mark left of the wordmark), different timing, a new
// underline flourish. Node ids are kept per the regeneration contract,
// EXCEPT "tagline" which was renamed to "subtitle" (a deliberate contract
// violation so the edit-survival demo can show an orphan report).
export default scene({
  id: "logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0A0C",
  nodes: [
    group({ id: "lockup", x: 960, y: 540 }, [
      ellipse({
        id: "disc",
        x: -340,
        y: 0,
        width: 170,
        height: 170,
        anchor: "center",
        fill: "#FF4D00",
      }),
      rect({
        id: "mark",
        x: -340,
        y: 0,
        width: 68,
        height: 68,
        anchor: "center",
        fill: "#0A0A0C",
        radius: 14,
      }),
      text({
        id: "wordmark",
        x: -210,
        y: -16,
        anchor: "center-left",
        content: "reframe",
        fontFamily: "Inter",
        fontSize: 110,
        fontWeight: 800,
        fill: "#FFFFFF",
      }),
      rect({
        id: "underline",
        x: -210,
        y: 64,
        width: 540,
        height: 5,
        fill: "#FF4D00",
        radius: 2,
      }),
      text({
        id: "subtitle", // was "tagline" — contract violation on purpose
        x: -210,
        y: 110,
        anchor: "center-left",
        content: "motion, declared",
        fontFamily: "Inter",
        fontSize: 32,
        fill: "#8B93A7",
      }),
    ]),
  ],

  states: {
    hidden: {
      disc: { scale: 0, opacity: 0 },
      mark: { scale: 0, rotation: 180, opacity: 0 },
      wordmark: { opacity: 0, x: -260 },
      underline: { width: 0, opacity: 0 },
      subtitle: { opacity: 0, y: 140 },
    },
    revealed: {
      disc: { scale: 1, opacity: 1 },
      mark: { scale: 1, rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, x: -210 },
      underline: { width: 540, opacity: 1 },
      subtitle: { opacity: 1, y: 110 },
    },
  },
  initial: "hidden",

  timeline: seq(
    wait(0.2),
    to("revealed", { duration: 0.9, ease: "easeOutExpo", stagger: 0.1 }),
    wait(2.0),
    par(
      tween("lockup", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }),
      tween("lockup", { x: 1040 }, { duration: 0.6, ease: "easeInCubic" }),
    ),
  ),

  behaviors: [
    oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 }),
    oscillate("disc", "rotation", { amplitude: 5, frequency: 0.3 }),
  ],
});
