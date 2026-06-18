// "Your GitHub year, in 3D" — the contribution graph as a 3D relief landscape the
// camera flies across. Busy days push toward the camera (perspective z) and glow;
// empty days sit flat and dark. Real rolling-year data for @kiyeonjeon21 (4,378
// contributions, baked in → pure/deterministic). The build fills week-by-week as
// the camera tracks the front, banks over the spring peak, then pulls back and
// flattens (dolly perspective) into the familiar wide grid. mp4 (+ live in player).

import {
  scene, group, rect, text,
  seq, par, stagger, tween, wait, cameraTo, oscillate,
  type NodeIR, type TimelineIR,
} from "@reframe/core";
import { WEEKS, MAX_DAY, TOTAL, HANDLE, LONGEST_STREAK } from "./github-year/data.js";

const W = 1920, H = 1080;
const BG = "#0D1117", INK = "#E6EDF3", DIM = "#7D8590";
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
const gx = (w: number) => W / 2 + (w - 26) * P; // scene-x of week w (grid centred)

// flatten tiles, tag active vs empty
interface Tile { w: number; d: number; c: number; id: string; node: NodeIR }
const tiles: Tile[] = [];
WEEKS.forEach((week, w) => week.forEach((c, d) => {
  const b = bucket(c);
  const fill = b < 0 ? EMPTY : HEAT[b]!;
  const id = `t-${w}-${d}`;
  tiles.push({
    w, d, c, id,
    node: rect({
      id, x: (w - 26) * P, y: (d - 3) * P, width: TILE, height: TILE, radius: 5, anchor: "center",
      fill, z: zOf(c),
      // active tiles start hidden (light up in the build); empty tiles sit dark from the start
      opacity: c > 0 ? 0 : 1,
      scale: c > 0 ? 0.4 : 1,
      ...(c > 0 ? { shadowColor: fill, shadowBlur: 6 + 22 * Math.sqrt(c / MAX_DAY) } : {}),
    }),
  });
}));
// paint far→near (empty/low z first, busy near-camera tiles last/on top)
const ordered = [...tiles].sort((a, b) => a.c - b.c);

// build stagger: one step per week (its active tiles pop together)
const activeByWeek: TimelineIR[] = [];
for (let w = 0; w < WEEKS.length; w++) {
  const wk = tiles.filter((t) => t.w === w && t.c > 0);
  if (wk.length === 0) continue;
  activeByWeek.push(par(...wk.map((t) =>
    tween(t.id, { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" }))));
}

const cam = (x: number, zoom: number, persp: number, d: number, label?: string): TimelineIR =>
  cameraTo({ x, y: H / 2, zoom, perspective: persp }, { duration: d, ease: "easeInOutCubic", ...(label ? { label } : {}) });

export default scene({
  id: "github-year",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: gx(8), y: H / 2, zoom: 1.18, perspective: 760 },
  nodes: [
    group({ id: "grid", x: W / 2, y: H / 2, rotateX: 12 }, ordered.map((t) => t.node)),
    // intro title (over the empty grid, fades as the build starts)
    text({ id: "intro-title", x: W / 2, y: 430, anchor: "center", content: HANDLE, fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
    text({ id: "intro-sub", x: W / 2, y: 500, anchor: "center", content: "the last 12 months, in commits", fontFamily: "Inter", fontSize: 28, fontWeight: 500, fill: DIM, letterSpacing: 2, fixed: true, opacity: 0 }),
    // peak callout (pops over the spring ridge)
    group({ id: "peak-card", x: W / 2, y: 232, scale: 0.85, opacity: 0, fixed: true }, [
      rect({ id: "peak-bg", x: 0, y: 0, width: 430, height: 70, radius: 35, anchor: "center", fill: "#10231A", stroke: "#39D353", strokeWidth: 1.5 }),
      text({ id: "peak-t", x: 0, y: 0, anchor: "center", content: "1,225 commits in April", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: "#39D353" }),
    ]),
    // commit counter (HUD, pinned)
    text({ id: "counter", x: W - 90, y: 90, anchor: "center-right", content: 0, contentThousands: true, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
    text({ id: "counter-l", x: W - 90, y: 134, anchor: "center-right", content: "contributions", fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: DIM, letterSpacing: 2, fixed: true, opacity: 0 }),
    // end HUD
    text({ id: "h-handle", x: W / 2, y: 838, anchor: "center", content: HANDLE, fontFamily: "Inter", fontSize: 48, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
    text({ id: "h-sub", x: W / 2, y: 898, anchor: "center", content: `${TOTAL.toLocaleString()} contributions  ·  ${LONGEST_STREAK}-day streak`, fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: "#39D353", letterSpacing: 1, fixed: true, opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#39435C", fixed: true }),
  ],

  timeline: seq(
    // intro: title holds over the empty grid
    wait(0.5),
    par(
      tween("intro-title", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "open" }),
      seq(wait(0.15), tween("intro-sub", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
    ),
    wait(1.5),
    par(
      tween("intro-title", { opacity: 0 }, { duration: 0.5 }),
      tween("intro-sub", { opacity: 0 }, { duration: 0.5 }),
      tween("counter", { opacity: 1 }, { duration: 0.5 }),
      tween("counter-l", { opacity: 1 }, { duration: 0.5 }),
    ),
    // build: weeks light up left→right while the camera tracks the front + counts up
    par(
      stagger(0.12, ...activeByWeek),
      tween("counter", { content: TOTAL }, { duration: activeByWeek.length * 0.12, ease: "linear", label: "build" }),
      cam(gx(46), 1.1, 760, activeByWeek.length * 0.12 + 0.4, "track"),
    ),
    wait(0.4),
    // bank over the spring peak + the callout pops
    par(
      cam(gx(44), 1.28, 700, 1.1, "ridge"),
      seq(wait(0.4), tween("peak-card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" })),
    ),
    wait(1.3),
    // pull back + flatten (dolly perspective) → the familiar wide grid resolves
    par(
      cam(W / 2, 0.84, 4200, 2.0, "reveal"),
      tween("peak-card", { opacity: 0 }, { duration: 0.5 }),
      seq(wait(0.7), par(
        tween("h-handle", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
        seq(wait(0.15), tween("h-sub", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      )),
    ),
    wait(1.8),
  ),

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.12, fadeIn: 1.2, fadeOut: 2.2, duck: { depth: 0.3 } },
    cues: [
      { at: "open", file: "maximize_001.ogg", gain: 0.3 },
      { at: "build", sfx: "rise", gain: 0.34 },
      { at: "ridge", file: "pluck_001.ogg", gain: 0.4 },
      { at: "ridge", offset: 0.4, sfx: "shimmer", gain: 0.3 },
      { at: "reveal", offset: 0.8, file: "confirmation_003.ogg", gain: 0.46 },
      { at: "reveal", offset: 0.85, sfx: "shimmer", gain: 0.34 },
    ],
  },

  behaviors: [
    oscillate("grid", "y", { amplitude: 5, frequency: 0.12, phase: 0 }),
  ],
});
