import {
  scene,
  rect,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  beat,
  cameraTo,
  splitText,
  textIn,
  type NodeIR,
} from "@reframe/core";

// "Q3" — a ceiling test: one explainer stacking many capabilities. splitText
// title + count-up KPI ($ prefix, M suffix) + a bar chart that grows from its
// base (anchor bottom-center + scaleY) with count-up values + per-beat camera
// push-ins + label-anchored audio cues + an idle hold. Probes: orchestration
// depth — does the whole vocabulary compose cleanly in one timeline?

const W = 1920, H = 1080;
const FG = "#EAF0FF", DIM = "#7E88A8", ACCENT = "#54D6C0";

const BARS = [
  { id: "q1", label: "Q1", val: 1.2, c: "#3A4D6B" },
  { id: "q2", label: "Q2", val: 1.6, c: "#3A4D6B" },
  { id: "q3", label: "Q3", val: 2.4, c: ACCENT },
  { id: "q4", label: "Q4e", val: 3.1, c: "#2A3A52" },
];
const BASE_Y = 820;
const BAR_W = 150;
const BAR_GAP = 230;
const PX_PER_M = 180; // bar height per $M
const x0 = W / 2 - ((BARS.length - 1) * BAR_GAP) / 2;

const title = splitText("Q3 GROWTH", { id: "ttl", x: W / 2, y: 250, fontSize: 96, fontWeight: 800, fill: FG, letterSpacing: 4 });

const bars: NodeIR[] = BARS.flatMap((b, i) => {
  const h = b.val * PX_PER_M;
  const x = x0 + i * BAR_GAP;
  return [
    rect({ id: `bar-${b.id}`, x, y: BASE_Y, width: BAR_W, height: h, radius: 10, anchor: "bottom-center", fill: b.c, scaleY: 0 }),
    text({ id: `val-${b.id}`, x, y: BASE_Y - h - 36, anchor: "center", content: 0, contentDecimals: 1, prefix: "$", suffix: "M", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: b.id === "q3" ? ACCENT : DIM, opacity: 0 }),
    text({ id: `lab-${b.id}`, x, y: BASE_Y + 40, anchor: "center", content: b.label, fontFamily: "Inter", fontSize: 28, fontWeight: 600, fill: DIM, opacity: 0 }),
  ];
});

export default scene({
  id: "data-explainer",
  size: { width: W, height: H },
  fps: 30,
  background: "#080B16",
  camera: { x: W / 2, y: H / 2, zoom: 1 },
  nodes: [
    ...title.nodes,
    // big KPI headline
    text({ id: "kpi", x: W / 2, y: 470, anchor: "center", content: 0, contentDecimals: 1, prefix: "$", suffix: "M", fontFamily: "Inter", fontSize: 200, fontWeight: 800, fill: ACCENT, opacity: 0 }),
    text({ id: "kpi-sub", x: W / 2, y: 600, anchor: "center", content: "quarterly revenue · +50% YoY", fontFamily: "Inter", fontSize: 30, fill: DIM, letterSpacing: 3, opacity: 0 }),
    // baseline + bars
    rect({ id: "axis", x: W / 2, y: BASE_Y + 1, width: 1100, height: 2, anchor: "center", fill: "#2A3550", opacity: 0 }),
    ...bars,
  ],

  timeline: seq(
    wait(0.3),
    // BEAT 1 — title
    beat("title", { parallel: true }, [
      textIn("cascade", title, { speed: 1.1 }),
    ]),
    wait(0.5),
    // BEAT 2 — KPI reveal + count-up, camera nudges in
    beat("kpi", {}, [
      par(
        tween("kpi", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
        tween("kpi-sub", { opacity: 1 }, { duration: 0.5 }),
        cameraTo({ zoom: 1.06 }, { duration: 1.2, ease: "easeInOutCubic" }),
      ),
      tween("kpi", { content: 2.4 }, { duration: 1.4, ease: "easeOutCubic", label: "kpi-count" }),
    ]),
    wait(0.6),
    // BEAT 3 — pull back to the chart, fade the KPI up out of the way
    beat("chart", {}, [
      par(
        tween("kpi", { opacity: 0, y: 380 }, { duration: 0.6, ease: "easeInCubic" }),
        tween("kpi-sub", { opacity: 0 }, { duration: 0.4 }),
        ...title.nodes.map((n) => tween(n.id, { opacity: 0.25 }, { duration: 0.6 })),
        cameraTo({ zoom: 1, y: H / 2 + 40 }, { duration: 1.0, ease: "easeInOutCubic" }),
        tween("axis", { opacity: 1 }, { duration: 0.5 }),
      ),
      // bars grow from the base, staggered, values + labels count up
      stagger(0.18, ...BARS.map((b) =>
        par(
          tween(`bar-${b.id}`, { scaleY: 1 }, { duration: 0.7, ease: "easeOutBack", label: `grow-${b.id}` }),
          tween(`lab-${b.id}`, { opacity: 1 }, { duration: 0.4 }),
          seq(wait(0.2), par(
            tween(`val-${b.id}`, { opacity: 1 }, { duration: 0.3 }),
            tween(`val-${b.id}`, { content: b.val }, { duration: 0.6, ease: "easeOutCubic" }),
          )),
        ),
      )),
    ]),
    wait(1.8, "hold"),
    beat("out", { parallel: true }, [
      ...title.nodes.map((n) => tween(n.id, { opacity: 0 }, { duration: 0.5 })),
      tween("axis", { opacity: 0 }, { duration: 0.5 }),
      ...BARS.flatMap((b) => [
        tween(`bar-${b.id}`, { opacity: 0 }, { duration: 0.5 }),
        tween(`val-${b.id}`, { opacity: 0 }, { duration: 0.5 }),
        tween(`lab-${b.id}`, { opacity: 0 }, { duration: 0.5 }),
      ]),
    ]),
  ),

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.14, fadeIn: 1.2, fadeOut: 1.5, duck: { depth: 0.35 } },
    cues: [
      { at: "title", sfx: "whoosh", gain: 0.5 },
      { at: "kpi", sfx: "rise", gain: 0.6 },
      { at: "chart", sfx: "whoosh", gain: 0.4 },
      { at: "grow-q1", sfx: "tick", gain: 0.5 },
      { at: "grow-q2", sfx: "tick", gain: 0.5 },
      { at: "grow-q3", sfx: "pop", gain: 0.7 },
      { at: "grow-q4", sfx: "tick", gain: 0.5 },
    ],
  },
});
