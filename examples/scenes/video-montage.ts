// videoMontage: photos and a video clip in one auto-edited cut — crossfades +
// seeded Ken Burns + grade, the clip shots playing (with their audio) in sequence.
// Reuses the photo-montage stills + the video-demo clip. mp4 only (image/video
// sources don't render in player/artifacts).

import {
  scene, text,
  seq, par, tween, wait,
  videoMontage, splitText, textIn, textOut,
} from "@reframe/core";

const W = 1920, H = 1080;

const m = videoMontage(
  [
    "photo-montage/01.jpg",
    { src: "video-demo/clip.mp4", volume: 0.7 }, // a clip shot, with its audio
    "photo-montage/03.jpg",
    { src: "video-demo/clip.mp4", volume: 0.7 },
    "photo-montage/06.jpg",
  ],
  { id: "shot", size: { width: W, height: H }, hold: 3.0, transition: 0.6, zoom: 1.14, seed: 11 },
);

const title = splitText("MIXED CUT", { id: "title", x: W / 2, y: H / 2, fontSize: 132, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 4 });

export default scene({
  id: "video-montage",
  size: { width: W, height: H },
  fps: 30,
  background: "#05060C",
  nodes: [
    ...m.nodes,
    ...title.nodes,
    text({ id: "tag", x: W / 2, y: H / 2 + 56, anchor: "center", content: "stills and clips, one timeline", fontFamily: "Inter", fontSize: 28, fontWeight: 400, fill: "#C9CEDA", letterSpacing: 4, opacity: 0 }),
  ],

  timeline: par(
    m.timeline,
    seq(
      wait(0.6),
      textIn("rise", title, { label: "title-in" }),
      tween("tag", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "tag-in" }),
      wait(1.4),
      par(
        textOut("dissolve", title, { label: "title-out" }),
        tween("tag", { opacity: 0 }, { duration: 0.5, ease: "easeInCubic" }),
      ),
    ),
  ),
});
