// Blend modes (compositing): three additive light blobs that brighten where they
// overlap (screen/add), a multiply tint that deepens the gradient beneath it, and a
// neon sign built from a screen-blended core + the shadow glow. The blobs drift over
// each other so the additive overlaps read live. Deterministic (seeded oscillate).

import {
  scene, rect, ellipse, text,
  seq, par, tween, wait, oscillate,
  linearGradient, radialGradient,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#05060C", FG = "#EDEFF5", DIM = "#7C859B";

const cap = (id: string, x: number, y: number, s: string): NodeIR =>
  text({ id, x, y, anchor: "center", content: s, fontFamily: "Inter", fontSize: 22, fontWeight: 600, fill: DIM, letterSpacing: 2 });

// an additive light blob: a soft radial that falls to transparent, screen-blended
const blob = (id: string, x: number, y: number, color: string): NodeIR =>
  ellipse({ id, x, y, width: 460, height: 460, anchor: "center", opacity: 0,
    fill: radialGradient([color, `${color}00`], { cx: 0.5, cy: 0.5, r: 0.5 }), blend: "screen" });

export default scene({
  id: "blend-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    text({ id: "title", x: 96, y: 112, anchor: "center-left", content: "blend modes", fontFamily: "Inter", fontSize: 60, fontWeight: 800, fill: FG }),
    text({ id: "sub", x: 96, y: 160, anchor: "center-left", content: "how a shape composites with what's beneath — additive light, tint, grade", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: DIM }),

    // A — additive light: three blobs that brighten to white where they cross
    blob("r", 560, 470, "#FF2D6A"),
    blob("g", 700, 470, "#27E0A0"),
    blob("b", 630, 590, "#3A7BFF"),
    cap("la", 630, 760, "SCREEN · ADDITIVE LIGHT"),

    // B — multiply tint over a gradient: deepens / colorizes the panel beneath
    rect({ id: "panel", x: 1360, y: 470, width: 440, height: 360, radius: 26, anchor: "center", opacity: 0, fill: linearGradient(["#FFD24B", "#FF7AC4"], { angle: 120 }) }),
    rect({ id: "tint", x: 1360, y: 470, width: 440, height: 360, radius: 26, anchor: "center", opacity: 0, fill: "#1E5BFF", blend: "multiply" }),
    cap("lb", 1360, 700, "MULTIPLY · TINT"),

    // C — neon sign: a screen-blended glowing core + the shadow glow underneath
    rect({ id: "neon", x: 960, y: 880, width: 360, height: 92, radius: 46, anchor: "center", opacity: 0, fill: linearGradient(["#9A4DFF", "#3AA0FF"], { angle: 90 }), shadowColor: "#7A4DFF", shadowBlur: 28, blend: "screen" }),
    text({ id: "neon-t", x: 960, y: 880, anchor: "center", content: "NEON", fontFamily: "Inter", fontSize: 34, fontWeight: 800, fill: "#EAF0FF", letterSpacing: 6, opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    par(
      tween("r", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "in" }),
      seq(wait(0.1), tween("g", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      seq(wait(0.2), tween("b", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      seq(wait(0.25), tween("panel", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.4), tween("tint", { opacity: 0.85 }, { duration: 0.6, ease: "easeOutCubic" })),
    ),
    wait(0.4),
    par(
      tween("neon", { opacity: 1 }, { duration: 0.5, ease: "easeOutBack", label: "neon-in" }),
      seq(wait(0.15), tween("neon-t", { opacity: 1 }, { duration: 0.4 })),
    ),
    wait(3.0),
  ),

  // the light blobs drift across each other so the additive overlaps read live
  behaviors: [
    oscillate("r", "x", { amplitude: 70, frequency: 0.5, phase: 0 }, { from: 560 }),
    oscillate("g", "x", { amplitude: 70, frequency: 0.5, phase: Math.PI }, { from: 700 }),
    oscillate("b", "y", { amplitude: 48, frequency: 0.45, phase: 1 }, { from: 590 }),
    oscillate("neon", "shadowBlur", { amplitude: 14, frequency: 1.0, phase: 0 }, { from: 2.0 }),
  ],
});
