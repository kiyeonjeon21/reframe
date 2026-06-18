// reframe sizzle reel — a distribution piece ("output = marketing"). Five crossfaded
// beats, each showing a recently-shipped capability under one design system:
//   1 title   — kinetic wordmark rising in depth (perspective + splitText)
//   2 depth   — perspective card fan + per-glyph receding text (projected 2.5D)
//   3 matte   — alpha-matte gradient-filled wordmark (track matte)
//   4 glow    — a cluster composited as one screen layer + bloom (group effects)
//   5 end     — the thesis + the npm name
// Pure/deterministic, renders to one mp4 via `reframe render`. No external assets.

import {
  composition, scene, group, rect, ellipse, text,
  seq, par, stagger, tween, wait, oscillate, cameraTo,
  splitText, textIn, linearGradient, radialGradient,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#06070C";
const INK = "#ECF1FF";
const DIM = "#6B7390";
const A1 = "#5B8CFF"; // accent blue
const A2 = "#A06BFF"; // accent violet

const cap = (s: string, opacity = 0): NodeIR =>
  text({ id: "cap", x: W / 2, y: 980, anchor: "center", content: s, fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: DIM, letterSpacing: 6, opacity });

// ───────────────────────────────────────────── 1. title
const titleWord = splitText("reframe", { id: "tw", x: W / 2, y: H / 2, fontSize: 240, fontWeight: 800, fill: INK });
const titleScene = scene({
  id: "reel-title",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, perspective: 1300 },
  nodes: [
    ...titleWord.nodes,
    text({ id: "kick", x: W / 2, y: H / 2 + 150, anchor: "center", content: "MOTION GRAPHICS AS DATA", fontFamily: "Inter", fontSize: 28, fontWeight: 600, fill: A1, letterSpacing: 12, opacity: 0 }),
  ],
  timeline: seq(
    par(
      textIn("rise", titleWord, { speed: 1.1 }),
      cameraTo({ perspective: 2400 }, { duration: 1.8, ease: "easeOutExpo", label: "settle" }),
    ),
    par(
      tween("kick", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "kick" }),
      cameraTo({ zoom: 1.04 }, { duration: 1.4, ease: "easeInOutCubic" }),
    ),
    wait(0.6),
  ),
});

// ───────────────────────────────────────────── 2. depth (projected 2.5D)
const DEPTHS = [0, 170, 340, 510, 680];
const HUES = [A1, A2, "#54D6C0", "#FF8FB0", "#FFC861"];
const cards: NodeIR[] = DEPTHS.map((z, i) =>
  rect({ id: `c${i}`, x: 470 + i * 245, y: 560, width: 230, height: 320, radius: 22, anchor: "center", fill: linearGradient([HUES[i]!, "#10131F"], { angle: 120 }), z, opacity: 0, scale: 0.9 }),
);
const depthWord = splitText("DEPTH", { id: "dw", x: W / 2, y: 250, fontSize: 140, fontWeight: 800, fill: INK });
depthWord.nodes.forEach((n, i) => { (n.props as { z?: number }).z = i * 130; });
const depthScene = scene({
  id: "reel-depth",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, perspective: 900 },
  nodes: [...depthWord.nodes, ...cards, cap("perspective, projected, not 3D")],
  timeline: seq(
    par(
      stagger(0.07, ...cards.map((n) => tween(n.id, { opacity: 1, scale: 1 }, { duration: 0.55, ease: "easeOutBack" }))),
      textIn("rise", depthWord, { speed: 1.2 }),
    ),
    par(
      cameraTo({ x: W / 2 + 230 }, { duration: 1.9, ease: "easeInOutCubic", label: "pan" }),
      seq(wait(0.2), tween("cap", { opacity: 1 }, { duration: 0.6 })),
    ),
    wait(0.4),
  ),
});

// ───────────────────────────────────────────── 3. matte (gradient-filled wordmark)
const matteScene = scene({
  id: "reel-matte",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "mask", x: 0, y: 0, matte: "alpha" }, [
      text({ id: "maskword", x: W / 2, y: H / 2, anchor: "center", content: "REVEAL", fontFamily: "Inter", fontSize: 300, fontWeight: 800, fill: "#FFFFFF" }),
      rect({ id: "grad", x: W / 2 - 1400, y: H / 2, width: 2600, height: 600, anchor: "center", fill: linearGradient([A1, A2, "#FF6B9D", "#FFC861"], { angle: 0 }) }),
    ]),
    cap("alpha mattes · one layer masks another"),
  ],
  timeline: seq(
    tween("grad", { x: W / 2 + 200 }, { duration: 2.0, ease: "easeInOutQuad", label: "sweep" }),
    par(
      tween("cap", { opacity: 1 }, { duration: 0.6 }),
      tween("grad", { x: W / 2 + 260 }, { duration: 1.0, ease: "easeInOutCubic" }),
    ),
    wait(0.3),
  ),
});

