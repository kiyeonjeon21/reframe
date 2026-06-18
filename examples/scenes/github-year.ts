// "Your GitHub year, in 3D" — the contribution graph as a 3D relief landscape the
// camera flies across. Busy days push toward the camera (perspective z) and glow;
// empty days sit flat and dark. Real rolling-year data for @kiyeonjeon21 (4,378
// contributions), baked in → pure/deterministic. The flight follows the year's real
// shape as a five-act arc: setup (the quiet) → ignition (December catches fire) →
// rising (the winter grind, + a 16-day-streak beat) → climax (April explodes: the
// camera dives, the 140-commit day blooms, the counter jumps) → resolution (a steady
// tail, then pull back and dolly the perspective flat into the familiar wide grid).
// A single month label travels through the year. mp4 (+ live in player).

import {
  scene, group, rect, text,
  seq, par, stagger, tween, wait, cameraTo, oscillate,
  type NodeIR, type TimelineIR,
} from "@reframe/core";
import { WEEKS, MONTHS, MAX_DAY, TOTAL, HANDLE, LONGEST_STREAK } from "./github-year/data.js";

const W = 1920, H = 1080;
const BG = "#0D1117", INK = "#E6EDF3", DIM = "#7D8590", GREEN = "#39D353";
const P = 27, TILE = 22;
const ZMAX = 430;
const EMPTY = "#161B22";
const HEAT = ["#0E4429", "#006D32", "#26A641", "#39D353"];
const THRESH = [1, 15, 45, 90];

const bucket = (c: number): number => {
  if (c <= 0) return -1;
  let b = 0;
  for (let i = 0; i < THRESH.length; i++) if (c >= THRESH[i]!) b = i;
  return b;
};
const zOf = (c: number): number => (c <= 0 ? 0 : -ZMAX * Math.sqrt(c / MAX_DAY));
const gx = (w: number) => W / 2 + (w - 26) * P;
const cum = (w: number) => WEEKS.slice(0, w + 1).flat().reduce((s, x) => s + x, 0);

// tiles (active start hidden, light up in the build; empty sit dark from the start)
interface Tile { w: number; d: number; c: number; id: string; node: NodeIR }
const tiles: Tile[] = [];
WEEKS.forEach((week, w) => week.forEach((c, d) => {
  const fill = bucket(c) < 0 ? EMPTY : HEAT[bucket(c)]!;
  const id = `t-${w}-${d}`;
  tiles.push({
    w, d, c, id,
    node: rect({
      id, x: (w - 26) * P, y: (d - 3) * P, width: TILE, height: TILE, radius: 5, anchor: "center",
      fill, z: zOf(c), opacity: c > 0 ? 0 : 1, scale: c > 0 ? 0.4 : 1,
      ...(c > 0 ? { shadowColor: fill, shadowBlur: 6 + 22 * Math.sqrt(c / MAX_DAY) } : {}),
    }),
  });
}));
const ordered = [...tiles].sort((a, b) => a.c - b.c); // paint far→near

