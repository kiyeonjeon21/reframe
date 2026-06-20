// The one-line figure, pushed into a *character*: same neon-line + glow look,
// but rigged. Parts are separate groups with real pivots, so it can pop into
// being, show a face, wave hello, blink, and breathe. Mascot proportions
// (big head) + motion are what read as "character" vs. "abstract silhouette".

import {
  scene, group, rect, ellipse, text, path,
  seq, par, stagger, tween, wait, oscillate,
} from "@reframe/core";

const BG = "#0A0E1A";
const FILL = "#0E1424";          // near-bg fill so overlapping parts occlude cleanly
const LINE = "#FFE3D2";          // warm line
const ACC = "#FF5A1F";           // glow
const CX = 960, CY = 540;

// --- geometry helpers (pure, deterministic) -------------------------------
const capsule = (hw: number, yT: number, yB: number) =>
  `M ${-hw} ${yT} A ${hw} ${hw} 0 0 1 ${hw} ${yT} L ${hw} ${yB} A ${hw} ${hw} 0 0 1 ${-hw} ${yB} Z`;
const circle = (r: number) =>
  `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;

// a body part = soft glow copy behind + crisp filled line on top (filled with
// near-bg so it masks the parts layered behind it)
const part = (id: string, d: string, fill = FILL) => [
  path({ id: `${id}-glow`, d, x: 0, y: 0, fill: "none", stroke: ACC, strokeWidth: 16, opacity: 0.18 }),
  path({ id, d, x: 0, y: 0, fill, stroke: LINE, strokeWidth: 5 }),
];

export default scene({
  id: "one-line-character",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    rect({ id: "wash", x: CX, y: CY - 30, width: 1300, height: 1300, radius: 650, fill: "#121A30", opacity: 0.5, anchor: "center" }),
    rect({ id: "wash2", x: CX, y: CY - 30, width: 760, height: 760, radius: 380, fill: "#17213B", opacity: 0.5, anchor: "center" }),
    ellipse({ id: "shadow", x: CX, y: 742, width: 170, height: 28, fill: "#000000", opacity: 0.28, anchor: "center" }),

    // The character. Each limb is its own group so it has a real pivot.
    group({ id: "char", x: CX, y: CY, scale: 1.15 }, [
      // legs (back), then body covers the hips
      group({ id: "g-legL", x: -26, y: 50, scale: 0 }, part("legL", capsule(19, 0, 118))),
      group({ id: "g-legR", x: 26, y: 50, scale: 0 }, part("legR", capsule(19, 0, 118))),
      group({ id: "g-body", x: 0, y: 0, scale: 0 }, part("body", capsule(48, -66, 52))),
      // arms pivot at the shoulder (group origin), so they can wave
      group({ id: "g-armL", x: -52, y: -48, scale: 0, rotation: -10 }, part("armL", capsule(16, 6, 104))),
      group({ id: "g-armR", x: 52, y: -48, scale: 0, rotation: 10 }, part("armR", capsule(16, 6, 104))),
      // head + face on top
      group({ id: "g-head", x: 0, y: -150, scale: 0 }, [
        ...part("head", circle(86)),
        group({ id: "g-eyes", x: 0, y: -10, opacity: 0 }, [
          ellipse({ id: "eyeL", x: -30, y: 0, width: 15, height: 19, fill: LINE, anchor: "center" }),
          ellipse({ id: "eyeR", x: 30, y: 0, width: 15, height: 19, fill: LINE, anchor: "center" }),
        ]),
        path({ id: "mouth", d: "M -28 0 Q 0 28 28 0", x: 0, y: 28, fill: "none", stroke: LINE, strokeWidth: 4, progress: 0 }),
      ]),
    ]),

    group({ id: "cap", x: CX, y: 912, opacity: 0 }, [
      text({ id: "cap-t", x: 0, y: 0, content: "hi, i'm one scene.", fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: "#7E8AA8", anchor: "center" }),
    ]),
  ],

  timeline: seq(
    wait(0.2),
    // pop into being, part by part, head last for the biggest bounce
    stagger(0.12,
      tween("g-body", { scale: 1 }, { duration: 0.5, ease: "easeOutBack" }),
      tween("g-legL", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-legR", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-armL", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-armR", { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }),
      tween("g-head", { scale: 1 }, { duration: 0.55, ease: "easeOutBack" }),
    ),
    // face: eyes blink open, smile draws on
    par(
      tween("g-eyes", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic" }),
      tween("mouth", { progress: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
    // raise the right arm to wave (behavior oscillates it during the hold)
    tween("g-armR", { rotation: -148 }, { duration: 0.5, ease: "easeOutBack" }),
    // idle while waving: a couple of blinks
    seq(
      wait(0.5),
      tween("g-eyes", { scaleY: 0.1 }, { duration: 0.07 }),
      tween("g-eyes", { scaleY: 1 }, { duration: 0.07 }),
      wait(0.6),
      tween("g-eyes", { scaleY: 0.1 }, { duration: 0.07 }),
      tween("g-eyes", { scaleY: 1 }, { duration: 0.07 }),
      wait(0.2),
    ),
    // arm settles back down
    tween("g-armR", { rotation: 10 }, { duration: 0.5, ease: "easeInOutCubic" }),
    par(
      tween("cap", { opacity: 1, y: 860 }, { duration: 0.7, ease: "easeOutCubic" }),
    ),
    wait(1.6),
  ),

  behaviors: [
    oscillate("char", "y", { amplitude: 5, frequency: 0.55 }, { from: 1.3, ramp: 0.6 }),       // idle bob
    oscillate("g-head", "rotation", { amplitude: 2, frequency: 0.55 }, { from: 1.3, ramp: 0.6 }), // head sway
    oscillate("g-body", "scaleY", { amplitude: 0.02, frequency: 0.7 }, { from: 1.3, ramp: 0.6 }),  // breathe
    oscillate("g-armR", "rotation", { amplitude: 15, frequency: 2.6 }, { from: 2.35, until: 3.6, ramp: 0.15 }), // wave
  ],
});
