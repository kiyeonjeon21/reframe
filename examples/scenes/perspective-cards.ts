// Projected 2.5D perspective: depth (`z`) + 3D tilt (`rotateX`/`rotateY`), turned on by
// `camera.perspective`. All math is a pure step in evaluate() that projects down to the
// existing 2D affine — the Canvas renderer is untouched, renders stay deterministic.
// Four beats: a parallax depth field (cards at increasing z; the camera pans so near
// cards slide more than far ones and all converge to the optical centre), a hero CARD
// FLIP (rotateY 0→180), perspective TEXT (glyphs given increasing z so the word recedes),
// and a DOLLY (animate camera.perspective to flatten the field). mp4 + live in player.

import {
  scene, group, rect, text,
  seq, par, stagger, tween, wait, cameraTo, splitText, textIn,
  linearGradient,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0B0E18", FG = "#EAF0FF", DIM = "#7E88A8";

// parallax field — 5 cards at increasing depth, fanned across, each its own hue
const DEPTHS = [0, 170, 340, 510, 680];
const HUES = ["#6EA8FF", "#8C7BFF", "#54D6C0", "#FF8FB0", "#FFC861"];
const field: NodeIR[] = DEPTHS.map((z, i) =>
  rect({
    id: `card-${i}`,
    x: 470 + i * 245,
    y: 560,
    width: 230,
    height: 320,
    radius: 22,
    anchor: "center",
    fill: linearGradient([HUES[i]!, "#1A2030"], { angle: 120 }),
    z,
    opacity: 0,
    scale: 0.9,
  }),
);

// perspective title — split "DEPTH", give each glyph an increasing z so the word recedes
const title = splitText("DEPTH", { id: "title", x: 960, y: 235, fontSize: 150, fontWeight: 800, fill: FG });
title.nodes.forEach((n, i) => {
  (n.props as { z?: number }).z = i * 130; // left glyph near, right glyph far
});

export default scene({
  id: "perspective-cards",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, perspective: 900 },
  nodes: [
    ...title.nodes,
    ...field,
    // hero card that flips in 3D (rotateY)
    rect({ id: "hero", x: 960, y: 770, width: 300, height: 200, radius: 24, anchor: "center", fill: linearGradient(["#FF5C7A", "#FF9A3D"], { angle: 90 }), rotateY: 0, opacity: 0 }),
    text({ id: "hero-t", x: 960, y: 770, anchor: "center", content: "FLIP", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#140A0A", opacity: 0 }),
    text({ id: "cap", x: 960, y: 1000, anchor: "center", content: "DEPTH · PARALLAX · DOLLY · projected, not rendered in 3D", fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: DIM, letterSpacing: 4, opacity: 0 }),
  ],

  timeline: seq(
    // 1. the depth field rises in, near-to-far
    par(
      stagger(0.08, ...field.map((n) => tween(n.id, { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack" }))),
      textIn("rise", title, { speed: 1.1 }),
    ),
    wait(0.3),
    // 2. camera pans — parallax: near cards slide further than far ones
    cameraTo({ x: W / 2 + 220 }, { duration: 2.0, ease: "easeInOutCubic", label: "pan" }),
    // 3. hero card flips in 3D
    par(
      seq(
        tween("hero", { opacity: 1 }, { duration: 0.01 }),
        tween("hero", { rotateY: 360 }, { duration: 1.4, ease: "easeInOutCubic", label: "flip" }),
      ),
      seq(wait(0.7), tween("hero-t", { opacity: 1 }, { duration: 0.4 })),
      seq(wait(0.4), tween("cap", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
    ),
    wait(0.3),
    // 4. dolly: pull the focal length out to flatten the depth field
    cameraTo({ perspective: 2600 }, { duration: 1.8, ease: "easeInOutCubic", label: "dolly" }),
    wait(0.6),
  ),
});
