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

// NOVA — logo reveal sting
// 1920x1080 @ 30fps, 5.0s total.
//
// Structure:
//   lockup (full composition, scaled/faded for the outro)
//   └─ mark   (ring + diamond + core dot; floats during the hold)
//   └─ wordmark "NOVA"
//   └─ tagline  "light the way"
//
// Timing map:
//   0.00–1.20  mark assembles (ring → diamond → core, overlapping)
//   1.00–1.80  wordmark rises in
//   1.20–2.00  tagline follows
//   2.00–4.20  hold (mark floats gently)
//   4.20–5.00  lockup scales up slightly and fades out

const PURPLE = "#7C5CFF";
const WHITE = "#FFFFFF";
const MUTED = "#878D99";

export default scene({
  id: "nova-logo-reveal",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#08090B",

  nodes: [
    group({ id: "lockup", x: 960, y: 540, anchor: "center" }, [
      // ----- Mark: purple ring, white diamond, purple core dot -----
      group({ id: "mark", x: 0, y: -170, anchor: "center" }, [
        ellipse({
          id: "ring",
          x: 0,
          y: 0,
          width: 224,
          height: 224,
          anchor: "center",
          stroke: PURPLE,
          strokeWidth: 14,
        }),
        rect({
          id: "diamond",
          x: 0,
          y: 0,
          width: 96,
          height: 96,
          anchor: "center",
          fill: WHITE,
          radius: 12,
          rotation: 45,
        }),
        ellipse({
          id: "core",
          x: 0,
          y: 0,
          width: 26,
          height: 26,
          anchor: "center",
          fill: PURPLE,
        }),
      ]),

      // ----- Wordmark -----
      text({
        id: "wordmark",
        x: 14, // optical correction for trailing letter-spacing
        y: 100,
        anchor: "center",
        content: "NOVA",
        fontFamily: "Inter",
        fontSize: 148,
        fontWeight: 800,
        fill: WHITE,
        letterSpacing: 28,
      }),

      // ----- Tagline -----
      text({
        id: "tagline",
        x: 5,
        y: 196,
        anchor: "center",
        content: "light the way",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 400,
        fill: MUTED,
        letterSpacing: 10,
      }),
    ]),
  ],

  states: {
    hidden: {
      ring: { opacity: 0, scale: 0.4, rotation: -120 },
      diamond: { opacity: 0, scale: 0, rotation: 225 },
      core: { opacity: 0, scale: 0 },
      wordmark: { opacity: 0, y: 144 },
      tagline: { opacity: 0, y: 226 },
    },
  },
  initial: "hidden",

  timeline: seq(
    // ---------- 0.0–2.0s: build the lockup (overlapping entrances) ----------
    par(
      // Ring: scale in while its rotation settles to 0, slight overshoot.
      seq(
        par(
          tween("ring", { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween(
            "ring",
            { scale: 1.08, rotation: 0 },
            { duration: 0.6, ease: "easeOutQuart" },
          ),
        ),
        tween("ring", { scale: 1 }, { duration: 0.22, ease: "easeInOutQuad" }),
      ),

      // Diamond: arrives a beat later, unwinding half a turn into place.
      seq(
        wait(0.22),
        par(
          tween("diamond", { opacity: 1 }, { duration: 0.2, ease: "easeOutQuad" }),
          tween(
            "diamond",
            { scale: 1.12, rotation: 45 },
            { duration: 0.56, ease: "easeOutQuart" },
          ),
        ),
        tween("diamond", { scale: 1 }, { duration: 0.18, ease: "easeInOutQuad" }),
      ),

      // Core dot: final punctuation of the mark, pops with overshoot.
      seq(
        wait(0.58),
        par(
          tween("core", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween("core", { scale: 1.45 }, { duration: 0.32, ease: "easeOutCubic" }),
        ),
        tween("core", { scale: 1 }, { duration: 0.16, ease: "easeInOutQuad" }),
      ),

      // Wordmark: 1.0–1.8s, rises from below while fading in.
      seq(
        wait(1.0),
        par(
          tween("wordmark", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
          tween("wordmark", { y: 100 }, { duration: 0.8, ease: "easeOutQuart" }),
        ),
      ),

      // Tagline: follows 0.2s later (1.2–2.0s).
      seq(
        wait(1.2),
        par(
          tween("tagline", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
          tween("tagline", { y: 196 }, { duration: 0.8, ease: "easeOutQuart" }),
        ),
      ),
    ),

    // ---------- 2.0–4.2s: hold (mark floats via behaviors) ----------
    wait(2.2),

    // ---------- 4.2–5.0s: scale up slightly and fade out ----------
    par(
      tween("lockup", { scale: 1.07 }, { duration: 0.8, ease: "easeInCubic" }),
      tween("lockup", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // Slow, small vertical float on the mark to keep the hold alive.
    oscillate("mark", "y", { amplitude: 6, frequency: 0.28, phase: 0 }),
    // Barely-there counter-drift on the core for organic depth.
    oscillate("core", "y", { amplitude: 2, frequency: 0.28, phase: 3.14 }),
  ],
});
