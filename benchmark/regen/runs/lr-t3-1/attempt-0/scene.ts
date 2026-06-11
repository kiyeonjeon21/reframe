import { scene, group, ellipse, rect, line, text, seq, par, to, tween, wait, oscillate } from "@reframe/core";

// Logo reveal — horizontal lockup edition.
// The mark sits on the left; the wordmark and tagline stack to its right.
// A faint baseline rule and an oversized ghost ring dress the background:
// they enter first, frame the reveal, and exit last.
// Intro: rule draws on + ring breathes in → disc glides in from the left →
// inner square spins/pops with an overshoot → type tracks-in from the mark.
// Outro: the lockup accelerates off to the right, then the decor dissolves.
export default scene({
  id: "logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0A0C",

  nodes: [
    // ---- background decoration (behind the lockup) ----
    ellipse({
      id: "bg-ring",
      x: 1470,
      y: 280,
      width: 560,
      height: 560,
      anchor: "center",
      stroke: "#1A1E2A",
      strokeWidth: 2,
      opacity: 0,
      scale: 0.82,
    }),
    line({
      id: "bg-rule",
      x1: 420,
      y1: 712,
      x2: 1500,
      y2: 712,
      stroke: "#1E2230",
      strokeWidth: 2,
      progress: 0,
    }),

    // ---- the lockup ----
    group({ id: "lockup", x: 960, y: 540 }, [
      ellipse({
        id: "disc",
        x: -200,
        y: 0,
        width: 220,
        height: 220,
        anchor: "center",
        fill: "#FF4D00",
      }),
      rect({
        id: "mark",
        x: -200,
        y: 0,
        width: 88,
        height: 88,
        anchor: "center",
        fill: "#0A0A0C",
        radius: 18,
      }),
      text({
        id: "wordmark",
        x: -30,
        y: -32,
        anchor: "center-left",
        content: "reframe",
        fontFamily: "Inter",
        fontSize: 92,
        fontWeight: 700,
        fill: "#FFFFFF",
        letterSpacing: 1,
      }),
      text({
        id: "tagline",
        x: -26,
        y: 54,
        anchor: "center-left",
        content: "motion, declared",
        fontFamily: "Inter",
        fontSize: 30,
        fill: "#8B93A7",
        letterSpacing: 5,
      }),
    ]),
  ],

  states: {
    hidden: {
      disc: { x: -276, opacity: 0, scale: 0.78 },
      mark: { scale: 0, opacity: 0, rotation: 90 },
      wordmark: { opacity: 0, x: -78, letterSpacing: 12 },
      tagline: { opacity: 0, y: 78 },
    },
    revealed: {
      disc: { x: -200, opacity: 1, scale: 1 },
      mark: { scale: 1, opacity: 1, rotation: 0 },
      wordmark: { opacity: 1, x: -30, letterSpacing: 1 },
      tagline: { opacity: 1, y: 54 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // 1 — the stage dresses itself: rule draws across, ghost ring eases in.
    par(
      tween("bg-rule", { progress: 1 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("bg-ring", { opacity: 1, scale: 1 }, { duration: 0.9, ease: "easeOutQuart" }),
    ),

    // 2 — the mark assembles: disc glides in from the left, then the
    // inner square spins into place with a springy overshoot.
    par(
      to("revealed", {
        filter: ["disc"],
        duration: 0.6,
        ease: { cubicBezier: [0.22, 1, 0.36, 1] },
        label: "reveal",
      }),
      seq(
        wait(0.28),
        to("revealed", {
          filter: ["mark"],
          duration: 0.5,
          ease: { cubicBezier: [0.34, 1.56, 0.64, 1] },
        }),
      ),
    ),

    // 3 — type lands: wordmark tracks-in toward the mark, tagline rises after.
    par(
      to("revealed", { filter: ["wordmark"], duration: 0.65, ease: "easeOutQuart" }),
      seq(
        wait(0.18),
        to("revealed", { filter: ["tagline"], duration: 0.55, ease: "easeOutCubic" }),
      ),
    ),

    wait(2.2, "hold"),

    // 4 — outro: the lockup accelerates off-stage to the right…
    par(
      tween("lockup", { x: 1140 }, { duration: 0.55, ease: "easeInQuart" }),
      tween("lockup", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
    ),

    // …then the decoration dissolves behind it.
    par(
      tween("bg-rule", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      tween("bg-ring", { opacity: 0, scale: 1.16 }, { duration: 0.45, ease: "easeInCubic" }),
    ),
    wait(0.2),
  ),

  // Continuous life on top of the timeline: the lockup floats,
  // the inner square sways, and the ghost ring drifts slowly.
  behaviors: [
    oscillate("lockup", "y", { amplitude: 5, frequency: 0.35 }),
    oscillate("mark", "rotation", { amplitude: 3, frequency: 0.22, phase: 0.8 }),
    oscillate("bg-ring", "y", { amplitude: 10, frequency: 0.16, phase: 2.1 }),
  ],
});
