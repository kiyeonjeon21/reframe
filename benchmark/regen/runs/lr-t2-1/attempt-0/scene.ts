import { scene, group, ellipse, rect, text, seq, par, to, tween, wait, oscillate } from "@reframe/core";

// Logo reveal (redesigned): the disc glides in from the left of frame with a
// hard decelerating ease, the inner mark spins to rest on top of it, and the
// wordmark + tagline snap into place with short, punchy timing. The whole
// lockup now lives left-of-center (x=480) and floats gently during the hold.
export default scene({
  id: "logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0A0C",
  nodes: [
    group({ id: "lockup", x: 480, y: 540 }, [
      ellipse({
        id: "disc",
        x: 0,
        y: -60,
        width: 220,
        height: 220,
        anchor: "center",
        fill: "#FF4D00",
      }),
      rect({
        id: "mark",
        x: 0,
        y: -60,
        width: 88,
        height: 88,
        anchor: "center",
        fill: "#0A0A0C",
        radius: 18,
      }),
      text({
        id: "wordmark",
        x: 0,
        y: 130,
        anchor: "center",
        content: "reframe",
        fontFamily: "Inter",
        fontSize: 84,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
      text({
        id: "tagline",
        x: 0,
        y: 210,
        anchor: "center",
        content: "motion, declared",
        fontFamily: "Inter",
        fontSize: 30,
        fill: "#8B93A7",
      }),
    ]),
  ],

  states: {
    hidden: {
      // Disc starts fully offscreen left (group x=480, so local -640 puts its
      // right edge past the frame edge) — it slides, it does not pop.
      disc: { x: -640 },
      // Mark arrives by rotation: a 1.5-turn spin that decelerates to rest.
      mark: { rotation: -540, opacity: 0 },
      // Short travel for snappy landings.
      wordmark: { opacity: 0, y: 158 },
      tagline: { opacity: 0, y: 232 },
    },
    revealed: {
      disc: { x: 0 },
      mark: { rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, y: 130 },
      tagline: { opacity: 1, y: 210 },
    },
  },
  initial: "hidden",

  timeline: seq(
    par(
      // 1) Disc slides in from the left with a strong decelerating ease.
      to("revealed", { duration: 0.85, ease: "easeOutExpo", filter: ["disc"], label: "reveal" }),
      // 2) Mark fades up fast and spins to rest as the disc settles.
      seq(
        wait(0.4),
        par(
          tween("mark", { opacity: 1 }, { duration: 0.18, ease: "easeOutQuad" }),
          tween("mark", { rotation: 0 }, { duration: 0.6, ease: "easeOutCubic" }),
        ),
      ),
      // 3) Wordmark + tagline land with snappier, shorter timing.
      seq(
        wait(0.62),
        to("revealed", {
          duration: 0.26,
          ease: "easeOutCubic",
          filter: ["wordmark", "tagline"],
          stagger: 0.09,
        }),
      ),
    ),
    wait(2.2, "hold"),
    par(
      tween("lockup", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("lockup", { scale: 1.06 }, { duration: 0.5, ease: "easeInCubic" }),
    ),
  ),

  // The lockup breathes while it holds — composed on top of timeline values.
  // The mark's idle sway is windowed so it doesn't muddy the spin-to-rest.
  behaviors: [
    oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 }),
    oscillate("mark", "rotation", { amplitude: 4, frequency: 0.25, phase: 1.2 }, { from: 1.3 }),
  ],
});
