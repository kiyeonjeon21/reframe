// reframe — a launch film in the high-end kinetic-typography style.
//
// The brief (the kind of prompt that produces this):
//   "reframe launch film, Aside style. Dark/white alternating, oversized bold
//    Inter that overflows the frame, camera pushes, accent only on keywords.
//    Beats: (1) MOTION GRAPHICS (2) used to mean After Effects (3) now it's just
//    code — 'code' accent (4) a code card that renders to mp4 (5) every render,
//    byte-identical (6) sting: globe mark + 'reframe' wordmark. ~19s, 1080p."
//
// Render it WITH the new temporal motion blur for the broadcast look:
//   pnpm reframe render reframe-launch.ts --motion-blur 8 -o out/reframe-launch.mp4
//
// Pure function of time (seeded fx only) → deterministic, golden-safe.

import {
  scene, group, rect, ellipse, text,
  seq, par, beat, tween, wait, cameraTo, oscillate,
  splitText, textIn, textOut, dropShadow, glow,
  type TextBlock,
} from "@reframe/core";

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;

// palette
const CHARCOAL = "#0F0F12";
const WHITE = "#F2F2EF";
const INK = "#141417";       // dark text on white
const GRAY = "#8A8A93";
const ACCENT = "#FF4D00";    // reframe brand accent
const CARD = "#17171B";
const CARDLINE = "#2A2A31";

