// Photo montage: six CC0 travel photos auto-composed by `photoMontage` —
// crossfades + seeded Ken Burns + a cinematic grade (vignette + bottom scrim,
// built from gradients + blend modes) — with kinetic chapter titles overlaid as
// independent parallel tracks. The "drop in photos, get a polished cut" demo.
// Images: examples/scenes/photo-montage/{01..06}.jpg (CC0, see LICENSE.md).

import {
  scene, text, seq, par, tween, wait,
  photoMontage, splitText, textIn, textOut,
} from "@reframe/core";

const W = 1920, H = 1080;

const m = photoMontage(
  ["01.jpg", "02.jpg", "03.jpg", "04.jpg", "05.jpg", "06.jpg"].map((f) => `photo-montage/${f}`),
  { id: "shot", size: { width: W, height: H }, hold: 3.4, transition: 0.7, zoom: 1.16, seed: 7 },
);

// kinetic chapter titles (each splitText returns its glyph nodes; textIn/textOut the timing)
const t1 = splitText("WANDER", { id: "t1", x: W / 2, y: 560, fontSize: 168, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 6 });
const t2 = splitText("EVERY FRAME", { id: "t2", x: W / 2, y: 560, fontSize: 116, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 4 });
const brand = splitText("reframe", { id: "brand", x: W / 2, y: 500, fontSize: 132, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 2 });

export default scene({
  id: "photo-montage",
  size: { width: W, height: H },
  fps: 30,
  background: "#05060C",
  nodes: [
    ...m.nodes,
    ...t1.nodes,
    ...t2.nodes,
    ...brand.nodes,
    text({ id: "tagline", x: W / 2, y: 596, anchor: "center", content: "a shot list, rendered in code", fontFamily: "Inter", fontSize: 30, fontWeight: 400, fill: "#C9CEDA", letterSpacing: 4, opacity: 0 }),
  ],

  // the montage runs full length; each title is its own overlay track gated by a wait
  timeline: par(
    m.timeline,
    seq(wait(0.7), textIn("rise", t1, { label: "t1-in" }), wait(1.7), textOut("dissolve", t1, { label: "t1-out" })),
    seq(wait(10.4), textIn("cascade", t2, { label: "t2-in" }), wait(1.7), textOut("fly", t2, { label: "t2-out" })),
    seq(
      wait(17.2),
      par(
        textIn("assemble", brand, { label: "brand-in" }),
        seq(wait(0.8), tween("tagline", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "tag-in" })),
      ),
    ),
  ),
});
