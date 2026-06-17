// Video source node: a clip played as a layer (extracted to frames at the scene
// fps, drawn at frame round(t*fps)), framed with fit:"cover", a slow push-in (the
// node transform composes with playback), a vignette + scrim grade, and a kinetic
// title. Visual-only in v1. Clip: video-demo/clip.mp4 (procedural, see LICENSE.md).

import {
  scene, rect, text, video,
  seq, par, tween, wait,
  linearGradient, radialGradient, splitText, textIn,
  type ColorStop,
} from "@reframe/core";

const W = 1280, H = 720;

const title = splitText("reframe", { id: "title", x: W / 2, y: H / 2 - 18, fontSize: 104, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 2 });

export default scene({
  id: "video-demo",
  size: { width: W, height: H },
  fps: 30,
  background: "#05060C",
  nodes: [
    // the clip, full-frame, cover-fit, anchored center so the push-in scales about the middle
    video({ id: "clip", src: "video-demo/clip.mp4", x: W / 2, y: H / 2, width: W, height: H, anchor: "center", fit: "cover", scale: 1.0 }),

    // grade: vignette (multiply) + bottom scrim for title legibility
    rect({ id: "vignette", x: 0, y: 0, width: W, height: H, blend: "multiply",
      fill: radialGradient([{ offset: 0.5, color: "#FFFFFF" }, { offset: 1, color: "#5E5E5E" }] as ColorStop[], { cx: 0.5, cy: 0.5, r: 0.72 }) }),
    rect({ id: "scrim", x: 0, y: 0, width: W, height: H,
      fill: linearGradient([{ offset: 0, color: "#00000000" }, { offset: 0.55, color: "#00000000" }, { offset: 1, color: "#000000A6" }] as ColorStop[], { angle: 90 }) }),

    ...title.nodes,
    text({ id: "tag", x: W / 2, y: H / 2 + 52, anchor: "center", content: "any clip, as a layer", fontFamily: "Inter", fontSize: 26, fontWeight: 400, fill: "#C9CEDA", letterSpacing: 4, opacity: 0 }),
  ],

  timeline: par(
    // slow push-in on the clip (transform composes with playback)
    tween("clip", { scale: 1.08 }, { duration: 5, ease: "easeInOutQuad", label: "push" }),
    seq(
      wait(0.5),
      textIn("assemble", title, { label: "title-in" }),
      tween("tag", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "tag-in" }),
      wait(2.6),
    ),
  ),
});
