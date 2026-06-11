import {
  scene,
  group,
  rect,
  ellipse,
  text,
  seq,
  par,
  tween,
  wait,
  oscillate,
} from "@reframe/core";

// NOVA — product-launch logo sting
// 1920x1080 @ 30fps, exactly 5.0s
//
// Layout (inside "lockup" group centered at 960,540):
//   mark   : geometric lockup centered at y = -160
//   wordmark: "NOVA" at y = 128 (rises from 173)
//   tagline : "light the way" at y = 224 (rises from 254)
//
// Timeline:
//   0.00–1.00  mark assembles (ring → diamond → core, overlapping)
//   1.00–1.80  wordmark rises + fades in
//   1.20–1.90  tagline follows
//   1.90–4.20  hold (mark floats gently via oscillate behavior)
//   4.20–5.00  whole lockup scales up slightly and fades out

export default scene({
  id: "nova-logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#08090B",

  nodes: [
    group({ id: "lockup", x: 960, y: 540, anchor: "center" }, [
      // ---- Mark: purple ring, white diamond, purple core dot ----
      group({ id: "mark", x: 0, y: -160 }, [
        ellipse({
          id: "ring",
          x: 0,
          y: 0,
          width: 220,
          height: 220,
          anchor: "center",
          stroke: "#7C5CFF",
          strokeWidth: 12,
          opacity: 0,
          scale: 0.4,
        }),
        rect({
          id: "spark",
          x: 0,
          y: 0,
          width: 88,
          height: 88,
          anchor: "center",
          fill: "#FFFFFF",
          radius: 10,
          opacity: 0,
          scale: 0.3,
          rotation: 225,
        }),
        ellipse({
          id: "core",
          x: 0,
          y: 0,
          width: 26,
          height: 26,
          anchor: "center",
          fill: "#7C5CFF",
          opacity: 0,
          scale: 0,
        }),
      ]),

      // ---- Wordmark ----
      text({
        id: "wordmark",
        x: 0,
        y: 173,
        anchor: "center",
        content: "NOVA",
        fontFamily: "Inter",
        fontSize: 132,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 30,
        opacity: 0,
      }),

      // ---- Tagline ----
      text({
        id: "tagline",
        x: 0,
        y: 254,
        anchor: "center",
        content: "light the way",
        fontFamily: "Inter",
        fontSize: 34,
        fontWeight: 400,
        fill: "#8A8F99",
        letterSpacing: 10,
        opacity: 0,
      }),
    ]),
  ],

  timeline: seq(
    // ---- 0.0–1.9s: mark assembly, then type entrance (overlapping) ----
    par(
      // Ring: scale-in with a soft overshoot (0.00–0.65)
      seq(
        par(
          tween("ring", { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween("ring", { scale: 1.08 }, { duration: 0.45, ease: "easeOutCubic" }),
        ),
        tween("ring", { scale: 1 }, { duration: 0.2, ease: "easeInOutQuad" }),
      ),

      // Diamond: rotates in 180° and settles as a diamond (0.25–0.85)
      seq(
        wait(0.25),
        par(
          tween("spark", { opacity: 1 }, { duration: 0.2, ease: "easeOutQuad" }),
          tween("spark", { rotation: 45, scale: 1 }, { duration: 0.6, ease: "easeOutQuart" }),
        ),
      ),

      // Core dot: pops last with overshoot (0.55–1.00)
      seq(
        wait(0.55),
        par(
          tween("core", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween("core", { scale: 1.35 }, { duration: 0.3, ease: "easeOutCubic" }),
        ),
        tween("core", { scale: 1 }, { duration: 0.15, ease: "easeInOutQuad" }),
      ),

      // Wordmark: rises from below while fading in (1.00–1.80)
      seq(
        wait(1.0),
        par(
          tween("wordmark", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
          tween("wordmark", { y: 128 }, { duration: 0.8, ease: "easeOutCubic" }),
        ),
      ),

      // Tagline: follows ~0.2s later (1.20–1.90)
      seq(
        wait(1.2),
        par(
          tween("tagline", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
          tween("tagline", { y: 224 }, { duration: 0.7, ease: "easeOutCubic" }),
        ),
      ),
    ),

    // ---- 1.9–4.2s: hold the full lockup ----
    wait(2.3),

    // ---- 4.2–5.0s: gentle scale-up and fade-out of everything ----
    par(
      tween("lockup", { scale: 1.06 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("lockup", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
    ),
  ),

  // Subtle continuous float on the mark so the hold stays alive
  behaviors: [
    oscillate("mark", "y", { amplitude: 7, frequency: 0.28 }),
  ],
});
