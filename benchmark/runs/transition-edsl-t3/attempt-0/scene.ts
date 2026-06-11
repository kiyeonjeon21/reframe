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
// 1920x1080 @ 30fps, 4.0s total
//
// Mechanics: the accent bar (140px wide) sweeps left-to-right from
// x = -140 to x = 1850 over 1.0s. Slide B's background is a full-frame
// rect whose x is locked to the bar with a constant offset
// (slideB.x = bar.x - 1850, identical 1990px delta, identical duration
// and ease), so slide B's leading edge always sits exactly 70px inside
// the bar — content changes behind the bar with zero seam, by
// construction. Once slide B fully covers the frame (bar flush against
// the right edge), the bar releases and exits alone while slide B's
// title lands.
// ---------------------------------------------------------------------------

const ACCENT = "#FF5C39";
const SWEEP_EASE = "easeInOutQuart" as const; // fast through the middle

export default scene({
  id: "wipe-transition",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    // --- Slide A (bottom layer; gets covered by slide B's wipe) ---------
    group({ id: "slideA", x: 0, y: 0 }, [
      rect({
        id: "bgA",
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        fill: "#14324F",
      }),
      text({
        id: "titleA",
        x: 960,
        y: 564, // settles up to 540
        anchor: "center",
        content: "THE PROBLEM",
        fontFamily: "Inter",
        fontSize: 132,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 10,
        opacity: 0,
      }),
      line({
        id: "ruleA",
        x1: 850,
        y1: 634,
        x2: 1070,
        y2: 634,
        stroke: ACCENT,
        strokeWidth: 5,
        progress: 0,
      }),
    ]),

    // --- Slide B background: slides in, edge locked under the bar -------
    rect({
      id: "slideB-bg",
      x: -1990, // = bar.x - 1850 at all times during the sweep
      y: 0,
      width: 1920,
      height: 1080,
      fill: "#1F4032",
    }),

    // --- Slide B content: fixed in place, lands after the bar passes ----
    text({
      id: "titleB",
      x: 960,
      y: 566, // settles up to 540
      anchor: "center",
      content: "THE SOLUTION",
      fontFamily: "Inter",
      fontSize: 132,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 10,
      opacity: 0,
    }),
    line({
      id: "ruleB",
      x1: 850,
      y1: 634,
      x2: 1070,
      y2: 634,
      stroke: ACCENT,
      strokeWidth: 5,
      progress: 0,
    }),

    // --- Accent bar: topmost, leads the wipe ----------------------------
    rect({
      id: "bar",
      x: -140, // fully off-screen left
      y: 0,
      width: 140,
      height: 1080,
      fill: ACCENT,
    }),
  ],

  timeline: seq(
    // 0.0 - 0.5s : slide A title settles in
    par(
      tween("titleA", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
      tween("titleA", { y: 540 }, { duration: 0.4, ease: "easeOutCubic" }),
      seq(
        wait(0.15),
        tween("ruleA", { progress: 1 }, { duration: 0.35, ease: "easeOutCubic" }),
      ),
    ),

    // 0.5 - 1.2s : slide A holds
    wait(0.7),

    // 1.2 - 2.7s : the wipe
    par(
      // 1.2 - 2.2s : bar sweeps; slide B background is hard-locked to it
      // (same 1990px travel, same duration, same ease => no seam ever)
      tween("bar", { x: 1850 }, { duration: 1.0, ease: SWEEP_EASE }),
      tween("slideB-bg", { x: 0 }, { duration: 1.0, ease: SWEEP_EASE }),

      // 2.2 - 2.5s : slide B now fully covers the frame; the bar releases
      // and clears the right edge on its own
      seq(
        wait(1.0),
        tween("bar", { x: 1990 }, { duration: 0.3, ease: "easeInOutCubic" }),
      ),

      // 1.88s+ : slide B title lands (bar passed center ~1.70s; the green
      // field already covers the whole title zone before this starts)
      seq(
        wait(0.68),
        par(
          tween("titleB", { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
          tween("titleB", { y: 540 }, { duration: 0.5, ease: "easeOutCubic" }),
        ),
      ),

      // 2.3 - 2.7s : underline draws on as the bar clears
      seq(
        wait(1.1),
        tween("ruleB", { progress: 1 }, { duration: 0.4, ease: "easeOutCubic" }),
      ),
    ),

    // 2.7 - 4.0s : slide B holds
    wait(1.3),
  ),
});
