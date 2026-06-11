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
// 1920x1080 @ 30fps, 5.0s total
//
// Layout (inside the "lockup" group, centered on canvas):
//   glow     — soft violet wash behind the mark
//   mark     — ring (#7C5CFF) + white diamond core + small spark above
//   wordmark — "NOVA", wide bold white
//   tagline  — "light the way", muted gray
//
// Timing:
//   0.00–1.15  mark assembles (ring pop -> diamond spins in -> spark rises)
//   1.00–1.80  wordmark rises in; tagline follows 0.2s later
//   1.80–4.20  hold (mark floats gently)
//   4.20–5.00  whole lockup scales up slightly and fades out

const VIOLET = "#7C5CFF";
const SPARK = "#B8A6FF";
const WHITE = "#FFFFFF";
const MUTED = "#8A8F98";

export default scene({
  id: "nova-logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#08090B",
  nodes: [
    group({ id: "lockup", x: 960, y: 562, anchor: "center", scale: 1, opacity: 1 }, [
      // Soft ambient glow behind the mark
      ellipse({
        id: "glow",
        x: 0,
        y: -150,
        width: 760,
        height: 760,
        anchor: "center",
        fill: VIOLET,
        opacity: 0,
      }),

      // ---- Mark -------------------------------------------------------
      group({ id: "mark", x: 0, y: -150, anchor: "center" }, [
        ellipse({
          id: "ring",
          x: 0,
          y: 0,
          width: 220,
          height: 220,
          anchor: "center",
          stroke: VIOLET,
          strokeWidth: 14,
          opacity: 0,
          scale: 0.3,
        }),
        rect({
          id: "core",
          x: 0,
          y: 0,
          width: 74,
          height: 74,
          anchor: "center",
          fill: WHITE,
          radius: 10,
          rotation: 225,
          opacity: 0,
          scale: 0,
        }),
        ellipse({
          id: "spark",
          x: 0,
          y: -96,
          width: 18,
          height: 18,
          anchor: "center",
          fill: SPARK,
          opacity: 0,
          scale: 0.4,
        }),
      ]),

      // ---- Wordmark + tagline ------------------------------------------
      text({
        id: "wordmark",
        x: 14, // optical centering for trailing letter-spacing
        y: 138,
        anchor: "center",
        content: "NOVA",
        fontFamily: "Inter",
        fontSize: 112,
        fontWeight: 800,
        fill: WHITE,
        letterSpacing: 28,
        opacity: 0,
      }),
      text({
        id: "tagline",
        x: 5,
        y: 230,
        anchor: "center",
        content: "light the way",
        fontFamily: "Inter",
        fontSize: 34,
        fontWeight: 400,
        fill: MUTED,
        letterSpacing: 10,
        opacity: 0,
      }),
    ]),
  ],

  timeline: seq(
    // ===== Phase 1+2: assembly and type entrance (0.0 – 1.8s) =========
    par(
      // Ambient glow breathes in under everything
      tween("glow", { opacity: 0.07 }, { duration: 1.2, ease: "easeOutQuad" }),

      // Ring: decelerating pop with a soft overshoot (0.0 – 0.75s)
      seq(
        par(
          tween("ring", { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween("ring", { scale: 1.08 }, { duration: 0.5, ease: "easeOutCubic" }),
        ),
        tween("ring", { scale: 1 }, { duration: 0.25, ease: "easeInOutQuad" }),
      ),

      // Core diamond: spins 180° while scaling in, settles (0.25 – 1.15s)
      seq(
        wait(0.25),
        par(
          tween("core", { opacity: 1 }, { duration: 0.2, ease: "easeOutQuad" }),
          tween("core", { scale: 1.12, rotation: 45 }, { duration: 0.65, ease: "easeOutQuart" }),
        ),
        tween("core", { scale: 1 }, { duration: 0.25, ease: "easeInOutQuad" }),
      ),

      // Spark: rises from the ring's heart to its perch (0.55 – 1.05s)
      seq(
        wait(0.55),
        par(
          tween("spark", { opacity: 1 }, { duration: 0.2, ease: "easeOutQuad" }),
          tween("spark", { y: -152, scale: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
        ),
      ),

      // Wordmark: rises from below while fading in (1.0 – 1.8s)
      seq(
        wait(1.0),
        par(
          tween("wordmark", { y: 96 }, { duration: 0.8, ease: "easeOutCubic" }),
          tween("wordmark", { opacity: 1 }, { duration: 0.6, ease: "easeOutQuad" }),
        ),
      ),

      // Tagline: follows 0.2s later (1.2 – 1.8s)
      seq(
        wait(1.2),
        par(
          tween("tagline", { y: 196 }, { duration: 0.6, ease: "easeOutCubic" }),
          tween("tagline", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // ===== Phase 3: hold the full lockup (1.8 – 4.2s) ==================
    wait(2.4),

    // ===== Phase 4: scale up slightly and fade out (4.2 – 5.0s) ========
    par(
      tween("lockup", { scale: 1.07 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("lockup", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // Gentle continuous float on the mark so the hold stays alive
    oscillate("mark", "y", { amplitude: 6, frequency: 0.25 }),
    // Barely-there breathing rotation on the core diamond
    oscillate("core", "rotation", { amplitude: 2, frequency: 0.15 }),
  ],
});
