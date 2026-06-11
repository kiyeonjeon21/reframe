import { scene, rect, text, seq, par, tween, wait } from "@reframe/core";

// ---------------------------------------------------------------------------
// Scene-to-scene wipe transition
//
// Layer stack (bottom -> top):
//   bg-b     : slide B background, full frame, static underneath everything
//   title-b  : slide B title (revealed once the wipe edge has passed it)
//   cover-a  : slide A background, anchored to the RIGHT edge; its width
//              shrinks 1920 -> 0, so its left edge IS the wipe seam
//   title-a  : slide A title (swept out just as the bar reaches it)
//   bar      : the #FF5C39 accent bar, always covering the seam
//
// Seam coherence: both the bar (x: -140 -> 1920 over 2060px) and the cover
// (width: 1920 -> 0) animate over the same 1.0s with the same ease, so at
// eased progress p the seam sits at 1920p while the bar spans
// [2060p - 140, 2060p]. Since 1920p is always inside that span for p in
// [0, 1], the seam is hidden under the bar for the entire sweep — content
// changes strictly behind the leading edge, with no flash or visible joint.
// ---------------------------------------------------------------------------

const W = 1920;
const H = 1080;
const BAR_W = 140;

export default scene({
  id: "wipe-transition",
  size: { width: W, height: H },
  fps: 30,
  background: "#101014",
  nodes: [
    // --- Slide B (bottom layers) ---------------------------------------
    rect({
      id: "bg-b",
      x: 0,
      y: 0,
      width: W,
      height: H,
      fill: "#1F4032",
    }),
    text({
      id: "title-b",
      x: 960,
      y: 586,
      anchor: "center",
      content: "THE SOLUTION",
      fontFamily: "Inter",
      fontSize: 118,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 10,
      opacity: 0,
    }),

    // --- Slide A (covers slide B; right-anchored so the left edge wipes) -
    rect({
      id: "cover-a",
      x: W,
      y: 0,
      width: W,
      height: H,
      anchor: "top-right",
      fill: "#14324F",
    }),
    text({
      id: "title-a",
      x: 960,
      y: 578,
      anchor: "center",
      content: "THE PROBLEM",
      fontFamily: "Inter",
      fontSize: 118,
      fontWeight: 800,
      fill: "#FFFFFF",
      letterSpacing: 10,
      opacity: 0,
    }),

    // --- Accent bar (topmost, rides the seam) ---------------------------
    rect({
      id: "bar",
      x: -BAR_W,
      y: 0,
      width: BAR_W,
      height: H,
      fill: "#FF5C39",
    }),
  ],

  timeline: seq(
    // 0.0 – 0.4s : slide A title settles in (rise + fade, tiny settle)
    par(
      tween("title-a", { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
      seq(
        tween("title-a", { y: 535 }, { duration: 0.3, ease: "easeOutCubic" }),
        tween("title-a", { y: 540 }, { duration: 0.1, ease: "easeInOutQuad" }),
      ),
    ),

    // 0.4 – 1.2s : slide A holds
    wait(0.8),

    // 1.2 – 2.25s : the wipe
    par(
      // Bar sweeps the full frame — fast through the middle.
      tween("bar", { x: W }, { duration: 1.0, ease: "easeInOutQuart" }),
      // Slide A cover collapses in lockstep; its left edge stays under the bar.
      tween("cover-a", { width: 0 }, { duration: 1.0, ease: "easeInOutQuart" }),

      // Slide A title is swept out right as the bar's leading edge reaches it
      // (leading edge hits the title block at ~1.62s; the title is gone by 1.6s).
      seq(
        wait(0.15),
        par(
          tween("title-a", { opacity: 0 }, { duration: 0.25, ease: "easeInQuad" }),
          tween("title-a", { x: 1036 }, { duration: 0.25, ease: "easeInCubic" }),
        ),
      ),

      // Slide B title lands only after the bar has cleared center (~1.7s),
      // settling just as the bar exits the right edge (~2.2s).
      seq(
        wait(0.55),
        par(
          tween("title-b", { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween("title-b", { y: 534 }, { duration: 0.35, ease: "easeOutCubic" }),
        ),
        tween("title-b", { y: 540 }, { duration: 0.15, ease: "easeInOutQuad" }),
      ),
    ),

    // 2.25 – 4.0s : slide B holds
    wait(1.75),
  ),
});