// ── a centered multi-color line: measure each part, lay them out left→right ────
function coloredLine(
  idp: string, parts: { text: string; fill: string }[],
  y: number, fontSize: number, fontWeight: 400 | 700 | 800 = 800, ls = 0,
): TextBlock[] {
  const widths = parts.map((p) =>
    splitText(p.text, { id: `${idp}-m`, x: 0, y: 0, fontSize, fontWeight, letterSpacing: ls, align: "left" }).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = CX - total / 2;
  return parts.map((p, i) => {
    const b = splitText(p.text, { id: `${idp}-${i}`, x: cx, y, fontSize, fontWeight, fill: p.fill, letterSpacing: ls, align: "left" });
    cx += widths[i]!;
    return b;
  });
}

// ── text blocks ───────────────────────────────────────────────────────────────
const hero = splitText("MOTION GRAPHICS", { id: "hero", x: CX, y: CY, fontSize: 132, fontWeight: 800, fill: WHITE, letterSpacing: 2 });
const aeSmall = splitText("used to mean", { id: "aes", x: CX, y: 360, fontSize: 54, fontWeight: 400, fill: GRAY });
const aeBig = splitText("AFTER EFFECTS", { id: "aeb", x: CX, y: 560, fontSize: 184, fontWeight: 800, fill: WHITE, letterSpacing: 1 });

// white section: "now it's just code" — accent only on "code"
const nowLine = coloredLine("now", [{ text: "now it's just ", fill: INK }, { text: "code", fill: ACCENT }], CY, 116, 800);
const codeWord = nowLine[1]!; // the accent block, bounced in after

// closing line (dark): "every render," / "byte-identical" (accent, tracked-out mono feel)
const evLine = splitText("every render,", { id: "ev", x: CX, y: 470, fontSize: 92, fontWeight: 800, fill: WHITE });
const biLine = splitText("byte-identical", { id: "bi", x: CX, y: 610, fontSize: 92, fontWeight: 800, fill: ACCENT, letterSpacing: 2 });

// wordmark sting — globe mark + "reframe", centered as one lockup
const MARK_X = 1060, GLOBE_X = 600;
const mark = splitText("reframe", { id: "mark", x: MARK_X, y: CY + 8, fontSize: 132, fontWeight: 800, fill: WHITE, letterSpacing: 1 });
const tag = splitText("motion, as data", { id: "tag", x: MARK_X, y: CY + 120, fontSize: 40, fontWeight: 400, fill: GRAY, letterSpacing: 6 });

// ── code-card mockup (the "this is data" beat) ─────────────────────────────────
const CODE = [
  { t: "scene({", fill: GRAY },
  { t: "  nodes: [ text, rect, path ],", fill: WHITE },
  { t: "  timeline: seq(", fill: WHITE },
  { t: "    tween(\"title\", { y: 240 }),", fill: ACCENT },
  { t: "  ),", fill: WHITE },
  { t: "})", fill: GRAY },
];
const card = group({ id: "card", x: CX, y: CY, scale: 0.92, opacity: 0 }, [
  rect({ id: "card-bg", x: 0, y: 0, anchor: "center", width: 940, height: 540, radius: 26, fill: CARD, stroke: CARDLINE, strokeWidth: 1.5, ...dropShadow("#000000AA", 48, 0, 30) }),
  // window chrome dots
  ellipse({ id: "dot1", x: -420, y: -226, width: 16, height: 16, anchor: "center", fill: "#3A3A42" }),
  ellipse({ id: "dot2", x: -392, y: -226, width: 16, height: 16, anchor: "center", fill: "#3A3A42" }),
  ellipse({ id: "dot3", x: -364, y: -226, width: 16, height: 16, anchor: "center", fill: "#3A3A42" }),
  // code rows
  ...CODE.map((c, i) =>
    text({ id: `code-${i}`, x: -430, y: -150 + i * 56, anchor: "center-left", content: c.t, fontFamily: "Inter", fontSize: 34, fontWeight: 400, fill: c.fill, letterSpacing: 0.5 })),
  // render progress bar (sweeps as it "renders")
  rect({ id: "bar-track", x: 0, y: 238, anchor: "center", width: 940, height: 6, fill: "#202027" }),
  rect({ id: "bar-fill", x: -470, y: 238, anchor: "center-left", width: 940, height: 6, fill: ACCENT, scaleX: 0, ...glow(ACCENT, 12) }),
]);

// mp4 chip that confirms "renders to video"
const chip = group({ id: "chip", x: CX + 360, y: CY + 210, scale: 0.8, opacity: 0 }, [
  rect({ id: "chip-bg", x: 0, y: 0, anchor: "center", width: 150, height: 56, radius: 14, fill: ACCENT }),
  text({ id: "chip-t", x: 0, y: 1, anchor: "center", content: ".mp4", fontFamily: "Inter", fontSize: 30, fontWeight: 800, fill: "#1A0A00" }),
]);

// globe mark for the sting (vector rings)
const globe = group({ id: "globe", x: GLOBE_X, y: CY, scale: 1, opacity: 0 }, [
  ellipse({ id: "g-o", x: 0, y: 0, width: 150, height: 150, anchor: "center", fill: "none", stroke: WHITE, strokeWidth: 5 }),
  ellipse({ id: "g-v", x: 0, y: 0, width: 64, height: 150, anchor: "center", fill: "none", stroke: WHITE, strokeWidth: 4 }),
  ellipse({ id: "g-h", x: 0, y: 0, width: 150, height: 64, anchor: "center", fill: "none", stroke: WHITE, strokeWidth: 4 }),
  ellipse({ id: "g-eq", x: 0, y: 0, width: 150, height: 4, anchor: "center", fill: "none", stroke: WHITE, strokeWidth: 4 }),
]);

export default scene({
  id: "reframe-launch",
  size: { width: W, height: H },
  fps: 30,
  background: CHARCOAL,
  camera: { perspective: 1400 },
  nodes: [
    // dark sections
    ...hero.nodes,
    ...aeSmall.nodes,
    ...aeBig.nodes,
    // white flash background + its text (declared above white-section text so text sits on top)
    rect({ id: "whiteBg", x: CX, y: CY, anchor: "center", width: 3200, height: 2000, fill: WHITE, opacity: 0 }),
    ...nowLine.flatMap((b) => b.nodes),
    // card beat
    card,
    chip,
    // closing
    ...evLine.nodes,
    ...biLine.nodes,
    // sting
    globe,
    ...mark.nodes,
    ...tag.nodes,
  ],

  timeline: seq(
    // 1 — MOTION GRAPHICS
    beat("hero", {}, [seq(
      par(
        textIn("cascade", hero, { speed: 1.15, label: "hero-in" }),
        cameraTo({ zoom: 1.06 }, { duration: 2.4, ease: "easeOutCubic", label: "hero-push" }),
      ),
      wait(1.0),
      textOut("fly", hero, { dir: [0, -1], speed: 1.2, label: "hero-out" }),
    )]),

    // 2 — used to mean AFTER EFFECTS
    beat("ae", {}, [seq(
      cameraTo({ zoom: 1 }, { duration: 0.01 }),
      par(
        textIn("rise", aeSmall, { speed: 1.2, label: "ae-small-in" }),
        seq(wait(0.25), textIn("rise", aeBig, { speed: 1.1, label: "ae-big-in" })),
        cameraTo({ zoom: 1.05, x: CX + 60 }, { duration: 2.6, ease: "easeInOutCubic", label: "ae-pan" }),
      ),
      wait(0.9),
      par(textOut("fly", aeSmall, { dir: [0, -1], label: "ae-small-out" }), textOut("fly", aeBig, { dir: [0, -1], speed: 1.2, label: "ae-big-out" })),
    )]),

    // 3 — WHITE: now it's just code
    beat("now", {}, [seq(
      cameraTo({ zoom: 1, x: CX }, { duration: 0.01 }),
      tween("whiteBg", { opacity: 1 }, { duration: 0.32, ease: "easeOutQuad", label: "flash" }),
      par(
        textIn("rise", nowLine[0]!, { speed: 1.25, label: "now-in" }),
        seq(wait(0.45), textIn("bounce", codeWord, { speed: 1.0, energy: 0.9, label: "code-in" })),
      ),
      wait(1.2),
      par(
        textOut("dissolve", nowLine[0]!, { label: "now-out" }),
        textOut("dissolve", codeWord, { label: "code-out" }),
        seq(wait(0.2), tween("whiteBg", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" })),
      ),
    )]),

    // 4 — code card → mp4
    beat("card", {}, [seq(
      par(
        tween("card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "card-in" }),
        cameraTo({ zoom: 1.12 }, { duration: 3.2, ease: "easeInOutCubic", label: "card-push" }),
      ),
      wait(0.5),
      tween("bar-fill", { scaleX: 1 }, { duration: 1.2, ease: "easeInOutCubic", label: "render" }),
      tween("chip", { opacity: 1, scale: 1 }, { duration: 0.4, ease: "easeOutBack", label: "chip-in" }),
      wait(0.9),
      par(
        tween("card", { opacity: 0, scale: 0.96 }, { duration: 0.5, ease: "easeInQuad" }),
        tween("chip", { opacity: 0 }, { duration: 0.4 }),
        cameraTo({ zoom: 1 }, { duration: 0.6, ease: "easeInOutCubic" }),
      ),
    )]),

    // 5 — every render, byte-identical
    beat("byte", {}, [seq(
      par(
        textIn("rise", evLine, { speed: 1.2, label: "ev-in" }),
        seq(wait(0.35), textIn("assemble", biLine, { speed: 1.0, seed: 7, label: "bi-in" })),
      ),
      wait(1.2),
      par(textOut("dissolve", evLine, { label: "ev-out" }), textOut("dissolve", biLine, { label: "bi-out" })),
    )]),

    // 6 — sting: globe + reframe wordmark
    beat("sting", {}, [seq(
      par(
        tween("globe", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
        seq(wait(0.3), textIn("assemble", mark, { speed: 1.1, seed: 3, label: "mark-in" })),
      ),
      par(
        textIn("typewriter", tag, { speed: 1.4, label: "tag-in" }),
      ),
      wait(2.0, "end"),
    )]),
  ),

  behaviors: [
    oscillate("globe", "rotation", { amplitude: 4, frequency: 0.18 }, { from: 15.4 }),
  ],

  audio: {
    bgm: { synth: "pulse", gain: 0.14, fadeIn: 1, fadeOut: 2, duck: { depth: 0.4 } },
    cues: [
      { at: "hero", sfx: "riser", gain: 0.35 },
      { at: "flash", sfx: "select", gain: 0.4 },
      { at: "render", sfx: "scan", gain: 0.3 },
      { at: "chip-in", sfx: "success", gain: 0.45 },
      { at: "sting", sfx: "boom", gain: 0.5 },
      { at: "sting", offset: 0.25, sfx: "sparkle", gain: 0.4 },
    ],
  },
});
