// Spring physics easing: a damped harmonic oscillator that settles to rest within
// the tween's duration. Four pucks travel the same distance over the same time, so
// the only difference you see is the spring's shape:
//   spring        — a natural settle (ζ ≈ 0.5), a little overshoot
//   springBouncy  — low damping, rings well past the target before resting
//   springStiff   — high damping, snappy, barely overshoots
//   { spring:{…} } — a custom mass-spring with an initial launch velocity
// The dashed line marks the target; watch each puck overshoot it by a different
// amount and ring back. Additive / golden-safe (no existing scene names a spring).

import {
  scene, group, rect, ellipse, text,
  seq, par, tween, wait,
  type NodeIR, type Ease,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", FG = "#EDEFF5", DIM = "#7C859B", ACCENT = "#6EA8FF";

const START = 360; // puck launch x
const TARGET = 1480; // the settle x (dashed line)
const ROWS = [
  { id: "a", label: "spring", ease: "spring" as Ease, color: "#6EA8FF" },
  { id: "b", label: "springBouncy", ease: "springBouncy" as Ease, color: "#FF5C7A" },
  { id: "c", label: "springStiff", ease: "springStiff" as Ease, color: "#3DDC97" },
  { id: "d", label: "{ spring: velocity 6 }", ease: { spring: { stiffness: 120, damping: 9, velocity: 6 } } as Ease, color: "#F7B955" },
];
const ROW_Y = (i: number) => 300 + i * 150;

const nodes: NodeIR[] = [
  rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: BG }),
  text({ id: "title", x: 120, y: 120, anchor: "center-left", content: "spring easing", fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: FG }),
  text({ id: "sub", x: 120, y: 180, anchor: "center-left", content: "same distance, same duration — the damping ratio shapes the overshoot", fontFamily: "Inter", fontSize: 24, fontWeight: 400, fill: DIM }),
  // target marker
  rect({ id: "target-line", x: TARGET, y: 250, width: 3, height: 620, anchor: "top-center", fill: ACCENT, opacity: 0.35 }),
];

for (let i = 0; i < ROWS.length; i++) {
  const r = ROWS[i]!;
  const y = ROW_Y(i);
  nodes.push(
    group({ id: `${r.id}-row`, x: 0, y: 0 }, [
      text({ id: `${r.id}-label`, x: 120, y, anchor: "center-left", content: r.label, fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: FG }),
      ellipse({ id: `${r.id}-puck`, x: START, y, width: 64, height: 64, anchor: "center", fill: r.color, shadowColor: r.color, shadowBlur: 28 }),
    ]),
  );
}

export default scene({
  id: "spring-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes,
  timeline: seq(
    wait(0.4),
    par(
      ...ROWS.map((r) => tween(`${r.id}-puck`, { x: TARGET }, { duration: 1.6, ease: r.ease })),
    ),
    wait(1.2),
  ),
});
