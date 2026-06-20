// Rig + morph, together. The character is rigged (jointed groups with real
// pivots) AND its shapes morph (the body squashes & stretches, the face changes
// expression) — the two things that separate a "character" from a moving icon.
// Squash/stretch and expressions are path `d` tweens: vertices lerp frame to
// frame, the Lottie-style shape tween, now native to reframe's IR.

import {
  scene, group, rect, ellipse, text, path,
  seq, par, stagger, tween, wait, oscillate,
} from "@reframe/core";

const BG = "#0A0E1A";
const FILL = "#0E1424";
const LINE = "#FFE3D2";
const ACC = "#FF5A1F";
const CX = 960, CY = 560;

// --- morphable oval (4 cubic beziers — identical structure at any size, so
// any two ovals can morph) and an arc capsule (limbs; rig-only, never morphed)
const K = 0.5523;
const f2 = (n: number) => Number(n.toFixed(2));
function oval(a: number, b: number, cy = 0): string {
  const ka = f2(a * K), kb = f2(b * K);
  const t = f2(cy - b), bo = f2(cy + b), c = f2(cy), A = f2(a);
  return `M 0 ${t} C ${ka} ${t} ${A} ${f2(cy - kb)} ${A} ${c} ` +
    `C ${A} ${f2(cy + kb)} ${ka} ${bo} 0 ${bo} ` +
    `C ${-ka} ${bo} ${-A} ${f2(cy + kb)} ${-A} ${c} ` +
    `C ${-A} ${f2(cy - kb)} ${-ka} ${t} 0 ${t} Z`;
}
const capsule = (hw: number, yT: number, yB: number) =>
  `M ${-hw} ${yT} A ${hw} ${hw} 0 0 1 ${hw} ${yT} L ${hw} ${yB} A ${hw} ${hw} 0 0 1 ${-hw} ${yB} Z`;

// glow copy + crisp filled line, sharing one `d`
const part = (id: string, d: string, fill = FILL) => [
  path({ id: `${id}-glow`, d, x: 0, y: 0, fill: "none", stroke: ACC, strokeWidth: 16, opacity: 0.18 }),
  path({ id, d, x: 0, y: 0, fill, stroke: LINE, strokeWidth: 5 }),
];
// morph a part's glow + line together (they share geometry)
const morph = (id: string, d: string, opts: Parameters<typeof tween>[2]) => [
  tween(`${id}-glow`, { d }, opts),
  tween(id, { d }, opts),
];

// body shape language — every variant keeps its bottom planted near y=+52
const BODY = oval(50, 59, 0);
const BODY_SQUASH = oval(67, 42, 17);
const BODY_STRETCH = oval(40, 80, -21);
const BODY_LAND = oval(73, 36, 23);
// head — a circle that squashes on impact (bottom/neck stays put)
const HEAD = oval(86, 86, 0);
const HEAD_SQUASH = oval(95, 73, 13);
// face shapes
const EYE = oval(7, 9), EYE_BIG = oval(11, 13), EYE_SHUT = oval(7, 1.2);
const MOUTH = oval(22, 4), MOUTH_O = oval(15, 16);

