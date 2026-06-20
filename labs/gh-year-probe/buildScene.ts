// Data-agnostic "GitHub year in 3D" generator: turns ANY handle's contribution
// data into the flythrough SceneIR. The flagship `examples/scenes/github-year.ts`
// is hand-tuned to one person's year (a bespoke five-act narrative); this is the
// generalized probe version — it DERIVES the arc from the data: split the active
// range into acts, find the busiest month for the dive + callout, track the camera
// along the activity, tick the counter, travel the month label, end on a flat grid.
// Pure function of the data → deterministic render. Not shipped to npm.

import {
  scene, group, rect, text,
  seq, par, stagger, tween, wait, cameraTo, oscillate,
  type NodeIR, type TimelineIR, type SceneIR,
} from "@reframe/core";

/** The shape the scene consumes — produced by scrape.mts for any handle. */
export interface GitHubYearData {
  handle: string; // "@octocat"
  total: number;
  maxDay: number;
  longestStreak: number;
  busiest: string; // "Apr 19"
  weeks: number[][]; // [week][weekday 0=Sun..6=Sat] = contribution count
  months: { label: string; week: number }[]; // "APR 2026" → starting week index
}

const W = 1920, H = 1080;
const BG = "#0D1117", INK = "#E6EDF3", DIM = "#7D8590", GREEN = "#39D353";
const P = 27, TILE = 22, ZMAX = 430;
const EMPTY = "#161B22";
const HEAT = ["#0E4429", "#006D32", "#26A641", "#39D353"];
const THRESH = [1, 15, 45, 90];

const bucket = (c: number): number => {
  if (c <= 0) return -1;
  let b = 0;
  for (let i = 0; i < THRESH.length; i++) if (c >= THRESH[i]!) b = i;
  return b;
};

