import {
  scene, group, rect, ellipse, line, path, text,
  seq, par, stagger, beat, tween, wait, cameraTo, cameraFit, oscillate, row,
  conicGradient,
  type NodeIR,
} from "@reframe/core";

// "FY2026" — an animated annual report as a guided camera tour of one dashboard:
// KPI count-ups → a bar chart (grow from base) → a growth line that DRAWS ON
// (`path` `progress`) → a market-share donut (`conicGradient`). Two patterns keep
// it tidy: (1) chart geometry is DERIVED FROM the panel rect (heights normalized to
// max → never overflow) and each chart sits in a `group({ clip })` (a safety net so
// nothing can punch out the panel); (2) every camera push uses `cameraFit(box)` so
// the widget is framed without clipping. Probes: multi-chart orchestration + the
// conic-gradient donut + count-ups + container-safe layout + camera framing.

const W = 1920, H = 1080;
const FG = "#EAF0FF", DIM = "#7E88A8", GRID = "#1E2740", TEAL = "#54D6C0", VIOLET = "#7C5CFF", PINK = "#FF6FA5", GOLD = "#FFC861";

// panel rect helper — keeps each widget's bounding box in ONE place, reused for the
// node, its clip, and the cameraFit push (so they can never drift apart).
interface Box { x: number; y: number; width: number; height: number }
const cx = (b: Box) => b.x + b.width / 2;
const cy = (b: Box) => b.y + b.height / 2;
const panel = (id: string, b: Box): NodeIR =>
  rect({ id, x: cx(b), y: cy(b), width: b.width, height: b.height, radius: 18, anchor: "center", fill: "#0E1426", stroke: GRID, strokeWidth: 1.5, opacity: 0 });
const clip = (b: Box, pad = 0) => ({ kind: "rect" as const, x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad, radius: 18 });

// open-beat framing spans the header (title at y~110) + the KPI row, so the title
// is never clipped on the first zoom. Bottom row = three equal chart panels.
const OPEN_BOX: Box = { x: 120, y: 100, width: 1610, height: 370 };
const BAR_BOX: Box = { x: 80, y: 600, width: 540, height: 360 };
const LINE_BOX: Box = { x: 690, y: 600, width: 540, height: 360 };
const DONUT_BOX: Box = { x: 1300, y: 600, width: 540, height: 360 };

// ── KPIs ──
const KPIS = [
  { id: "k-rev", x: 430, label: "REVENUE", val: 24.8, pre: "$", suf: "M", dec: 1, c: TEAL },
  { id: "k-usr", x: 960, label: "ACTIVE USERS", val: 1480000, pre: "", suf: "", dec: 0, c: VIOLET, thou: true },
  { id: "k-nps", x: 1490, label: "NPS", val: 72, pre: "", suf: "", dec: 0, c: GOLD },
];

// ── bar chart: geometry DERIVED from BAR_BOX so it can't overflow ──
const BARS = [38, 52, 61, 84];
const BMAX = Math.max(...BARS);
const BAR_BASE = BAR_BOX.y + BAR_BOX.height - 56;     // baseline (room for labels)
const BAR_MAXH = BAR_BOX.height - 120;                // top headroom (title + margin)
const barX = row(BARS.length, { center: cx(BAR_BOX), span: BAR_BOX.width - 200 });
const barH = (v: number) => (v / BMAX) * BAR_MAXH;
const bars: NodeIR[] = BARS.flatMap((v, i) => [
  rect({ id: `bar-${i}`, x: barX[i]!, y: BAR_BASE, width: 64, height: barH(v), radius: 8, anchor: "bottom-center", fill: i === 3 ? TEAL : "#2E3E5E", scaleY: 0 }),
  text({ id: `blab-${i}`, x: barX[i]!, y: BAR_BASE + 30, anchor: "center", content: ["Q1", "Q2", "Q3", "Q4"][i]!, fontFamily: "Inter", fontSize: 22, fill: DIM, opacity: 0 }),
]);