export default scene({
  id: "character-morph",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    rect({ id: "wash", x: CX, y: CY - 30, width: 1300, height: 1300, radius: 650, fill: "#121A30", opacity: 0.5, anchor: "center" }),
    rect({ id: "wash2", x: CX, y: CY - 30, width: 760, height: 760, radius: 380, fill: "#17213B", opacity: 0.5, anchor: "center" }),
    ellipse({ id: "shadow", x: CX, y: 742, width: 170, height: 28, fill: "#000000", opacity: 0.28, anchor: "center" }),

    group({ id: "char", x: CX, y: CY, scale: 1.2 }, [
      group({ id: "g-legL", x: -24, y: 44, scale: 0 }, part("legL", capsule(18, 0, 120))),
      group({ id: "g-legR", x: 24, y: 44, scale: 0 }, part("legR", capsule(18, 0, 120))),
      group({ id: "g-body", x: 0, y: -7, scale: 0 }, part("body", BODY)),
      group({ id: "g-armL", x: -48, y: -44, scale: 0, rotation: -10 }, part("armL", capsule(15, 6, 104))),
      group({ id: "g-armR", x: 48, y: -44, scale: 0, rotation: 10 }, part("armR", capsule(15, 6, 104))),
      group({ id: "g-head", x: 0, y: -150, scale: 0 }, [
        ...part("head", HEAD),
        group({ id: "g-eyes", x: 0, y: 0, opacity: 0 }, [
          path({ id: "eyeL", d: EYE, x: -30, y: -12, fill: LINE }),
          path({ id: "eyeR", d: EYE, x: 30, y: -12, fill: LINE }),
        ]),
        path({ id: "mouth", d: MOUTH, x: 0, y: 30, fill: BG, stroke: LINE, strokeWidth: 3, opacity: 0 }),
      ]),
    ]),

    group({ id: "cap", x: CX, y: 922, opacity: 0 }, [
      text({ id: "cap-t", x: 0, y: 0, content: "rigged and morphed. one scene.", fontFamily: "Inter", fontSize: 32, fontWeight: 700, fill: "#7E8AA8", anchor: "center" }),
    ]),
  ],

  timeline: seq(
    wait(0.2),
    // 1. pop into being, part by part
    stagger(0.11,
      tween("g-body", { scale: 1 }, { duration: 0.5, ease: "easeOutBack" }),
      tween("g-legL", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-legR", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-armL", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-armR", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-head", { scale: 1 }, { duration: 0.55, ease: "easeOutBack" }),
    ),
    par(
      tween("g-eyes", { opacity: 1 }, { duration: 0.3 }),
      tween("mouth", { opacity: 1 }, { duration: 0.3 }),
    ),
    wait(0.3),

    // 2. EXPRESSION MORPH — eyes widen, mouth opens to an "O", then relaxes
    par(
      tween("eyeL", { d: EYE_BIG }, { duration: 0.22, ease: "easeOutBack" }),
      tween("eyeR", { d: EYE_BIG }, { duration: 0.22, ease: "easeOutBack" }),
      tween("mouth", { d: MOUTH_O }, { duration: 0.22, ease: "easeOutBack" }),
      tween("g-head", { y: -158 }, { duration: 0.22, ease: "easeOutQuad" }),
    ),
    wait(0.5),
    par(
      tween("eyeL", { d: EYE }, { duration: 0.3 }),
      tween("eyeR", { d: EYE }, { duration: 0.3 }),
      tween("mouth", { d: MOUTH }, { duration: 0.3 }),
      tween("g-head", { y: -150 }, { duration: 0.3 }),
    ),
    wait(0.25),

    // 3. JUMP — squash (anticipation) → stretch (launch) → squash (land) → settle
    par(
      ...morph("body", BODY_SQUASH, { duration: 0.2, ease: "easeOutQuad" }),
      tween("char", { y: CY + 22 }, { duration: 0.2, ease: "easeOutQuad" }),
      tween("shadow", { scaleX: 1.15 }, { duration: 0.2 }),
    ),
    par(
      ...morph("body", BODY_STRETCH, { duration: 0.3, ease: "easeOutCubic" }),
      tween("char", { y: CY - 150 }, { duration: 0.36, ease: "easeOutCubic" }),
      tween("g-armL", { rotation: -150 }, { duration: 0.3, ease: "easeOutCubic" }),
      tween("g-armR", { rotation: 150 }, { duration: 0.3, ease: "easeOutCubic" }),
      tween("shadow", { scaleX: 0.6, opacity: 0.14 }, { duration: 0.36 }),
    ),
    par(
      ...morph("body", BODY, { duration: 0.22 }),
      tween("char", { y: CY }, { duration: 0.3, ease: "easeInCubic" }),
      tween("g-armL", { rotation: -10 }, { duration: 0.3, ease: "easeInQuad" }),
      tween("g-armR", { rotation: 10 }, { duration: 0.3, ease: "easeInQuad" }),
      tween("shadow", { scaleX: 1, opacity: 0.28 }, { duration: 0.3 }),
    ),
    // impact
    par(
      ...morph("body", BODY_LAND, { duration: 0.1, ease: "easeOutQuad" }),
      ...morph("head", HEAD_SQUASH, { duration: 0.1, ease: "easeOutQuad" }),
      tween("char", { y: CY + 16 }, { duration: 0.1, ease: "easeOutQuad" }),
      tween("shadow", { scaleX: 1.3 }, { duration: 0.1 }),
    ),
    // settle with an overshoot
    par(
      ...morph("body", BODY, { duration: 0.45, ease: "easeOutBack" }),
      ...morph("head", HEAD, { duration: 0.45, ease: "easeOutBack" }),
      tween("char", { y: CY }, { duration: 0.45, ease: "easeOutBack" }),
      tween("shadow", { scaleX: 1 }, { duration: 0.45 }),
    ),

    // 4. wave + caption
    tween("g-armR", { rotation: -148 }, { duration: 0.45, ease: "easeOutBack" }),
    seq(
      wait(0.5),
      par(tween("eyeL", { d: EYE_SHUT }, { duration: 0.07 }), tween("eyeR", { d: EYE_SHUT }, { duration: 0.07 })),
      par(tween("eyeL", { d: EYE }, { duration: 0.07 }), tween("eyeR", { d: EYE }, { duration: 0.07 })),
      wait(0.2),
    ),
    tween("g-armR", { rotation: 10 }, { duration: 0.5, ease: "easeInOutCubic" }),
    tween("cap", { opacity: 1, y: 870 }, { duration: 0.7, ease: "easeOutCubic" }),
    wait(1.5),
  ),

  behaviors: [
    oscillate("char", "y", { amplitude: 5, frequency: 0.55 }, { from: 7.6, ramp: 0.6 }),
    oscillate("g-head", "rotation", { amplitude: 2, frequency: 0.55 }, { from: 7.6, ramp: 0.6 }),
    oscillate("g-armR", "rotation", { amplitude: 15, frequency: 2.6 }, { from: 6.6, until: 7.6, ramp: 0.15 }),
  ],
});
