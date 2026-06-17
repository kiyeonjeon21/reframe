// Gradient fills & strokes: linear / radial / conic on rect, ellipse, and path,
// plus the "animated gradient" idiom — a spinning badge whose linear gradient
// sweeps because the gradient lives in the node's local space. Static gradients,
// motion from the node's transform. Pure + deterministic.

import {
  scene, group, rect, ellipse, path, text,
  seq, par, tween, wait, oscillate,
  linearGradient, radialGradient, conicGradient,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", CARD = "#11141E", FG = "#EDEFF5", DIM = "#7C859B";

const STAR = "M0 -150 L35 -49 L143 -46 L57 19 L88 121 L0 60 L-88 121 L-57 19 L-143 -46 L-35 -49 Z";

const label = (id: string, x: number, s: string): NodeIR =>
  text({ id, x, y: 720, anchor: "center", content: s, fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: DIM, letterSpacing: 2 });

export default scene({
  id: "gradient-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    text({ id: "title", x: 96, y: 110, anchor: "center-left", content: "gradients", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: FG }),
    text({ id: "sub", x: 96, y: 158, anchor: "center-left", content: "linear · radial · conic, on any shape", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: DIM }),

    // three cards: rect linear, ellipse radial, path conic (each pops in)
    group({ id: "card-a", x: 0, y: 0, opacity: 0, scale: 0.85 }, [
      rect({ id: "a", x: 380, y: 470, width: 380, height: 380, radius: 32, anchor: "center", fill: linearGradient(["#FF5C3A", "#FFC24B"], { angle: 60 }) }),
      label("la", 380, "LINEAR"),
    ]),
    group({ id: "card-b", x: 0, y: 0, opacity: 0, scale: 0.85 }, [
      ellipse({ id: "b", x: 960, y: 470, width: 380, height: 380, anchor: "center", fill: radialGradient(["#9B7CFF", "#221A4A"], { cx: 0.4, cy: 0.38, r: 0.62 }) }),
      label("lb", 960, "RADIAL"),
    ]),
    group({ id: "card-c", x: 0, y: 0, opacity: 0, scale: 0.85 }, [
      path({ id: "c", x: 1540, y: 470, d: STAR, fill: conicGradient(["#00C2A8", "#3AA0FF", "#7C5CFF", "#FF5C8A", "#00C2A8"], { angle: -90 }) }),
      label("lc", 1540, "CONIC"),
    ]),

    // animated gradient: the badge spins, its linear gradient sweeps with it.
    // a gradient-stroked ring counter-rotates around it.
    ellipse({ id: "ring", x: 960, y: 905, width: 300, height: 300, anchor: "center", fill: "none", stroke: linearGradient(["#3AA0FF", "#46E5A0"], { angle: 0 }), strokeWidth: 10 }),
    rect({ id: "badge", x: 960, y: 905, width: 180, height: 180, radius: 42, anchor: "center", fill: linearGradient(["#FF4D6D", "#FFC24B"], { angle: 90 }) }),
    text({ id: "badge-cap", x: 960, y: 1054, anchor: "center", content: "the gradient sweeps because the node spins", fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: DIM }),
  ],

  timeline: seq(
    wait(0.3),
    par(
      tween("card-a", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "in-a" }),
      seq(wait(0.15), tween("card-b", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "in-b" })),
      seq(wait(0.3), tween("card-c", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "in-c" })),
    ),
    wait(0.4),
    // spin the badge (its linear gradient sweeps) + counter-spin the ring
    par(
      tween("badge", { rotation: 360 }, { duration: 3.4, ease: "easeInOutCubic", label: "spin" }),
      tween("ring", { rotation: -360 }, { duration: 3.4, ease: "easeInOutCubic" }),
    ),
    wait(0.8),
  ),

  behaviors: [
    oscillate("badge", "scale", { amplitude: 0.04, frequency: 0.8 }, { from: 1.5 }),
  ],
});