// ───────────────────────────────────────────── 4. glow (group composited as one layer)
const orbs: NodeIR[] = [
  ellipse({ id: "o1", x: -150, y: 0, width: 360, height: 360, anchor: "center", fill: radialGradient(["#5B8CFF", "#5B8CFF00"], { r: 0.5 }) }),
  ellipse({ id: "o2", x: 150, y: -40, width: 360, height: 360, anchor: "center", fill: radialGradient(["#FF6B9D", "#FF6B9D00"], { r: 0.5 }) }),
  ellipse({ id: "o3", x: 30, y: 150, width: 360, height: 360, anchor: "center", fill: radialGradient(["#54D6C0", "#54D6C000"], { r: 0.5 }) }),
];
const glowWord = splitText("LIGHT", { id: "gw", x: W / 2, y: 850, fontSize: 120, fontWeight: 800, fill: INK });
const glowScene = scene({
  id: "reel-glow",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "burst", x: W / 2, y: 430, blend: "screen", blur: 0, opacity: 0 }, orbs),
    ...glowWord.nodes,
    cap("group effects · blur, glow, blend on a whole layer"),
  ],
  timeline: seq(
    par(
      tween("burst", { opacity: 1 }, { duration: 0.7, ease: "easeOutCubic", label: "bloom" }),
      textIn("cascade", glowWord, { speed: 1.2 }),
    ),
    par(
      tween("cap", { opacity: 1 }, { duration: 0.6 }),
      wait(1.4),
    ),
  ),
  behaviors: [
    oscillate("burst", "rotation", { amplitude: 14, frequency: 0.3, phase: 0 }),
    oscillate("burst", "blur", { amplitude: 8, frequency: 0.8, phase: 0 }, { from: 8 }),
  ],
});

// ───────────────────────────────────────────── 5. end card
const endScene = scene({
  id: "reel-end",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, perspective: 1600 },
  nodes: [
    text({ id: "mark", x: W / 2, y: 380, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 180, fontWeight: 800, fill: INK, z: 600, opacity: 0 }),
    text({ id: "l1", x: W / 2, y: 560, anchor: "center", content: "AI writes it. You tweak it.", fontFamily: "Inter", fontSize: 44, fontWeight: 700, fill: INK, opacity: 0 }),
    text({ id: "l2", x: W / 2, y: 628, anchor: "center", content: "It renders the same every time.", fontFamily: "Inter", fontSize: 44, fontWeight: 700, fill: A1, opacity: 0 }),
    rect({ id: "pill", x: W / 2, y: 770, width: 470, height: 78, radius: 39, anchor: "center", fill: "#11141F", stroke: A2, strokeWidth: 1.5, opacity: 0 }),
    text({ id: "npm", x: W / 2, y: 770, anchor: "center", content: "npm i reframe-video", fontFamily: "Inter", fontSize: 32, fontWeight: 600, fill: INK, letterSpacing: 2, opacity: 0 }),
  ],
  timeline: seq(
    par(
      tween("mark", { z: 0, opacity: 1 }, { duration: 1.0, ease: "easeOutExpo", label: "mark" }),
      seq(wait(0.4), stagger(0.12, tween("l1", { opacity: 1 }, { duration: 0.5 }), tween("l2", { opacity: 1 }, { duration: 0.5 }))),
    ),
    par(
      tween("pill", { opacity: 1 }, { duration: 0.5, ease: "easeOutBack", label: "pill" }),
      seq(wait(0.1), tween("npm", { opacity: 1 }, { duration: 0.5 })),
    ),
    wait(1.2),
  ),
});

export default composition({
  id: "reframe-reel",
  scenes: [
    { scene: titleScene },
    { scene: depthScene, transition: "crossfade" },
    { scene: matteScene, transition: "crossfade" },
    { scene: glowScene, transition: "crossfade" },
    { scene: endScene, transition: "crossfade" },
  ],
});
