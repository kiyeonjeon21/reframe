import {
  scene,
  path,
  text,
  seq,
  par,
  tween,
  wait,
  oscillate,
  linearGradient,
} from "@reframe/core";

// "Morph" — probing `tween(id, { d })` vertex-by-vertex path morphing. Every
// shape is a closed path with the SAME command structure (M + 8 cubic segments
// + Z), generated from a radii array, so they're morph-COMPATIBLE — the engine
// blends control points. Cycles circle → star → flower → gem → back. (The known
// limit: arc `A` commands can't morph and snap at 50% — documented separately.)

const CX = 960;
const CY = 500;
const K = 8;

// smooth closed path through K radial points (Catmull-Rom → cubic Béziers).
// Same K → same command sequence → morph-compatible.
const blob = (radii: number[]): string => {
  const pt = (i: number): [number, number] => {
    const r = radii[((i % K) + K) % K]!;
    const a = (i / K) * Math.PI * 2 - Math.PI / 2;
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
  };
  let d = `M ${pt(0)[0].toFixed(1)} ${pt(0)[1].toFixed(1)}`;
  for (let i = 0; i < K; i++) {
    const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2);
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + " Z";
};

const R = 230;
const SHAPES: { name: string; d: string }[] = [
  { name: "circle", d: blob(Array(K).fill(R)) },
  { name: "star", d: blob(Array.from({ length: K }, (_, i) => (i % 2 ? R * 0.5 : R))) },
  { name: "flower", d: blob(Array.from({ length: K }, (_, i) => R * (0.78 + 0.22 * Math.cos(i * 2)))) },
  { name: "gem", d: blob([R, R * 0.62, R * 0.95, R * 0.62, R, R * 0.62, R * 0.95, R * 0.62]) },
];

export default scene({
  id: "shape-morph",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0612",
  nodes: [
    path({
      id: "shape",
      x: 0,
      y: 0,
      d: SHAPES[0]!.d,
      fill: linearGradient(["#7C5CFF", "#FF3D81", "#FFC861"], { angle: 120 }),
      originX: CX,
      originY: CY,
      opacity: 0,
      scale: 0.7,
    }),
    text({ id: "name", x: CX, y: 860, anchor: "center", content: SHAPES[0]!.name, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: "#EAF0FF", letterSpacing: 6, opacity: 0 }),
    text({ id: "cap", x: CX, y: 930, anchor: "center", content: "one path · 8 cubic segments · tween(d) morph", fontFamily: "Inter", fontSize: 24, fill: "#7E88A8", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    par(
      tween("shape", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "in" }),
      tween("name", { opacity: 1 }, { duration: 0.5 }),
      tween("cap", { opacity: 1 }, { duration: 0.5 }),
    ),
    wait(0.6),
    // morph through the cycle, name swaps at each hold
    ...SHAPES.slice(1).flatMap((s, i) => [
      par(
        tween("shape", { d: s.d }, { duration: 0.8, ease: "easeInOutCubic", label: `morph-${i}` }),
        seq(
          tween("name", { opacity: 0 }, { duration: 0.2 }),
          tween("name", { content: s.name, opacity: 1 }, { duration: 0.3 }),
        ),
      ),
      wait(0.7),
    ]),
    // morph back to circle to close the loop
    par(
      tween("shape", { d: SHAPES[0]!.d }, { duration: 0.8, ease: "easeInOutCubic", label: "loop" }),
      seq(tween("name", { opacity: 0 }, { duration: 0.2 }), tween("name", { content: "circle", opacity: 1 }, { duration: 0.3 })),
    ),
    wait(0.8, "hold"),
    par(
      tween("shape", { opacity: 0, scale: 0.7 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("name", { opacity: 0 }, { duration: 0.5 }),
      tween("cap", { opacity: 0 }, { duration: 0.5 }),
    ),
  ),

  behaviors: [
    oscillate("shape", "rotation", { amplitude: 8, frequency: 0.2 }, { from: 0.9, until: 6.5, ramp: 0.6 }),
  ],
});
