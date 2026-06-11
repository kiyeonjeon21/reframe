import {
  scene,
  group,
  rect,
  line,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
} from "@reframe/core";

// ---------------------------------------------------------------------------
// Data + layout
// ---------------------------------------------------------------------------

const DATA = [
  { label: "Q1", value: 8.2 },
  { label: "Q2", value: 9.1 },
  { label: "Q3", value: 11.4 },
  { label: "Q4", value: 14.0 },
];

const BASELINE_Y = 860; // y of the axis line
const MAX_BAR_H = 520; // height of the tallest bar (Q4 = 14.0)
const MAX_VALUE = 14.0;
const BAR_W = 180;
const GAP = 110;

const chartW = DATA.length * BAR_W + (DATA.length - 1) * GAP; // 1050
const chartX = (1920 - chartW) / 2; // 435

const barH = (v: number) => (v / MAX_VALUE) * MAX_BAR_H;
const barCX = (i: number) => chartX + BAR_W / 2 + i * (BAR_W + GAP);
const valueLabelY = (h: number) => BASELINE_Y - h - 22; // rides above bar top

// Motion timing
const GROW_DUR = 1.5;
const STAGGER = 0.15;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default scene({
  id: "chart-buildup",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0B0E14",
  nodes: [
    group({ id: "chart", x: 0, y: 0, opacity: 1 }, [
      // Title — top-left of the chart area
      text({
        id: "title",
        x: chartX,
        y: 158,
        anchor: "top-left",
        content: "2025 Revenue ($M)",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 0.5,
        opacity: 0,
      }),

      // Bars — grow upward from the baseline
      ...DATA.map((d, i) =>
        rect({
          id: `bar-${i}`,
          x: barCX(i),
          y: BASELINE_Y,
          width: BAR_W,
          height: 0,
          anchor: "bottom-center",
          fill: "#5B8CFF",
          radius: 10,
        }),
      ),

      // Baseline axis line (drawn on top of bar bottoms)
      line({
        id: "axis",
        x1: chartX - 50,
        y1: BASELINE_Y,
        x2: chartX + chartW + 50,
        y2: BASELINE_Y,
        stroke: "#3A4150",
        strokeWidth: 3,
        progress: 0,
      }),

      // Value labels — count up and ride just above the bar top
      ...DATA.map((d, i) =>
        text({
          id: `val-${i}`,
          x: barCX(i),
          y: valueLabelY(0),
          anchor: "bottom-center",
          content: 0,
          contentDecimals: 1,
          fontFamily: "Inter",
          fontSize: 46,
          fontWeight: 700,
          fill: "#FFFFFF",
          opacity: 0,
        }),
      ),

      // Quarter labels below the axis
      ...DATA.map((d, i) =>
        text({
          id: `q-${i}`,
          x: barCX(i),
          y: BASELINE_Y + 38,
          anchor: "top-center",
          content: d.label,
          fontFamily: "Inter",
          fontSize: 36,
          fontWeight: 700,
          fill: "#8A93A6",
          letterSpacing: 2,
          opacity: 0,
        }),
      ),
    ]),
  ],

  timeline: seq(
    // 1. 0.0–0.5s — title fades in (slight rise) while the axis draws on
    par(
      tween("title", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
      tween("title", { y: 140 }, { duration: 0.5, ease: "easeOutCubic" }),
      tween("axis", { progress: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),

    // 2–3. 0.5–2.45s — bars grow left to right with a 0.15s stagger;
    // value labels count up and ride the bar tops; quarter labels fade in.
    stagger(
      STAGGER,
      ...DATA.map((d, i) =>
        par(
          tween(
            `bar-${i}`,
            { height: barH(d.value) },
            { duration: GROW_DUR, ease: "easeOutCubic" },
          ),
          tween(
            `val-${i}`,
            { y: valueLabelY(barH(d.value)), content: d.value },
            { duration: GROW_DUR, ease: "easeOutCubic" },
          ),
          tween(`val-${i}`, { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween(`q-${i}`, { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // 4. Hold until 5.2s  (0.5 + 0.45 + 1.5 = 2.45s elapsed so far)
    wait(5.2 - (0.5 + STAGGER * (DATA.length - 1) + GROW_DUR)),

    // 5. 5.2–6.0s — everything fades out together
    tween("chart", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
  ),
});