// per-week pop (only weeks with activity); sliced into acts by week range
const weekStep = new Map<number, TimelineIR>();
for (let w = 0; w < WEEKS.length; w++) {
  const wk = tiles.filter((t) => t.w === w && t.c > 0);
  if (wk.length) weekStep.set(w, par(...wk.map((t) =>
    tween(t.id, { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" }))));
}
const actSteps = (a: number, b: number): TimelineIR[] =>
  [...weekStep.keys()].filter((w) => w >= a && w <= b).sort((x, y) => x - y).map((w) => weekStep.get(w)!);

const cam = (x: number, zoom: number, persp: number, d: number, label?: string): TimelineIR =>
  cameraTo({ x, y: H / 2, zoom, perspective: persp }, { duration: d, ease: "easeInOutCubic", ...(label ? { label } : {}) });

// single travelling month label: OCT 2025 … JUN 2026 (only labelled months from first activity)
const MLAB = MONTHS.filter((m) => m.week >= 15);
const monthNodes: NodeIR[] = MLAB.map((m, i) =>
  text({ id: `mo-${i}`, x: 96, y: 92, anchor: "center-left", content: m.label, fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }));
const monthCue = (i: number, d = 0.4): TimelineIR =>
  par(tween(`mo-${i}`, { opacity: 1 }, { duration: d }), ...(i > 0 ? [tween(`mo-${i - 1}`, { opacity: 0 }, { duration: d })] : []));

const callout = (id: string, s: string): NodeIR =>
  group({ id, x: W / 2, y: 226, scale: 0.85, opacity: 0, fixed: true }, [
    rect({ id: `${id}-bg`, x: 0, y: 0, width: 430, height: 70, radius: 35, anchor: "center", fill: "#10231A", stroke: GREEN, strokeWidth: 1.5 }),
    text({ id: `${id}-t`, x: 0, y: 0, anchor: "center", content: s, fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: GREEN }),
  ]);

export default scene({
  id: "github-year",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: gx(14), y: H / 2, zoom: 1.18, perspective: 760 },
  nodes: [
    group({ id: "grid", x: W / 2, y: H / 2, rotateX: 12 }, ordered.map((t) => t.node)),
    ...monthNodes,
    // intro title (over the empty grid, fades as the build starts)
    text({ id: "intro-title", x: W / 2, y: 430, anchor: "center", content: HANDLE, fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
    text({ id: "intro-sub", x: W / 2, y: 500, anchor: "center", content: "the last 12 months, in commits", fontFamily: "Inter", fontSize: 28, fontWeight: 500, fill: DIM, letterSpacing: 2, fixed: true, opacity: 0 }),
    callout("streak-card", `${LONGEST_STREAK}-day streak`),
    callout("peak-card", "1,225 commits in April"),
    // climax bloom flash
    rect({ id: "bloom", x: 0, y: 0, width: W, height: H, fill: GREEN, blend: "screen", fixed: true, opacity: 0 }),
    // commit counter (HUD, pinned)
    text({ id: "counter", x: W - 90, y: 90, anchor: "center-right", content: 0, contentThousands: true, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
    text({ id: "counter-l", x: W - 90, y: 134, anchor: "center-right", content: "contributions", fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: DIM, letterSpacing: 2, fixed: true, opacity: 0 }),
    // end HUD
    text({ id: "h-handle", x: W / 2, y: 838, anchor: "center", content: HANDLE, fontFamily: "Inter", fontSize: 48, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
    text({ id: "h-sub", x: W / 2, y: 898, anchor: "center", content: `${TOTAL.toLocaleString()} contributions  ·  ${LONGEST_STREAK}-day streak`, fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: GREEN, letterSpacing: 1, fixed: true, opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#39435C", fixed: true }),
  ],

  timeline: seq(
    // ── intro / the quiet ──
    wait(0.5),
    par(
      tween("intro-title", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "open" }),
      seq(wait(0.15), tween("intro-sub", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
    ),
    wait(1.3),
    par(
      tween("intro-title", { opacity: 0 }, { duration: 0.5 }),
      tween("intro-sub", { opacity: 0 }, { duration: 0.5 }),
      tween("counter", { opacity: 1 }, { duration: 0.5 }),
      tween("counter-l", { opacity: 1 }, { duration: 0.5 }),
      tween("mo-0", { opacity: 1 }, { duration: 0.5 }), // OCT
    ),

    // ── ACT 1 · setup (the quiet → first sparks, Oct–Nov) ──
    par(
      stagger(0.3, ...actSteps(15, 23)),
      cam(gx(20), 1.16, 760, 1.9, "setup"),
      tween("counter", { content: cum(23) }, { duration: 1.7, ease: "linear" }),
      seq(wait(1.0), monthCue(1)), // NOV
    ),

    // ── ACT 2 · ignition (December catches fire → January) ──
    par(
      stagger(0.17, ...actSteps(24, 32)),
      cam(gx(30), 1.22, 760, 2.1, "ignition"),
      tween("counter", { content: cum(32) }, { duration: 2.0, ease: "easeInQuad" }),
      seq(monthCue(2), wait(1.1), monthCue(3)), // DEC, JAN
    ),

    // ── ACT 3 · rising (the winter grind, Feb–Mar) + streak beat ──
    par(
      stagger(0.14, ...actSteps(33, 40)),
      cam(gx(38), 1.18, 740, 2.0, "rising"),
      tween("counter", { content: cum(40) }, { duration: 1.9, ease: "linear" }),
      seq(monthCue(4), wait(1.1), monthCue(5)), // FEB, MAR
      seq(wait(0.7),
        tween("streak-card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "streak" }),
        wait(0.9),
        tween("streak-card", { opacity: 0 }, { duration: 0.4 })),
    ),

    // ── ACT 4 · climax (April explodes): dive + bloom + counter jump ──
    par(
      stagger(0.2, ...actSteps(41, 44)),
      cam(gx(43), 1.36, 700, 1.7, "climax"),
      tween("counter", { content: cum(44) }, { duration: 1.6, ease: "easeOutQuad" }), // +1,225, fast
      monthCue(6), // APR
      seq(wait(0.55),
        par(
          tween("peak-card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" }),
          seq(tween("bloom", { opacity: 0.45 }, { duration: 0.12 }), tween("bloom", { opacity: 0 }, { duration: 0.7 })),
        )),
    ),
    wait(0.9),

    // ── ACT 5 · resolution (steady tail, May–Jun) ──
    par(
      stagger(0.12, ...actSteps(45, 52)),
      cam(gx(48), 1.1, 720, 1.6, "settle"),
      tween("counter", { content: TOTAL }, { duration: 1.5, ease: "linear" }),
      seq(monthCue(7), wait(0.8), monthCue(8)), // MAY, JUN
      tween("peak-card", { opacity: 0 }, { duration: 0.4 }),
    ),

    // ── reveal: pull back + flatten (dolly perspective) → the familiar wide grid ──
    par(
      cam(W / 2, 0.84, 4200, 2.2, "reveal"),
      seq(wait(0.6), par(
        tween("mo-8", { opacity: 0 }, { duration: 0.5 }),
        tween("h-handle", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
        seq(wait(0.15), tween("h-sub", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      )),
    ),
    wait(1.8),
  ),

  behaviors: [
    oscillate("grid", "y", { amplitude: 5, frequency: 0.12, phase: 0 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.12, fadeIn: 1.2, fadeOut: 2.2, duck: { depth: 0.3 } },
    cues: [
      { at: "open", file: "maximize_001.ogg", gain: 0.3 },
      { at: "ignition", sfx: "rise", gain: 0.34 },
      { at: "streak", file: "pluck_001.ogg", gain: 0.4 },
      { at: "climax", offset: 0.55, file: "bong_001.ogg", gain: 0.5 },
      { at: "climax", offset: 0.6, sfx: "shimmer", gain: 0.34 },
      { at: "reveal", offset: 0.8, file: "confirmation_003.ogg", gain: 0.46 },
      { at: "reveal", offset: 0.85, sfx: "shimmer", gain: 0.34 },
    ],
  },
});
