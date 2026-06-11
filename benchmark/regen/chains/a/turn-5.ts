import { scene, group, ellipse, rect, text, seq, par, stagger, to, tween, wait, oscillate } from "@reframe/core";

// Logo reveal: a mark assembles, the wordmark slides up, then the whole
// lockup floats gently.
// Re-choreographed intro: the disc drops in from above and settles with a
// hard bounce, the mark spins in afterwards, and the text rises overlapping
// the mark's spin. The outro is unchanged.
// Stresses behaviors (oscillate) composing additively on top of the timeline.
// Two large, thin-stroked background rings fade in first and drift slowly.
// The tagline has been replaced by a URL ("reframe.dev") with wider tracking.
export default scene({
  id: "logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#F4F4F1",
  nodes: [
    // Decorative rings sit behind the lockup (declared first = painted first).
    ellipse({
      id: "ring-a",
      x: 960,
      y: 540,
      width: 760,
      height: 760,
      anchor: "center",
      stroke: "#E4E2DC",
      strokeWidth: 2,
      opacity: 0,
    }),
    ellipse({
      id: "ring-b",
      x: 960,
      y: 540,
      width: 1080,
      height: 1080,
      anchor: "center",
      stroke: "#E9E7E1",
      strokeWidth: 1.5,
      opacity: 0,
    }),
    group({ id: "lockup", x: 960, y: 540 }, [
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
        fill: "#F4F4F1",
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
        fill: "#16161A",
      }),
      text({
        id: "url",
        x: 0,
        y: 230,
        anchor: "center",
        content: "reframe.dev",
        fontFamily: "Inter",
        fontSize: 30,
        fill: "#5C6372",
        letterSpacing: 4,
      }),
    ]),
  ],

  states: {
    hidden: {
      // Disc waits fully above the frame at full size, ready to drop.
      disc: { y: -620, scale: 1, opacity: 0 },
      mark: { scale: 0, rotation: -135, opacity: 0 },
      wordmark: { opacity: 0, y: 170 },
      url: { opacity: 0, y: 260 },
    },
    revealed: {
      disc: { y: -60, scale: 1, opacity: 1 },
      mark: { scale: 1, rotation: 0, opacity: 1 },
      wordmark: { opacity: 1, y: 130 },
      url: { opacity: 1, y: 230 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // Background rings ease in ahead of the logo.
    par(
      tween("ring-a", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
      tween("ring-b", { opacity: 1 }, { duration: 0.8, ease: "easeOutCubic" }),
    ),
    // The disc drops in from above, accelerating, and overshoots its resting
    // spot before settling — a strong, weighty bounce.
    par(
      tween("disc", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("disc", { y: -24 }, { duration: 0.45, ease: "easeInCubic" }),
    ),
    tween("disc", { y: -86 }, { duration: 0.2, ease: "easeOutCubic" }),
    tween("disc", { y: -60 }, { duration: 0.18, ease: "easeInOutQuad" }),
    // The mark spins in after the disc has landed; the text rises while the
    // mark is still spinning, heavily overlapped.
    stagger(
      0.18,
      seq(
        par(
          tween("mark", { opacity: 1 }, { duration: 0.2, ease: "easeOutQuad" }),
          tween("mark", { rotation: 16, scale: 1.14 }, { duration: 0.4, ease: "easeOutCubic" }),
        ),
        tween("mark", { rotation: 0, scale: 1 }, { duration: 0.22, ease: "easeInOutQuad" }),
      ),
      to("revealed", {
        duration: 0.7,
        ease: "easeOutExpo",
        stagger: 0.12,
        filter: ["wordmark", "url"],
        label: "reveal",
      }),
    ),
    wait(2.2, "hold"),
    par(
      tween("lockup", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("lockup", { scale: 1.06 }, { duration: 0.5, ease: "easeInCubic" }),
    ),
  ),

  // The lockup breathes while it holds — composed on top of timeline values.
  // The rings drift slowly in the background.
  behaviors: [
    oscillate("lockup", "y", { amplitude: 6, frequency: 0.4 }),
    oscillate("mark", "rotation", { amplitude: 4, frequency: 0.25, phase: 1.2 }),
    oscillate("ring-a", "x", { amplitude: 14, frequency: 0.08 }),
    oscillate("ring-a", "y", { amplitude: 10, frequency: 0.06, phase: 0.9 }),
    oscillate("ring-b", "x", { amplitude: 18, frequency: 0.05, phase: 2.1 }),
    oscillate("ring-b", "y", { amplitude: 12, frequency: 0.07, phase: 3.4 }),
  ],
});
