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
// Data
// ---------------------------------------------------------------------------

const DATA = [
  { quarter: "Q1", value: 8.2 },
  { quarter: "Q2", value: 9.1 },
  { quarter: "Q3", value: 11.4 },
  { quarter: "Q4", value: 14.0 },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const BASELINE_Y = 860; // y of the axis line
const MAX_BAR_H = 480; // height of the tallest bar (Q4 = 14.0)
const UNIT = MAX_BAR_H / 14.0; // px per $M

const BAR_W = 180;
const BAR_GAP = 100; // gap between bars
const STEP = BAR_W + BAR_GAP; // center-to-center spacing = 280

const CENTER_X = 960;
const CENTERS = DATA.map(
  (_, i) => CENTER_X + (i - (DATA.length - 1) / 2) * STEP,
); // 540, 820, 1100, 1380

const CHART_LEFT = CENTERS[0] - BAR_W / 2; // 450
const VALUE_PAD = 18; // gap between bar top and value label

const heights = DATA.map((d) => d.value * UNIT);

// Colors
const BG = "#0B0E14";
const BAR_FILL = "#5B8CFF";
const AXIS = "#3A4150";
const WHITE = "#FFFFFF";
const MUTED = "#8E97A8";

// Timing
const GROW_DUR = 1.4;
const STAGGER = 0.15;

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const bars = DATA.map((_, i) =>
  rect({
    id: `bar-${i}`,
    x: CENTERS[i] - BAR_W / 2,
    y: BASELINE_Y,
    width: BAR_W,
    height: 0, // grows up from the baseline
    anchor: "bottom-left",
    fill: BAR_FILL,
    radius: 10,
  }),
);

const valueLabels = DATA.map((d, i) =>
  text({
    id: `val-${i}`,
    x: CENTERS[i],
    y: BASELINE_Y - VALUE_PAD, // rides up with the bar top
    anchor: "bottom-center",
    content: 0, // counts up to d.value
    fontFamily: "Inter",
    fontSize: 46,
    fontWeight: 700,
    fill: WHITE,
    opacity: 0,
  }),
);

const quarterLabels = DATA.map((d, i) =>
  text({
    id: `q-${i}`,
    x: CENTERS[i],
    y: BASELINE_Y + 28,
    anchor: "top-center",
    content: d.quarter,
    fontFamily: "Inter",
    fontSize: 36,
    fontWeight: 700,
    fill: MUTED,
    letterSpacing: 2,
    opacity: 0,
  }),
);

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default scene({
  id: "chart-buildup",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "chart", x: 0, y: 0 }, [
      // Title — top-left of the chart area
      text({
        id: "title",
        x: CHART_LEFT,
        y: 232,
        content: "2025 Revenue ($M)",
        fontFamily: "Inter",
        fontSize: 60,
        fontWeight: 800,
        fill: WHITE,
        letterSpacing: 0.5,
        opacity: 0,
      }),
      // Thin baseline axis, drawn on under the bars
      line({
        id: "axis",
        x1: CHART_LEFT - 30,
        y1: BASELINE_Y,
        x2: CENTERS[3] + BAR_W / 2 + 30,
        y2: BASELINE_Y,
        stroke: AXIS,
        strokeWidth: 3,
        progress: 0,
      }),
      ...bars,
      ...valueLabels,
      ...quarterLabels,
    ]),
  ],
  timeline: seq(
    // 1. 0.0–0.5s — title fades in (slight rise), axis draws across
    par(
      tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      tween("title", { y: 212 }, { duration: 0.5, ease: "easeOutCubic" }),
      tween("axis", { progress: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
    // 2. 0.5–2.35s — bars grow left to right with 0.15s stagger;
    //    value labels count up and ride just above the bar tops;
    //    quarter labels fade in with their bars.
    stagger(
      STAGGER,
      ...DATA.map((d, i) =>
        par(
          tween(
            `bar-${i}`,
            { height: heights[i] },
            { duration: GROW_DUR, ease: "easeOutQuart" },
          ),
          tween(
            `val-${i}`,
            { y: BASELINE_Y - heights[i] - VALUE_PAD, content: d.value },
            { duration: GROW_DUR, ease: "easeOutQuart" },
          ),
          tween(
            `val-${i}`,
            { opacity: 1 },
            { duration: 0.3, ease: "easeOutQuad" },
          ),
          tween(
            `q-${i}`,
            { opacity: 1 },
            { duration: 0.45, ease: "easeOutQuad" },
          ),
        ),
      ),
    ),
    // 3. Hold until 5.2s  (0.5 + 1.85 + 2.85 = 5.2)
    wait(2.85),
    // 4. 5.2–6.0s — everything fades out together
    tween("chart", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
  ),
});
