// Track mattes: a video-filled headline (alpha matte — the clip shows only inside
// the letters) crossfading to an iris luma wipe (a soft radial reveals a photo).
// A matte group's FIRST child masks the rest. Reuses video-demo/clip.mp4 and a
// photo-montage still. mp4 only (image/video sources).

import {
  scene, group, text, ellipse, video, image,
  seq, par, tween, wait, radialGradient,
} from "@reframe/core";

const W = 1920, H = 1080;

export default scene({
  id: "matte-demo",
  size: { width: W, height: H },
  fps: 30,
  background: "#05060C",
  nodes: [
    // A — alpha matte: "REFRAME" cut out of the video clip (group centered → push-in scales about the middle)
    group({ id: "A", x: W / 2, y: H / 2, anchor: "center", matte: "alpha" }, [
      text({ id: "A-mask", x: 0, y: 0, anchor: "center", content: "REFRAME", fontFamily: "Inter", fontSize: 300, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 2 }),
      video({ id: "A-clip", src: "video-demo/clip.mp4", x: 0, y: 0, width: W, height: H, anchor: "center", fit: "cover" }),
    ]),
    // B — luma matte: a soft radial iris reveals a photo (starts hidden)
    group({ id: "B", x: W / 2, y: H / 2, anchor: "center", matte: "luma", opacity: 0 }, [
      ellipse({ id: "B-mask", x: 0, y: 0, width: 240, height: 240, anchor: "center", fill: radialGradient(["#FFFFFF", "#000000"], { r: 0.5 }) }),
      image({ id: "B-photo", src: "photo-montage/06.jpg", x: 0, y: 0, width: W, height: H, anchor: "center", fit: "cover" }),
    ]),
  ],

  timeline: seq(
    // hold the video-text while the clip plays, with a gentle push-in
    tween("A", { scale: 1.06 }, { duration: 3.2, ease: "easeInOutQuad", label: "a-zoom" }),
    // crossfade to the iris wipe; grow the soft circle to reveal the photo
    par(
      tween("A", { opacity: 0 }, { duration: 0.8, ease: "easeInOutCubic", label: "a-out" }),
      tween("B", { opacity: 1 }, { duration: 0.8, ease: "easeInOutCubic", label: "b-in" }),
      tween("B-mask", { scale: 9 }, { duration: 2.4, ease: "easeOutCubic", label: "iris" }),
    ),
    wait(1.0),
  ),
});
