import {
  scene,
  group,
  ellipse,
  text,
  seq,
  par,
  to,
  tween,
  wait,
  oscillate,
  type BehaviorIR,
} from "@reframe/core";

// "Wavefield" — physical interference, computed at authoring time. A 32×18
// dot grid carries two ripples whose phase is each dot's distance from its
// source; where the windows overlap, real interference patterns emerge.
// No per-frame math at runtime: 1,152 phase-shifted oscillators are just data.

const COLS = 32;
const ROWS = 18;
const GAP = 46;
const CX = 960;
const CY = 480;
const X0 = CX - ((COLS - 1) * GAP) / 2;
const Y0 = CY - ((ROWS - 1) * GAP) / 2;

// two ripple sources, in grid coordinates
const SRC_A = { x: X0 + 8 * GAP, y: Y0 + 9 * GAP };
const SRC_B = { x: X0 + 23 * GAP, y: Y0 + 8 * GAP };

const hexOf = (c: number[]) =>
  `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: number[], b: number[], u: number) => a.map((v, i) => v + (b[i]! - v) * u);

// column-major declaration so the entrance stagger sweeps left → right
const dots = Array.from({ length: COLS }, (_, c) =>
  Array.from({ length: ROWS }, (_, r) => {
    const x = X0 + c * GAP;
    const y = Y0 + r * GAP;
    const dA = Math.hypot(x - SRC_A.x, y - SRC_A.y);
    const dB = Math.hypot(x - SRC_B.x, y - SRC_B.y);
    return {
      id: `d-${c}-${r}`,
      x,
      y,
      dA,
      dB,
      fill: hexOf(mix([91, 140, 255], [126, 224, 184], c / (COLS - 1))),
    };
  }),
).flat();

const WAVE_HZ = 0.8;
const PHASE_PER_PX = 0.011; // spatial frequency of the ripples

export default scene({
  id: "wavefield",
  size: { width: 1920, height: 1080 },
  fps: 30,
  duration: 13,
  background: "#07080C",
  nodes: [
    group({ id: "grid", x: 0, y: 0 }, [
      ...dots.map((d) =>
        ellipse({ id: d.id, x: d.x, y: d.y, width: 9, height: 9, anchor: "center", fill: d.fill, opacity: 0, scale: 0.2 }),
      ),
    ]),
    text({ id: "cap1", x: 200, y: 950, content: "one ripple", fontFamily: "Inter", fontSize: 24, fill: "#8B93A7", opacity: 0 }),
    text({ id: "cap2", x: 200, y: 950, content: "two ripples — interference", fontFamily: "Inter", fontSize: 24, fill: "#FFFFFF", opacity: 0 }),
    text({ id: "cap3", x: 200, y: 998, content: "1,152 phase-shifted oscillators · zero runtime math · pure functions of t", fontFamily: "Inter", fontSize: 19, fill: "#5A6275", opacity: 0 }),
  ],

  states: {
    on: Object.fromEntries(dots.map((d) => [d.id, { opacity: 0.9, scale: 1 }])),
    off: Object.fromEntries(dots.map((d) => [d.id, { opacity: 0, scale: 0.2 }])),
  },

  timeline: seq(
    wait(0.3),
    // left→right sweep-in (declaration order is column-major)
    to("on", { duration: 0.4, ease: "easeOutCubic", stagger: 0.0035, label: "sweep-in" }),
    wait(0.2),
    tween("cap1", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
    wait(2.6),
    par(
      tween("cap1", { opacity: 0 }, { duration: 0.3, ease: "easeInQuad" }),
      seq(wait(0.2), tween("cap2", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" })),
      seq(wait(0.5), tween("cap3", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" })),
    ),
    wait(5.4),
    par(
      to("off", { duration: 0.4, ease: "easeInCubic", stagger: 0.0035, label: "sweep-out" }),
      tween("cap2", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }),
      tween("cap3", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // ripple A runs alone first…
    ...dots.map(
      (d): BehaviorIR =>
        oscillate(d.id, "scale", { amplitude: 0.5, frequency: WAVE_HZ, phase: -d.dA * PHASE_PER_PX }, { from: 2.4, until: 11.4, ramp: 0.8 }),
    ),
    // …ripple B joins later — the overlap region becomes an interference field
    ...dots.map(
      (d): BehaviorIR =>
        oscillate(d.id, "scale", { amplitude: 0.5, frequency: WAVE_HZ, phase: -d.dB * PHASE_PER_PX }, { from: 5.2, until: 11.4, ramp: 0.8 }),
    ),
  ],
});
