import {
  scene,
  group,
  rect,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  cameraTo,
  linearGradient,
  type NodeIR,
  type Paint,
} from "@reframe/core";

// "Spin" — probing the projected-2.5D edge: `rotateY` + `camera.perspective`.
// A hero panel does a full 360° rotateY (front → edge-on at 90° → back → front),
// and three feature cards flip 0→180 in sequence to reveal their backs. It's an
// AFFINE APPROXIMATION (cos-foreshorten + keystone), not true 3D — convincing
// near 0°/180°, thinning to nothing edge-on. Probes where that reads vs breaks.

const W = 1920, H = 1080;
const FG = "#EAF0FF", DIM = "#8B93A7";

const card = (id: string, x: number, y: number, w: number, h: number, fill: Paint, opacity = 0): NodeIR =>
  rect({ id, x, y, width: w, height: h, radius: 22, anchor: "center", fill, rotateY: 0, opacity });

const FEATURES = [
  { id: "f0", x: 480, hue: "#6EA8FF", front: "DRAW", back: "vector" },
  { id: "f1", x: 960, hue: "#54D6C0", front: "TWEEN", back: "deterministic" },
  { id: "f2", x: 1440, hue: "#FF8FB0", front: "RENDER", back: "mp4" },
];

export default scene({
  id: "faux-3d-cards",
  size: { width: W, height: H },
  fps: 30,
  background: "#0A0E1A",
  camera: { x: W / 2, y: H / 2, perspective: 1000 },
  nodes: [
    text({ id: "title", x: 960, y: 150, anchor: "center", content: "ROTATE", fontFamily: "Inter", fontSize: 60, fontWeight: 800, fill: FG, letterSpacing: 10, opacity: 0 }),
    // hero panel that spins a full turn
    card("hero", 960, 400, 360, 240, linearGradient(["#7C5CFF", "#FF3D81"], { angle: 120 })),
    text({ id: "hero-t", x: 960, y: 400, anchor: "center", content: "360°", fontFamily: "Inter", fontSize: 72, fontWeight: 800, fill: "#FFFFFF", rotateY: 0, opacity: 0 }),
    // three feature cards (front faces); backs are separate nodes flipped in behind
    ...FEATURES.flatMap((f): NodeIR[] => [
      card(`${f.id}-front`, f.x, 800, 300, 200, linearGradient([f.hue, "#1A2030"], { angle: 90 })),
      text({ id: `${f.id}-ft`, x: f.x, y: 800, anchor: "center", content: f.front, fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: "#FFFFFF", rotateY: 0, opacity: 0 }),
    ]),
    text({ id: "cap", x: 960, y: 1010, anchor: "center", content: "rotateY · projected 2.5D · affine approximation (not true 3D)", fontFamily: "Inter", fontSize: 24, fill: DIM, letterSpacing: 3, opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    par(
      tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "title" }),
      tween("cap", { opacity: 1 }, { duration: 0.5 }),
      tween("hero", { opacity: 1 }, { duration: 0.4 }),
      seq(wait(0.2), tween("hero-t", { opacity: 1 }, { duration: 0.3 })),
    ),
    // hero spins a full turn — passes through edge-on at 90° and shows the "back"
    par(
      tween("hero", { rotateY: 360 }, { duration: 2.2, ease: "easeInOutCubic", label: "spin" }),
      tween("hero-t", { rotateY: 360 }, { duration: 2.2, ease: "easeInOutCubic" }),
    ),
    wait(0.3),
    // feature cards flip in sequence (0→180), revealing the back label
    par(
      tween("cap", { opacity: 1 }, { duration: 0.3 }),
      stagger(0.25, ...FEATURES.flatMap((f) => [
        par(
          tween(`${f.id}-front`, { opacity: 1, rotateY: 180 }, { duration: 0.9, ease: "easeInOutCubic", label: `flip-${f.id}` }),
          seq(tween(`${f.id}-ft`, { opacity: 1 }, { duration: 0.2 }), tween(`${f.id}-ft`, { rotateY: 180, content: f.back, fontSize: 30 }, { duration: 0.7, ease: "easeInOutCubic" })),
        ),
      ])),
    ),
    wait(1.0, "hold"),
    // dolly out to flatten the depth
    cameraTo({ perspective: 2600 }, { duration: 1.2, ease: "easeInOutCubic", label: "dolly" }),
    wait(0.4),
    par(
      tween("hero", { opacity: 0 }, { duration: 0.5 }),
      tween("hero-t", { opacity: 0 }, { duration: 0.5 }),
      tween("title", { opacity: 0 }, { duration: 0.5 }),
      tween("cap", { opacity: 0 }, { duration: 0.5 }),
      ...FEATURES.flatMap((f) => [tween(`${f.id}-front`, { opacity: 0 }, { duration: 0.5 }), tween(`${f.id}-ft`, { opacity: 0 }, { duration: 0.5 })]),
    ),
  ),
});