// ── growth line: points NORMALIZED into LINE_BOX (low→high maps to bottom→top) ──
const SERIES = [12, 18, 16, 27, 31, 44, 52];
const SMAX = Math.max(...SERIES), SMIN = Math.min(...SERIES);
const lx = row(SERIES.length, { center: cx(LINE_BOX), span: LINE_BOX.width - 140 });
const ly = (v: number) => (LINE_BOX.y + LINE_BOX.height - 70) - ((v - SMIN) / (SMAX - SMIN)) * (LINE_BOX.height - 150);
const linePath = "M" + SERIES.map((v, i) => `${lx[i]!.toFixed(1)} ${ly(v).toFixed(1)}`).join(" L");
const lineDots: NodeIR[] = SERIES.map((v, i) => ellipse({ id: `ld-${i}`, x: lx[i]!, y: ly(v), width: 12, height: 12, anchor: "center", fill: PINK, opacity: 0 }));

export default scene({
  id: "annual-report",
  size: { width: W, height: H },
  fps: 30,
  background: "#070B16",
  camera: { x: W / 2, y: H / 2, zoom: 0.82 },
  nodes: [
    text({ id: "title", x: 120, y: 110, anchor: "top-left", content: "FY2026 — ANNUAL REPORT", fontFamily: "Inter", fontSize: 46, fontWeight: 800, fill: FG, letterSpacing: 2, opacity: 0 }),
    // KPI panels
    ...KPIS.flatMap((k) => [
      panel(`${k.id}-p`, { x: k.x - 240, y: 250, width: 480, height: 220 }),
      text({ id: `${k.id}-l`, x: k.x, y: 318, anchor: "center", content: k.label, fontFamily: "Inter", fontSize: 24, fontWeight: 700, fill: DIM, letterSpacing: 2, opacity: 0 }),
      text({ id: k.id, x: k.x, y: 392, anchor: "center", content: 0, contentDecimals: k.dec, prefix: k.pre, suffix: k.suf, ...(k.thou ? { contentThousands: true } : {}), fontFamily: "Inter", fontSize: 78, fontWeight: 800, fill: k.c, opacity: 0 }),
    ]),
    // bar widget — panel + a CLIPPED group so bars/labels can never escape it
    panel("bar-p", BAR_BOX),
    text({ id: "bar-t", x: BAR_BOX.x + 30, y: BAR_BOX.y + 36, anchor: "center-left", content: "Revenue by quarter", fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: FG, opacity: 0 }),
    group({ id: "bar-clip", x: 0, y: 0, clip: clip(BAR_BOX) }, [
      line({ id: "bar-axis", x1: BAR_BOX.x + 20, y1: BAR_BASE, x2: BAR_BOX.x + BAR_BOX.width - 20, y2: BAR_BASE, stroke: GRID, strokeWidth: 2, opacity: 0 }),
      ...bars,
    ]),
    // line widget — panel + CLIPPED group
    panel("line-p", LINE_BOX),
    text({ id: "line-t", x: LINE_BOX.x + 30, y: LINE_BOX.y + 36, anchor: "center-left", content: "Growth trajectory", fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: FG, opacity: 0 }),
    group({ id: "line-clip", x: 0, y: 0, clip: clip(LINE_BOX) }, [
      path({ id: "line", x: 0, y: 0, d: linePath, stroke: PINK, strokeWidth: 4, progress: 0 }),
      ...lineDots,
    ]),
    // donut widget — its OWN bottom-row panel (market share); conic ring + hole,
    // clipped like the others so it can never spill into a neighbour
    panel("donut-p", DONUT_BOX),
    text({ id: "donut-t", x: DONUT_BOX.x + 30, y: DONUT_BOX.y + 36, anchor: "center-left", content: "Market share", fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: FG, opacity: 0 }),
    group({ id: "donut-clip", x: 0, y: 0, clip: clip(DONUT_BOX) }, [
      ellipse({ id: "donut", x: cx(DONUT_BOX), y: cy(DONUT_BOX) + 24, width: 240, height: 240, anchor: "center", fill: conicGradient([{ offset: 0, color: TEAL }, { offset: 0.42, color: TEAL }, { offset: 0.42, color: VIOLET }, { offset: 0.7, color: VIOLET }, { offset: 0.7, color: GOLD }, { offset: 0.88, color: GOLD }, { offset: 0.88, color: "#2E3E5E" }, { offset: 1, color: "#2E3E5E" }]), opacity: 0, scale: 0.6 }),
      ellipse({ id: "donut-hole", x: cx(DONUT_BOX), y: cy(DONUT_BOX) + 24, width: 130, height: 130, anchor: "center", fill: "#0E1426", opacity: 0 }),
      text({ id: "donut-c", x: cx(DONUT_BOX), y: cy(DONUT_BOX) + 24, anchor: "center", content: "42%", fontFamily: "Inter", fontSize: 44, fontWeight: 800, fill: TEAL, opacity: 0 }),
    ]),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A3550", fixed: true }),
  ],

  timeline: seq(
    beat("open", {}, [
      par(
        tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
        cameraTo(cameraFit(OPEN_BOX, { margin: 60 }), { duration: 1.0, ease: "easeInOutCubic" }),
        stagger(0.12, ...KPIS.flatMap((k) => [
          tween(`${k.id}-p`, { opacity: 1 }, { duration: 0.4 }),
          tween(`${k.id}-l`, { opacity: 1 }, { duration: 0.4 }),
          par(tween(k.id, { opacity: 1 }, { duration: 0.3 }), tween(k.id, { content: k.val }, { duration: 1.2, ease: "easeOutCubic" })),
        ])),
      ),
    ]),
    wait(0.6),
    beat("bars", {}, [
      par(
        cameraTo(cameraFit(BAR_BOX, { margin: 70 }), { duration: 1.0, ease: "easeInOutCubic" }),
        tween("bar-p", { opacity: 1 }, { duration: 0.4 }),
        tween("bar-t", { opacity: 1 }, { duration: 0.4 }),
        tween("bar-axis", { opacity: 1 }, { duration: 0.4 }),
        stagger(0.14, ...BARS.map((_, i) => par(
          tween(`bar-${i}`, { scaleY: 1 }, { duration: 0.6, ease: "easeOutBack" }),
          tween(`blab-${i}`, { opacity: 1 }, { duration: 0.4 }),
        ))),
      ),
    ]),
    wait(0.5),
    beat("line", {}, [
      par(
        cameraTo(cameraFit(LINE_BOX, { margin: 70 }), { duration: 1.0, ease: "easeInOutCubic" }),
        tween("line-p", { opacity: 1 }, { duration: 0.4 }),
        tween("line-t", { opacity: 1 }, { duration: 0.4 }),
        seq(wait(0.3), tween("line", { progress: 1 }, { duration: 1.3, ease: "easeInOutCubic" })),
        seq(wait(0.3), stagger(0.16, ...lineDots.map((_, i) => tween(`ld-${i}`, { opacity: 1 }, { duration: 0.25, ease: "easeOutBack" })))),
      ),
    ]),
    wait(0.5),
    beat("donut", {}, [
      par(
        cameraTo(cameraFit(DONUT_BOX, { margin: 70 }), { duration: 1.0, ease: "easeInOutCubic" }),
        tween("donut-p", { opacity: 1 }, { duration: 0.4 }),
        tween("donut-t", { opacity: 1 }, { duration: 0.4 }),
        tween("donut", { opacity: 1, scale: 1 }, { duration: 0.7, ease: "easeOutBack" }),
        tween("donut-hole", { opacity: 1 }, { duration: 0.5 }),
        seq(wait(0.4), tween("donut-c", { opacity: 1 }, { duration: 0.4 })),
      ),
    ]),
    wait(0.6),
    // pull back to the whole board
    beat("board", {}, [
      cameraTo({ zoom: 0.82, x: W / 2, y: H / 2 }, { duration: 1.4, ease: "easeInOutCubic" }),
    ]),
    wait(1.6),
  ),

  behaviors: [
    oscillate("donut", "rotation", { amplitude: 4, frequency: 0.15 }, { from: 7.0, until: 11.0, ramp: 0.6 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.12, fadeIn: 1.0, fadeOut: 1.8, duck: { depth: 0.3 } },
    cues: [
      { at: "open", sfx: "rise", gain: 0.34 },
      { at: "bars", sfx: "tick", gain: 0.4 },
      { at: "line", sfx: "shimmer", gain: 0.34 },
      { at: "donut", file: "confirmation_003.ogg", gain: 0.44 },
      { at: "board", sfx: "pop", gain: 0.4 },
    ],
  },
});
