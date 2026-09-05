// Chase Sapphire — a premium credit-card promo. The card swoops in along a curve while
// spinning a full 360° in real 2.5D perspective (double-sided: a back face with a
// magstripe shows on the back half of the spin), settles, a light sweep glides
// across it, benefit pills pop in, then a CTA. The ACCENT is a design token, so
// `--theme gold.json` / `--theme platinum.json` re-skins the whole card. ~7s, 1080p.
//
//   pnpm reframe frame credit-card-promo.ts --t 0.55 -o f.png   # mid-spin (back showing)
//   pnpm reframe render credit-card-promo.ts                    # → out/credit-card-promo.mp4

import {
  scene, group, rect, ellipse, text, path,
  seq, par, tween, wait, oscillate, motionPath,
  linearGradient, radialGradient,
  token,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080, CX = 960, CY = 520;
const CW = 560, CH = 352, CR = 30; // card

const blob = (id: string, x: number, y: number, d: number, c: string): NodeIR =>
  ellipse({ id, x, y, width: d, height: d, anchor: "center", opacity: 0.85,
    fill: radialGradient([c, `${c}00`], { r: 0.5 }), blend: "screen" });

const pill = (id: string, x: number, label: string): NodeIR =>
  group({ id, x, y: 905, opacity: 0, scale: 0.9 }, [
    rect({ id: `${id}-bg`, x: 0, y: 0, width: 360, height: 66, radius: 33, anchor: "center",
      fill: linearGradient(["#141A2BEE", "#0D1220EE"], { angle: 90 }),
      stroke: "#FFFFFF1F", strokeWidth: 1, shadowColor: "#02030A", shadowBlur: 28, shadowY: 12 }),
    ellipse({ id: `${id}-dot`, x: -140, y: 0, width: 16, height: 16, anchor: "center", fill: token("color.accent") }),
    text({ id: `${id}-t`, x: -116, y: 0, anchor: "center-left", content: label,
      fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: "#EAEFFA" }),
  ]);

export default scene({
  id: "credit-card-promo",
  size: { width: W, height: H },
  fps: 30,
  background: "#04050B",
  design: { color: { accent: "#3B9AE8" } }, // Chase blue; re-skin with `--theme`
  camera: { perspective: 1500, zoom: 1 },

  nodes: [
    // ── background: deep field + drifting aurora ──
    rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: linearGradient(["#04050B", "#0A1024"], { angle: 120 }) }),
    blob("aur-1", 540, 360, 1140, "#2A48B0"),
    blob("aur-2", 1440, 420, 1180, "#6E37B6"),
    blob("aur-3", 1080, 900, 1220, "#177A93"),

    ellipse({ id: "card-glow", x: CX, y: CY + 18, width: 1000, height: 640, anchor: "center", opacity: 0,
      fill: radialGradient(["#3B9AE855", "#3B9AE800"], { r: 0.5 }), blend: "screen" }),

    // ── the card: parent spins + travels; two faces toggled at the edge-on moments ──
    group({ id: "card", x: CX, y: CY, z: 560, rotateY: 0, opacity: 1, scale: 0.9 }, [
      // FRONT
      group({ id: "card-front", x: 0, y: 0, opacity: 1 }, [
        rect({ id: "card-face", x: 0, y: 0, width: CW, height: CH, radius: CR, anchor: "center",
          fill: linearGradient(["#1E3E78", "#0B1B3C", "#27508F"], { angle: 125 }),
          stroke: token("color.accent"), strokeWidth: 2.5, shadowColor: "#01020A", shadowBlur: 90, shadowY: 54 }),
        rect({ id: "card-sheen", x: 0, y: -86, width: CW - 16, height: CH / 2, radius: CR, anchor: "center",
          fill: linearGradient(["#FFFFFF2E", "#FFFFFF00"], { angle: 90 }), blend: "screen" }),
        rect({ id: "chip", x: -188, y: -46, width: 76, height: 58, radius: 12, anchor: "center",
          fill: linearGradient(["#F7E6B0", "#C49A45", "#F2D588"], { angle: 120 }) }),
        path({ id: "chase-logo", x: 104, y: -110, d: "M15.7 6.5 L6.5 15.7 L-6.5 15.7 L-15.7 6.5 L-15.7 -6.5 L-6.5 -15.7 L6.5 -15.7 L15.7 -6.5 Z", fill: token("color.accent") }),
        text({ id: "brand", x: 244, y: -114, anchor: "center-right", content: "CHASE",
          fontFamily: "Inter", fontSize: 33, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 3 }),
        text({ id: "subbrand", x: 244, y: -82, anchor: "center-right", content: "SAPPHIRE",
          fontFamily: "Inter", fontSize: 17, fontWeight: 600, fill: token("color.accent"), letterSpacing: 6 }),
        text({ id: "number", x: -244, y: 34, anchor: "center-left", content: "4929  8830  1174  5520",
          fontFamily: "Inter", fontSize: 34, fontWeight: 600, fill: "#E9EEF9", letterSpacing: 4,
          shadowColor: "#00030A", shadowBlur: 8, shadowY: 1 }),
        text({ id: "name", x: -244, y: 120, anchor: "center-left", content: "ALEX MORGAN",
          fontFamily: "Inter", fontSize: 22, fontWeight: 600, fill: "#C7D0E2", letterSpacing: 2 }),
        text({ id: "valid", x: -244, y: 80, anchor: "center-left", content: "VALID THRU  09/29",
          fontFamily: "Inter", fontSize: 16, fontWeight: 600, fill: "#9AA6BE", letterSpacing: 2 }),
        text({ id: "network", x: 244, y: 110, anchor: "center-right", content: "VISA",
          fontFamily: "Inter", fontSize: 32, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 2 }),
        group({ id: "sweepclip", x: 0, y: 0, clip: { kind: "rect", x: -CW / 2, y: -CH / 2, width: CW, height: CH, radius: CR } }, [
          rect({ id: "sweep", x: -360, y: 0, width: 130, height: CH * 2.2, rotation: 20, anchor: "center",
            fill: linearGradient(["#FFFFFF00", "#FFFFFFB0", "#FFFFFF00"], { angle: 0 }), blend: "screen" }),
        ]),
      ]),
      // BACK (local rotateY 180 → reads correctly when the parent faces away; hidden until then)
      group({ id: "card-back", x: 0, y: 0, rotateY: 180, opacity: 0 }, [
        rect({ id: "back-face", x: 0, y: 0, width: CW, height: CH, radius: CR, anchor: "center",
          fill: linearGradient(["#173258", "#0A1730", "#173258"], { angle: 125 }),
          stroke: token("color.accent"), strokeWidth: 2.5, shadowColor: "#01020A", shadowBlur: 90, shadowY: 54 }),
        rect({ id: "magstripe", x: 0, y: -104, width: CW, height: 54, anchor: "center", fill: "#07080E" }),
        rect({ id: "sigstrip", x: -54, y: 30, width: 300, height: 48, radius: 6, anchor: "center", fill: "#ECECF1" }),
        rect({ id: "cvvbox", x: 178, y: 30, width: 72, height: 48, radius: 6, anchor: "center", fill: "#ECECF1" }),
        text({ id: "cvv", x: 178, y: 30, anchor: "center", content: "•••", fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: "#3A3F4C" }),
        text({ id: "back-print", x: 0, y: 110, anchor: "center", content: "chase.com  ·  24/7 support  ·  member FDIC",
          fontFamily: "Inter", fontSize: 15, fontWeight: 500, fill: "#8C99B2", letterSpacing: 1 }),
        text({ id: "back-brand", x: -210, y: -104, anchor: "center-left", content: "CHASE",
          fontFamily: "Inter", fontSize: 20, fontWeight: 800, fill: token("color.accent"), letterSpacing: 3 }),
      ]),
    ]),

    text({ id: "headline", x: CX, y: 226, anchor: "center", content: "Every point goes further",
      fontFamily: "Inter", fontSize: 58, fontWeight: 800, fill: "#FFFFFF", opacity: 0,
      shadowColor: "#02040C", shadowBlur: 18, shadowY: 3 }),

    pill("feat-1", 590, "5x on travel"),
    pill("feat-2", 960, "$0 foreign fees"),
    pill("feat-3", 1330, "60-second approval"),

    group({ id: "cta", x: CX, y: 905, opacity: 0, scale: 0.9 }, [
      rect({ id: "cta-bg", x: 0, y: 0, width: 380, height: 74, radius: 37, anchor: "center",
        fill: token("color.accent"), shadowColor: "#3B9AE855", shadowBlur: 40, shadowY: 0 }),
      text({ id: "cta-t", x: 0, y: 0, anchor: "center", content: "Apply in 60 seconds",
        fontFamily: "Inter", fontSize: 28, fontWeight: 800, fill: "#FFFFFF" }),
    ]),
    text({ id: "cta-sub", x: CX, y: 982, anchor: "center", content: "Checking your rate won't affect your credit",
      fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: "#8C99B2", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.2),
    // 1 — curved swoop-in + full 360° spin + depth, with a subtle camera push.
    //     The spin is LINEAR so the front/back swap lands at the edge-on frames
    //     (90° at +0.30s, 270° at +0.90s of the 1.2s spin), where the card is invisibly thin.
    par(
      motionPath("card", [[360, 1180], [780, 820], [1300, 560], [CX, CY]], { duration: 1.3, ease: "easeOutCubic", label: "card-in" }),
      tween("card", { z: 0 }, { duration: 1.3, ease: "easeOutCubic" }),
      tween("card", { scale: 1 }, { duration: 1.3, ease: "easeOutCubic" }),
      tween("card", { rotateY: 360 }, { duration: 1.2, ease: "linear", label: "spin" }),
      tween("card-glow", { opacity: 0.9 }, { duration: 1.35, ease: "easeOutCubic" }),
      tween("camera", { zoom: 1.04 }, { duration: 1.3, ease: "easeOutCubic" }),
      // front: visible → hidden over the back half → visible
      seq(wait(0.28), tween("card-front", { opacity: 0 }, { duration: 0.04, ease: "linear", label: "to-back" }),
          wait(0.56), tween("card-front", { opacity: 1 }, { duration: 0.04, ease: "linear", label: "to-front" })),
      // back: hidden → visible over the back half → hidden
      seq(wait(0.28), tween("card-back", { opacity: 1 }, { duration: 0.04, ease: "linear" }),
          wait(0.56), tween("card-back", { opacity: 0 }, { duration: 0.04, ease: "linear" })),
    ),
    // 2 — SHOWCASE: a slow turntable sway (admire the 3D) + light sweep + headline + slow camera push
    par(
      seq(
        tween("card", { rotateY: 372 }, { duration: 0.9, ease: "easeInOutQuad", label: "sway" }),
        tween("card", { rotateY: 348 }, { duration: 1.4, ease: "easeInOutQuad" }),
        tween("card", { rotateY: 360 }, { duration: 0.9, ease: "easeInOutQuad" }),
      ),
      seq(wait(0.3), tween("sweep", { x: 360 }, { duration: 1.2, ease: "easeInOutQuad", label: "sweep" })),
      seq(wait(0.2), tween("headline", { opacity: 1, y: 200 }, { duration: 0.7, ease: "easeOutCubic", label: "headline" })),
      tween("camera", { zoom: 1.06 }, { duration: 3.2, ease: "easeInOutQuad" }),
    ),
    // 3 — benefit pills pop in (slower stagger)
    par(
      tween("feat-1", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "feat-1" }),
      seq(wait(0.22), tween("feat-2", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "feat-2" })),
      seq(wait(0.44), tween("feat-3", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "feat-3" })),
    ),
    wait(1.7),
    // 4 — swap to the CTA: glow swells, a second sweep shines, the card gives a present-pulse
    par(
      tween("feat-1", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad", label: "feat-out" }),
      tween("feat-2", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      tween("feat-3", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      tween("card-glow", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "cta-glow" }),
      seq(tween("card", { scale: 1.05 }, { duration: 0.45, ease: "easeOutCubic", label: "pulse" }),
          tween("card", { scale: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      seq(tween("sweep", { x: -360 }, { duration: 0.01, ease: "linear", label: "sweep-reset" }),
          tween("sweep", { x: 360 }, { duration: 1.0, ease: "easeInOutQuad", label: "sweep-2" })),
      seq(wait(0.3), par(
        tween("cta", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "cta" }),
        tween("cta-sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      )),
    ),
    wait(2.4),
  ),

  behaviors: [
    // The card holds PERFECTLY still after it lands — no idle float or rotation. Canvas
    // re-rasterizes glyphs every frame the card moves (the 2.5D transform shifts sub-pixel),
    // so any idle motion shimmers the text. Still card during the read beats = crisp text.
    // Life comes from the entrance spin, the showcase turn, the CTA pulse, and the aurora.
    oscillate("aur-1", "x", { amplitude: 60, frequency: 0.045 }),
    oscillate("aur-2", "y", { amplitude: 70, frequency: 0.04, phase: 1.5 }),
    oscillate("aur-3", "x", { amplitude: 80, frequency: 0.035, phase: 2.4 }),
  ],

  audio: {
    bgm: { synth: "uplift", gain: 0.45 },
    cues: [
      { at: "card-in", sfx: "whoosh" },
      { at: "sweep", sfx: "shimmer" },
      { at: "feat-1", sfx: "pop" },
      { at: "feat-2", sfx: "pop" },
      { at: "feat-3", sfx: "pop" },
      { at: "sweep-2", sfx: "shimmer" },
      { at: "cta", sfx: "rise" },
    ],
  },
});
