import {
  scene, group, rect, ellipse, line, path, text,
  seq, par, stagger, beat, tween, wait, cameraTo, oscillate,
  conicGradient, linearGradient,
  type NodeIR,
} from "@reframe/core";

// "FY2026" — an animated annual report as a guided camera tour of one dashboard:
// KPI count-ups → a bar chart (grow from base) → a growth line that DRAWS ON
// (`path` `progress`) → a market-share donut (`conicGradient`). The camera pushes
// into each widget in turn, then pulls back to the whole board. Probes: multi-
// chart orchestration + camera tour + the conic-gradient donut + count-ups.

const W = 1920, H = 1080;
const FG = "#EAF0FF", DIM = "#7E88A8", GRID = "#1E2740", TEAL = "#54D6C0", VIOLET = "#7C5CFF", PINK = "#FF6FA5", GOLD = "#FFC861";

// panel helper
const panel = (id: string, x: number, y: number, w: number, h: number): NodeIR =>
  rect({ id, x, y, width: w, height: h, radius: 18, anchor: "center", fill: "#0E1426", stroke: GRID, strokeWidth: 1.5, opacity: 0 });

// KPIs (top row)
const KPIS = [
  { id: "k-rev", x: 430, label: "REVENUE", val: 24.8, pre: "$", suf: "M", dec: 1, c: TEAL },
  { id: "k-usr", x: 960, label: "ACTIVE USERS", val: 1480000, pre: "", suf: "", dec: 0, c: VIOLET, thou: true },
  { id: "k-nps", x: 1490, label: "NPS", val: 72, pre: "", suf: "", dec: 0, c: GOLD },
];

// bar chart (lower-left)
const BARS = [38, 52, 61, 84]; // indexed values
const BX0 = 300, BY = 880, BW = 90, BGAP = 150, BPX = 4;
const bars: NodeIR[] = BARS.flatMap((v, i) => [
  rect({ id: `bar-${i}`, x: BX0 + i * BGAP, y: BY, width: BW, height: v * BPX, radius: 8, anchor: "bottom-center", fill: i === 3 ? TEAL : "#2E3E5E", scaleY: 0 }),
  text({ id: `blab-${i}`, x: BX0 + i * BGAP, y: BY + 36, anchor: "center", content: ["Q1", "Q2", "Q3", "Q4"][i]!, fontFamily: "Inter", fontSize: 22, fill: DIM, opacity: 0 }),
]);

// growth line (lower-right) — a polyline that draws on
const LP = [[1180, 860], [1280, 800], [1380, 820], [1480, 720], [1580, 700], [1680, 600], [1760, 540]];
const linePath = "M" + LP.map((p) => `${p[0]} ${p[1]}`).join(" L");
const lineDots: NodeIR[] = LP.map((p, i) => ellipse({ id: `ld-${i}`, x: p[0]!, y: p[1]!, width: 12, height: 12, anchor: "center", fill: PINK, opacity: 0 }));

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
      panel(`${k.id}-p`, k.x, 300, 480, 200),
      text({ id: `${k.id}-l`, x: k.x, y: 248, anchor: "center", content: k.label, fontFamily: "Inter", fontSize: 24, fontWeight: 700, fill: DIM, letterSpacing: 2, opacity: 0 }),
      text({ id: k.id, x: k.x, y: 330, anchor: "center", content: 0, contentDecimals: k.dec, prefix: k.pre, suffix: k.suf, ...(k.thou ? { contentThousands: true } : {}), fontFamily: "Inter", fontSize: 80, fontWeight: 800, fill: k.c, opacity: 0 }),
    ]),
    // bar panel
    panel("bar-p", 590, 760, 740, 360),
    text({ id: "bar-t", x: 300, y: 640, anchor: "center-left", content: "Revenue by quarter", fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: FG, opacity: 0 }),
    line({ id: "bar-axis", x1: 240, y1: BY, x2: 900, y2: BY, stroke: GRID, strokeWidth: 2, opacity: 0 }),
    ...bars,
    // line panel
    panel("line-p", 1470, 760, 720, 360),
    text({ id: "line-t", x: 1150, y: 640, anchor: "center-left", content: "Growth trajectory", fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: FG, opacity: 0 }),
    path({ id: "line", x: 0, y: 0, d: linePath, stroke: PINK, strokeWidth: 4, progress: 0 }),
    ...lineDots,
    // donut (market share) — conic gradient ring + hole
    ellipse({ id: "donut", x: 1490, y: 360, width: 280, height: 280, anchor: "center", fill: conicGradient([{ offset: 0, color: TEAL }, { offset: 0.42, color: TEAL }, { offset: 0.42, color: VIOLET }, { offset: 0.7, color: VIOLET }, { offset: 0.7, color: GOLD }, { offset: 0.88, color: GOLD }, { offset: 0.88, color: "#2E3E5E" }, { offset: 1, color: "#2E3E5E" }]), opacity: 0, scale: 0.6 }),
    ellipse({ id: "donut-hole", x: 1490, y: 360, width: 150, height: 150, anchor: "center", fill: "#0E1426", opacity: 0 }),
    text({ id: "donut-c", x: 1490, y: 360, anchor: "center", content: "42%", fontFamily: "Inter", fontSize: 48, fontWeight: 800, fill: TEAL, opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A3550", fixed: true }),
  ],

  timeline: seq(
    beat("open", {}, [
      par(
        tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
        cameraTo({ zoom: 1.18, x: 960, y: 300 }, { duration: 1.0, ease: "easeInOutCubic" }),
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
        cameraTo({ zoom: 1.32, x: 590, y: 770 }, { duration: 1.0, ease: "easeInOutCubic" }),
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
        cameraTo({ zoom: 1.3, x: 1470, y: 760 }, { duration: 1.0, ease: "easeInOutCubic" }),
        tween("line-p", { opacity: 1 }, { duration: 0.4 }),
        tween("line-t", { opacity: 1 }, { duration: 0.4 }),
        seq(wait(0.3), tween("line", { progress: 1 }, { duration: 1.3, ease: "easeInOutCubic" })),
        seq(wait(0.3), stagger(0.16, ...lineDots.map((_, i) => tween(`ld-${i}`, { opacity: 1 }, { duration: 0.25, ease: "easeOutBack" })))),
      ),
    ]),
    wait(0.5),
    beat("donut", {}, [
      par(
        cameraTo({ zoom: 1.35, x: 1490, y: 360 }, { duration: 1.0, ease: "easeInOutCubic" }),
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