// centre the grid on the busiest column so the sweep stays roughly framed
export function buildGitHubYear(data: GitHubYearData): SceneIR {
  const { weeks, months, total, maxDay, longestStreak, handle } = data;
  const nWeeks = weeks.length;
  const mid = Math.floor(nWeeks / 2);
  const zOf = (c: number): number => (c <= 0 ? 0 : -ZMAX * Math.sqrt(c / Math.max(1, maxDay)));
  const gx = (w: number) => W / 2 + (w - mid) * P;
  const weekSum = (w: number) => (weeks[w] ?? []).reduce((s, x) => s + x, 0);
  const cum = (w: number) => weeks.slice(0, w + 1).flat().reduce((s, x) => s + x, 0);

  // active range + busiest week/month (drives acts, camera, the dive)
  const activeWeeks = weeks.map((_, w) => w).filter((w) => weekSum(w) > 0);
  const firstW = activeWeeks[0] ?? 0;
  const lastW = activeWeeks[activeWeeks.length - 1] ?? nWeeks - 1;
  let peakW = firstW;
  for (let w = firstW; w <= lastW; w++) if (weekSum(w) > weekSum(peakW)) peakW = w;
  // which month owns the peak week, and that month's total
  const monthOfWeek = (w: number) => {
    let m = months[0];
    for (const mo of months) if (mo.week <= w) m = mo;
    return m;
  };
  const peakMonth = monthOfWeek(peakW);
  const peakMonthName = (peakMonth?.label ?? "").split(" ")[0] ?? "";
  const peakMonthTotal = peakMonth
    ? weeks.reduce((s, wk, w) => (monthOfWeek(w) === peakMonth ? s + weekSum(w) : s), 0)
    : 0;

  // tiles (active start hidden + small, light up in the build; empty sit dark)
  interface Tile { w: number; c: number; id: string; node: NodeIR }
  const tiles: Tile[] = [];
  weeks.forEach((week, w) => week.forEach((c, d) => {
    const fill = bucket(c) < 0 ? EMPTY : HEAT[bucket(c)]!;
    const id = `t-${w}-${d}`;
    tiles.push({
      w, c, id,
      node: rect({
        id, x: (w - mid) * P, y: (d - 3) * P, width: TILE, height: TILE, radius: 5, anchor: "center",
        fill, z: zOf(c), opacity: c > 0 ? 0 : 1, scale: c > 0 ? 0.4 : 1,
        ...(c > 0 ? { shadowColor: fill, shadowBlur: 6 + 22 * Math.sqrt(c / Math.max(1, maxDay)) } : {}),
      }),
    });
  }));
  const ordered = [...tiles].sort((a, b) => a.c - b.c); // paint far→near

  // per-week pop, only weeks with activity
  const weekStep = new Map<number, TimelineIR>();
  for (let w = 0; w < nWeeks; w++) {
    const wk = tiles.filter((t) => t.w === w && t.c > 0);
    if (wk.length) weekStep.set(w, par(...wk.map((t) =>
      tween(t.id, { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" }))));
  }
  const stepsIn = (a: number, b: number): TimelineIR[] =>
    [...weekStep.keys()].filter((w) => w >= a && w <= b).sort((x, y) => x - y).map((w) => weekStep.get(w)!);

  // split the active span into up to 5 acts; the act holding the peak week dives + blooms
  const span = Math.max(1, lastW - firstW);
  const N_ACTS = Math.min(5, Math.max(1, activeWeeks.length));
  const acts = Array.from({ length: N_ACTS }, (_, i) => {
    const a = Math.round(firstW + (span * i) / N_ACTS);
    const b = i === N_ACTS - 1 ? lastW : Math.round(firstW + (span * (i + 1)) / N_ACTS) - 1;
    return { a, b, peak: peakW >= a && peakW <= b };
  });

  // month labels travel through the year (only labelled from the first active month)
  const mLab = months.filter((m) => m.week >= firstW - 1);
  const monthNodes: NodeIR[] = mLab.map((m, i) =>
    text({ id: `mo-${i}`, x: 96, y: 92, anchor: "center-left", content: m.label, fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }));
  const monthCuesIn = (a: number, b: number): TimelineIR[] => {
    const out: TimelineIR[] = [];
    mLab.forEach((m, i) => {
      if (m.week >= a && m.week <= b) {
        out.push(par(
          tween(`mo-${i}`, { opacity: 1 }, { duration: 0.4 }),
          ...(i > 0 ? [tween(`mo-${i - 1}`, { opacity: 0 }, { duration: 0.4 })] : []),
        ));
      }
    });
    return out;
  };

  const callout = (id: string, s: string): NodeIR =>
    group({ id, x: W / 2, y: 226, scale: 0.85, opacity: 0, fixed: true }, [
      rect({ id: `${id}-bg`, x: 0, y: 0, width: 460, height: 70, radius: 35, anchor: "center", fill: "#10231A", stroke: GREEN, strokeWidth: 1.5 }),
      text({ id: `${id}-t`, x: 0, y: 0, anchor: "center", content: s, fontFamily: "Inter", fontSize: 28, fontWeight: 700, fill: GREEN }),
    ]);

  const cam = (x: number, zoom: number, persp: number, d: number, label?: string): TimelineIR =>
    cameraTo({ x, y: H / 2, zoom, perspective: persp }, { duration: d, ease: "easeInOutCubic", ...(label ? { label } : {}) });

  // the act timeline — one par per act: weeks pop (staggered), camera tracks, counter ticks,
  // months label; the peak act dives + blooms + shows the peak callout.
  const streakAct = Math.floor(N_ACTS / 2); // streak beat lands mid-arc
  const actTimeline: TimelineIR[] = acts.map((act, i) => {
    const dur = act.peak ? 1.7 : 2.0;
    const zoom = act.peak ? 1.36 : 1.18;
    const persp = act.peak ? 700 : 760;
    const parts: TimelineIR[] = [
      stagger(act.peak ? 0.2 : 0.16, ...stepsIn(act.a, act.b)),
      cam(gx(act.b), zoom, persp, dur, i === 0 ? "setup" : act.peak ? "climax" : `act-${i}`),
      tween("counter", { content: cum(act.b) }, { duration: dur - 0.1, ease: act.peak ? "easeOutQuad" : "linear" }),
      ...monthCuesIn(act.a, act.b),
    ];
    if (act.peak && peakMonthTotal > 0) {
      parts.push(seq(wait(0.5), par(
        tween("peak-card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" }),
        seq(tween("bloom", { opacity: 0.45 }, { duration: 0.12 }), tween("bloom", { opacity: 0 }, { duration: 0.7 })),
      )));
    }
    if (i === streakAct && longestStreak > 1) {
      parts.push(seq(wait(0.6),
        tween("streak-card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "streak" }),
        wait(0.9), tween("streak-card", { opacity: 0 }, { duration: 0.4 })));
    }
    return par(...parts);
  });
  // drop the peak card shortly after its act
  const peakIdx = acts.findIndex((a) => a.peak);

  return scene({
    id: "github-year-gen",
    size: { width: W, height: H },
    fps: 30,
    background: BG,
    camera: { x: gx(firstW), y: H / 2, zoom: 1.18, perspective: 760 },
    nodes: [
      group({ id: "grid", x: W / 2, y: H / 2, rotateX: 12 }, ordered.map((t) => t.node)),
      ...monthNodes,
      text({ id: "intro-title", x: W / 2, y: 430, anchor: "center", content: handle, fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
      text({ id: "intro-sub", x: W / 2, y: 500, anchor: "center", content: "the last 12 months, in commits", fontFamily: "Inter", fontSize: 28, fontWeight: 500, fill: DIM, letterSpacing: 2, fixed: true, opacity: 0 }),
      callout("streak-card", `${longestStreak}-day streak`),
      callout("peak-card", `${peakMonthTotal.toLocaleString()} commits in ${peakMonthName}`),
      rect({ id: "bloom", x: 0, y: 0, width: W, height: H, fill: GREEN, blend: "screen", fixed: true, opacity: 0 }),
      text({ id: "counter", x: W - 90, y: 90, anchor: "center-right", content: 0, contentThousands: true, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
      text({ id: "counter-l", x: W - 90, y: 134, anchor: "center-right", content: "contributions", fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: DIM, letterSpacing: 2, fixed: true, opacity: 0 }),
      text({ id: "h-handle", x: W / 2, y: 838, anchor: "center", content: handle, fontFamily: "Inter", fontSize: 48, fontWeight: 800, fill: INK, fixed: true, opacity: 0 }),
      text({ id: "h-sub", x: W / 2, y: 898, anchor: "center", content: `${total.toLocaleString()} contributions  ·  ${longestStreak}-day streak`, fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: GREEN, letterSpacing: 1, fixed: true, opacity: 0 }),
      text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#39435C", fixed: true }),
    ],
    timeline: seq(
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
        ...(monthNodes.length ? [tween("mo-0", { opacity: 1 }, { duration: 0.5 })] : []),
      ),
      // derived acts
      ...actTimeline.map((act, i) =>
        i === peakIdx + 1
          ? par(act, tween("peak-card", { opacity: 0 }, { duration: 0.4 }))
          : act),
      wait(0.6),
      // reveal: pull back + flatten the perspective into the familiar wide grid
      par(
        cam(W / 2, 0.84, 4200, 2.2, "reveal"),
        // make sure the transient callouts are gone (the peak card may belong to the last act)
        tween("peak-card", { opacity: 0 }, { duration: 0.4 }),
        ...(monthNodes.length ? [tween(`mo-${mLab.length - 1}`, { opacity: 0 }, { duration: 0.5 })] : []),
        seq(wait(0.6), par(
          tween("h-handle", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
          seq(wait(0.15), tween("h-sub", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
        )),
      ),
      wait(1.8),
    ),
    behaviors: [oscillate("grid", "y", { amplitude: 5, frequency: 0.12, phase: 0 })],
    audio: {
      bgm: { synth: "ambient-pad", gain: 0.12, fadeIn: 1.2, fadeOut: 2.2, duck: { depth: 0.3 } },
      cues: [
        { at: "open", file: "maximize_001.ogg", gain: 0.3 },
        ...(longestStreak > 1 ? [{ at: "streak", file: "pluck_001.ogg", gain: 0.4 } as const] : []),
        { at: "climax", offset: 0.55, file: "bong_001.ogg", gain: 0.5 },
        { at: "climax", offset: 0.6, sfx: "shimmer", gain: 0.34 },
        { at: "reveal", offset: 0.8, file: "confirmation_003.ogg", gain: 0.46 },
        { at: "reveal", offset: 0.85, sfx: "shimmer", gain: 0.34 },
      ],
    },
  });
}
