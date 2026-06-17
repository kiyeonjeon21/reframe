// Shadow / glow / blur: a drop-shadowed card, a glowing orb with a PULSING glow
// (oscillate shadowBlur), and a focus-pull (animate blur 16→0) — combined with
// gradient fills. Effects are animatable scalars in screen-pixel space. Deterministic.

import {
  scene, rect, ellipse, text,
  seq, par, tween, wait, oscillate,
  linearGradient, radialGradient, glow, dropShadow,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", FG = "#EDEFF5", DIM = "#7C859B";

const cap = (id: string, x: number, s: string): NodeIR =>
  text({ id, x, y: 660, anchor: "center", content: s, fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: DIM, letterSpacing: 2 });

export default scene({
  id: "shadow-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    // ambient blurred depth (big soft color washes behind everything)
    ellipse({ id: "amb1", x: 470, y: 300, width: 680, height: 680, anchor: "center", fill: "#5A3A8A", opacity: 0.22, blur: 70 }),
    ellipse({ id: "amb2", x: 1480, y: 820, width: 640, height: 640, anchor: "center", fill: "#2E6A8A", opacity: 0.2, blur: 70 }),

    text({ id: "title", x: 96, y: 112, anchor: "center-left", content: "shadow · glow · blur", fontFamily: "Inter", fontSize: 60, fontWeight: 800, fill: FG }),
    text({ id: "sub", x: 96, y: 160, anchor: "center-left", content: "animatable paint effects — pulse a glow, pull focus", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: DIM }),

    // A — drop shadow: a light card floats above the surface
    rect({ id: "card-a", x: 400, y: 430, width: 300, height: 300, radius: 30, anchor: "center", opacity: 0, fill: linearGradient(["#FDFEFF", "#CCD3E4"], { angle: 110 }), ...dropShadow("#000000", 64, 0, 34) }),
    cap("la", 400, "DROP SHADOW"),

    // B — glow: a gold orb with a pulsing outer glow (oscillate shadowBlur)
    ellipse({ id: "orb", x: 960, y: 430, width: 280, height: 280, anchor: "center", opacity: 0, fill: radialGradient(["#FFE79A", "#C77A1A"], { cx: 0.42, cy: 0.4, r: 0.62 }), shadowColor: "#FFC24B", shadowBlur: 22 }),
    cap("lb", 960, "GLOW"),

    // C — blur / focus pull: starts blurred, sharpens
    rect({ id: "card-c", x: 1520, y: 430, width: 300, height: 300, radius: 30, anchor: "center", opacity: 0, fill: linearGradient(["#7C5CFF", "#3AA0FF"], { angle: 135 }), blur: 18 }),
    cap("lc", 1520, "BLUR · FOCUS"),

    // a CTA with a pulsing glow (gradient fill + animated glow)
    rect({ id: "cta", x: 960, y: 850, width: 340, height: 92, radius: 46, anchor: "center", opacity: 0, fill: linearGradient(["#FF4D6D", "#FF8A3A"], { angle: 90 }), shadowColor: "#FF4D6D", shadowBlur: 24 }),
    text({ id: "cta-t", x: 960, y: 850, anchor: "center", content: "Get started", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: "#1A0E08", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    par(
      tween("card-a", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "in-a" }),
      seq(wait(0.12), tween("orb", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.24), tween("card-c", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
    ),
    wait(0.3),
    // focus pull: the blurred card sharpens
    tween("card-c", { blur: 0 }, { duration: 1.0, ease: "easeInOutCubic", label: "focus" }),
    wait(0.2),
    par(
      tween("cta", { opacity: 1 }, { duration: 0.5, ease: "easeOutBack", label: "cta-in" }),
      seq(wait(0.15), tween("cta-t", { opacity: 1 }, { duration: 0.4 })),
    ),
    wait(2.0),
  ),

  // pulsing glows (animatable shadowBlur)
  behaviors: [
    oscillate("orb", "shadowBlur", { amplitude: 16, frequency: 0.9, phase: 0 }, { from: 0.8 }),
    oscillate("cta", "shadowBlur", { amplitude: 18, frequency: 1.1, phase: 1 }, { from: 3.0 }),
  ],
});
