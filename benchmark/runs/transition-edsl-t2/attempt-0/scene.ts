import {
  scene,
  group,
  rect,
  line,
  text,
  seq,
  par,
  tween,
  wait,
} from "@reframe/core";

// ---------------------------------------------------------------------------
// Scene-to-scene wipe transition
// 1920x1080 @ 30fps, 4.0s total.
//
// Mechanics: slide B is a full-frame rect whose width grows from the left
// edge, tracking the trailing edge of the sweeping accent bar. The bar's
// left edge animates -140 -> 1920 while B's reveal width animates 0 -> 1920
// with the *same duration and ease*, so the seam (B's right edge) always
// sits inside the bar's 140px span: bar.x - width = -140 * (1 - p), i.e.
// the bar covers the cut for the entire sweep. No flash frames, no seams.
//
// Timeline:
//   0.00 - 0.40  slide A title settles in
//   0.40 - 1.20  slide A holds
//   1.20 - 2.20  bar sweeps L->R (easeInOutQuart: fast through the middle),
//                slide B revealed behind it
//   1.95 - 2.45  slide B title lands with a small settle as the bar clears
//   2.45 - 4.00  slide B holds
// ---------------------------------------------------------------------------

const W = 1920;
const H = 1080;
const BAR_W = 140;
const SWEEP_EASE = "easeInOutQuart" as const;

export default scene({
  id: "wipe-transition",
  size: { width: W, height: H },
  fps: 30,
  background: "#101014",
  nodes: [
    // -- Slide A -------------------------------------------------------------
    rect({ id: "bg-a", x: 0, y: 0, width: W, height: H, fill: "#14324F" }),
    text({
      id: "title-a",
      x: 960,
      y: 562,
      anchor: "center",
      content: "THE PROBLEM",
      fontFamily: "Inter",
      fontSize: 124,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 10,
      opacity: 0,
    }),
    line({
      id: "rule-a",
      x1: 822,
      y1: 642,
      x2: 1098,
      y2: 642,
      stroke: "#FF5C39",
      strokeWidth: 6,
      progress: 0,
    }),

    // -- Slide B (revealed by growing width behind the bar) -------------------
    rect({ id: "bg-b", x: 0, y: 0, width: 0, height: H, fill: "#1F4032" }),
    text({
      id: "title-b",
      x: 960,
      y: 572,
      anchor: "center",
      content: "THE SOLUTION",
      fontFamily: "Inter",
      fontSize: 124,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 10,
      opacity: 0,
      scale: 0.97,
    }),
    line({
      id: "rule-b",
      x1: 822,
      y1: 642,
      x2: 1098,
      y2: 642,
      stroke: "#FF5C39",
      strokeWidth: 6,
      progress: 0,
    }),

    // -- Accent wipe bar (drawn on top of everything) --------------------------
    group({ id: "bar", x: -BAR_W, y: 0 }, [
      rect({ id: "bar-body", x: 0, y: 0, width: BAR_W, height: H, fill: "#FF5C39" }),
      // thin highlight on the leading edge for a machined, confident feel
      rect({ id: "bar-edge", x: BAR_W - 8, y: 0, width: 8, height: H, fill: "#FF8A66" }),
    ]),
  ],

  timeline: seq(
    // 1) Slide A title settles in (0.0 - 0.4s)
    par(
      tween("title-a", { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
      tween("title-a", { y: 540 }, { duration: 0.4, ease: "easeOutCubic" }),
      seq(
        wait(0.1),
        tween("rule-a", { progress: 1 }, { duration: 0.3, ease: "easeOutCubic" }),
      ),
    ),

    // 2) Slide A holds (0.4 - 1.2s)
    wait(0.8),

    // 3) The wipe (1.2 - 2.2s) + slide B title landing (1.95 - 2.45s)
    par(
      // bar sweeps fully across: left edge -140 -> 1920
      tween("bar", { x: W }, { duration: 1.0, ease: SWEEP_EASE }),
      // slide B reveal tracks the bar's trailing edge (same duration + ease)
      tween("bg-b", { width: W }, { duration: 1.0, ease: SWEEP_EASE }),
      // title B appears only after the bar has passed center (~1.73s),
      // landing with a small settle as the bar clears the right edge
      seq(
        wait(0.75),
        par(
          tween("title-b", { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween("title-b", { y: 540 }, { duration: 0.4, ease: "easeOutCubic" }),
          tween("title-b", { scale: 1.02 }, { duration: 0.35, ease: "easeOutCubic" }),
          seq(
            wait(0.12),
            tween("rule-b", { progress: 1 }, { duration: 0.28, ease: "easeOutCubic" }),
          ),
        ),
        tween("title-b", { scale: 1 }, { duration: 0.1, ease: "easeInOutQuad" }),
      ),
    ),

    // 4) Slide B holds to the 4.0s mark (2.45 - 4.0s)
    wait(1.55),
  ),
});
