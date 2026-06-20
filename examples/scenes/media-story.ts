import { scene, photoMontage, title, lowerThird, par, beat } from "@reframe/core";

// Media-first story: a montage of stills + a video clip, with a kinetic title
// opener and a lower-third strap overlaid, plus a music bed. This is what
// `reframe assemble <media...>` scaffolds — here hand-authored to also show the
// `lowerThird` generator and a mid-roll caption. Mixed media, any aspect (cover),
// seeded Ken Burns, cinematic grade — all deterministic.

const W = 1920, H = 1080;

const m = photoMontage(
  [
    { src: "photo-montage/01.jpg", hold: 3.2 },
    { src: "photo-montage/02.jpg", hold: 3.2 },
    { src: "video-demo/clip.mp4", hold: 4.0 }, // a real clip, plays for its hold
    { src: "photo-montage/04.jpg", hold: 3.2 },
  ],
  { id: "shot", size: { width: W, height: H }, transition: 0.6, zoom: 1.16, seed: 7 },
);

// a kinetic title that plays in over the first shot, then dissolves out
const ttl = title({ text: "OUR YEAR", id: "ttl", x: W / 2, y: H / 2, fontSize: 132, letterSpacing: 6, entrance: "rise", exit: "dissolve", hold: 1.6, speed: 1.1 });

// a name/role strap that appears over the video clip
const lt = lowerThird({ name: "Nantes, France", role: "spring 2026", id: "lt", x: 130, y: 880, accent: "#FF4D00", hold: 2.8 });

export default scene({
  id: "media-story",
  size: { width: W, height: H },
  fps: 30,
  background: "#000000",
  nodes: [...m.nodes, ...ttl.nodes, ...lt.nodes],
  timeline: par(
    m.timeline,
    ttl.timeline,
    // anchored to the clip's shot label — if the montage is retimed (here or via an
    // overlay), the strap follows `shot-2` instead of drifting to a fixed time.
    beat("lt-anchor", { at: "shot-2" }, [lt.timeline]),
  ),
  audio: {
    bgm: { synth: "uplift", gain: 0.2, fadeIn: 1.4, fadeOut: 2.2 },
  },
});
