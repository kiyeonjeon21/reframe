// Apple-style "Liquid Glass" — a floating glass card with a LIVE backdrop blur
// (the engine's `backdrop` primitive): it samples the colourful, drifting blobs
// behind it and redraws them frosted inside the card, every frame. Specular rim,
// top sheen, a light sweep, and a soft contact shadow. Pure shapes (no image), so
// it plays live in any browser: `reframe player examples/scenes/liquid-glass.ts`.

import {
  scene, group, rect, ellipse, text,
  seq, par, tween, wait, oscillate,
  linearGradient, radialGradient,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const CX = 960, CY = 500;
const BW = 880, BH = 300, BR = 56;

const blob = (id: string, x: number, y: number, d: number, c: string): NodeIR =>
  ellipse({ id, x, y, width: d, height: d, anchor: "center", fill: radialGradient([c, `${c}00`], { r: 0.5 }), blend: "screen" });

export default scene({
  id: "liquid-glass",
  size: { width: W, height: H },
  fps: 30,
  background: "#070A14",
  nodes: [
    // colourful page behind the glass (drifts, so the frosted backdrop shimmers live)
    rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: linearGradient(["#0A0F20", "#0C1228"], { angle: 120 }) }),
    blob("b-1", 470, 360, 1000, "#FF7A3D"),
    blob("b-2", 1500, 380, 1080, "#3D7BFF"),
    blob("b-3", 1180, 900, 1180, "#B14DFF"),
    blob("b-4", 720, 860, 760, "#19E3B1"),

    // ── the glass card: live backdrop blur of the blobs behind it ──
    rect({ id: "card", x: CX, y: CY, width: BW, height: BH, radius: BR, anchor: "center", opacity: 0, scale: 0.92,
      backdrop: { blur: 26, saturate: 1.5 },
      fill: linearGradient(["#FFFFFF1F", "#FFFFFF08"], { angle: 90 }),
      shadowColor: "#02040A", shadowBlur: 72, shadowX: 0, shadowY: 40 }),
    // top sheen
    rect({ id: "sheen", x: CX, y: CY - BH / 4, width: BW - 10, height: BH / 2, radius: BR, anchor: "center", opacity: 0,
      fill: linearGradient(["#FFFFFF66", "#FFFFFF00"], { angle: 90 }), blend: "screen" }),
    // light sweep, clipped to the card
    group({ id: "sweepclip", x: CX, y: CY, opacity: 0, clip: { kind: "rect", x: -BW / 2, y: -BH / 2, width: BW, height: BH, radius: BR } }, [
      rect({ id: "sweep", x: -640, y: 0, width: 200, height: BH * 2.4, rotation: 18, anchor: "center",
        fill: linearGradient(["#FFFFFF00", "#FFFFFFAA", "#FFFFFF00"], { angle: 0 }), blend: "screen" }),
    ]),
    // specular rim
    rect({ id: "rim", x: CX, y: CY, width: BW, height: BH, radius: BR, anchor: "center", opacity: 0,
      fill: "none", stroke: linearGradient(["#FFFFFFF2", "#FFFFFF24", "#FFFFFF8C"], { angle: 125 }), strokeWidth: 3 }),
    // label inside the glass
    text({ id: "title", x: CX, y: CY - 6, anchor: "center", content: "Liquid Glass", fontFamily: "Inter", fontSize: 66, fontWeight: 800, fill: "#FFFFFF", opacity: 0, shadowColor: "#04101C", shadowBlur: 16, shadowX: 0, shadowY: 2 }),
    text({ id: "sub", x: CX, y: CY + 52, anchor: "center", content: "live backdrop blur · engine primitive", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: "#D8E0F0", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.2),
    par(
      tween("card", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "in-card" }),
      tween("rim", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "in-rim" }),
      tween("sheen", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "in-sheen" }),
      tween("sweepclip", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "in-sweep" }),
      seq(wait(0.25), par(
        tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "in-title" }),
        tween("sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "in-sub" }),
      )),
    ),
    tween("sweep", { x: 720 }, { duration: 2.0, ease: "easeInOutQuad", label: "sweep-1" }),
    wait(1.4),
    tween("sweep", { x: -640 }, { duration: 0.01, ease: "linear", label: "sweep-reset" }),
    tween("sweep", { x: 720 }, { duration: 2.0, ease: "easeInOutQuad", label: "sweep-2" }),
    wait(1.0),
  ),

  // the blobs drift → the live frosted backdrop shimmers; the card breathes
  behaviors: [
    oscillate("b-1", "x", { amplitude: 60, frequency: 0.05 }),
    oscillate("b-2", "y", { amplitude: 70, frequency: 0.045, phase: 1 }),
    oscillate("b-3", "x", { amplitude: 80, frequency: 0.04, phase: 2 }),
    oscillate("b-4", "y", { amplitude: 60, frequency: 0.055, phase: 0.5 }),
    oscillate("card", "y", { amplitude: 10, frequency: 0.12 }),
    oscillate("rim", "y", { amplitude: 10, frequency: 0.12 }),
    oscillate("sheen", "y", { amplitude: 10, frequency: 0.12 }),
    oscillate("title", "y", { amplitude: 10, frequency: 0.12 }),
    oscillate("sub", "y", { amplitude: 10, frequency: 0.12 }),
    oscillate("sweepclip", "y", { amplitude: 10, frequency: 0.12 }),
  ],
});
