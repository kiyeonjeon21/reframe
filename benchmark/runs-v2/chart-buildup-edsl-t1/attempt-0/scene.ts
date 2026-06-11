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
  { quarter: "Q1", value: 8.2 },
  { quarter: "Q2", value: 9.1 },
  { quarter: "Q3", value: 11.4 },
  { quarter: "Q4", value: 14.0 },
];

const MAX_VALUE = 14.0;
const MAX_BAR_HEIGHT = 480; // px height of the tallest bar (Q4)
const BASELINE_Y = 860; // y of the axis baseline
const BAR_WIDTH = 180;
const BAR_SPACING = 280; // center-to-center
const FIRST_BAR_X = 540; // center x of Q1 bar (chart centered on 960)
const CHART_LEFT = 420;
const CHART_RIGHT = 1500;

const BAR_FILL = "#5B8CFF";
const AXIS_COLOR = "#3A4150";
const MUTED_GRAY = "#8A93A6";
const VALUE_COLOR = "#E8EDF7";

const barHeight = (v: number) => (v / MAX_VALUE) * MAX_BAR_HEIGHT;
const barX = (i: number) => FIRST_BAR_X + i * BAR_SPACING;

// Timing
const TITLE_DUR = 0.5;
const BAR_DUR = 1.4;
const BAR_STAGGER = 0.15;
const GROW_END = TITLE_DUR + BAR_STAGGER * (DATA.length - 1) + BAR_DUR; // 2.35s
const HOLD_UNTIL = 5.2;
const FADE_OUT_DUR = 0.8; // ends at 6.0s

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
      // Title — top-left of the chart area, slides up as it fades in.
      text({
        id: "title",
        x: CHART_LEFT,
        y: 174,
        content: "2025 Revenue ($M)",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 0.5,
        opacity: 0,
      }),

      // Bars (grow upward from the baseline). A small square "foot" rect sits
      // under each bar so only the top corners read as rounded.
      ...DATA.flatMap((d, i) => [
        rect({
          id: `foot-${i}`,
          x: barX(i),
          y: BASELINE_Y,
          width: BAR_WIDTH,
          height: 0,
          anchor: "bottom-center",
          fill: BAR_FILL,
          opacity: 0,
        }),
        rect({
          id: `bar-${i}`,
          x: barX(i),
          y: BASELINE_Y,
          width: BAR_WIDTH,
          height: 0,
          anchor: "bottom-center",
          fill: BAR_FILL,
          radius: 10,
        }),
      ]),

      // Baseline axis — drawn on during the intro, rendered above the bar feet
      // for a crisp edge.
      line({
        id: "axis",
        x1: CHART_LEFT,
        y1: BASELINE_Y,
        x2: CHART_RIGHT,
        y2: BASELINE_Y,
        stroke: AXIS_COLOR,
        strokeWidth: 3,
        progress: 0,
      }),

      // Value labels — count up while riding just above each bar top.
      ...DATA.map((d, i) =>
        text({
          id: `val-${i}`,
          x: barX(i),
          y: BASELINE_Y - 18,
          anchor: "bottom-center",
          content: 0,
          contentDecimals: 1,
          fontFamily: "Inter",
          fontSize: 46,
          fontWeight: 700,
          fill: VALUE_COLOR,
          opacity: 0,
        }),
      ),

      // Quarter labels below the axis.
      ...DATA.map((d, i) =>
        text({
          id: `qlabel-${i}`,
          x: barX(i),
          y: BASELINE_Y + 26,
          anchor: "top-center",
          content: d.quarter,
          fontFamily: "Inter",
          fontSize: 36,
          fontWeight: 700,
          fill: MUTED_GRAY,
          letterSpacing: 1.5,
          opacity: 0,
        }),
      ),
    ]),
  ],

  timeline: seq(
    // 1) 0.0–0.5s — title fades in (with a gentle rise); axis draws on.
    par(
      tween("title", { opacity: 1, y: 150 }, { duration: TITLE_DUR, ease: "easeOutCubic" }),
      tween("axis", { progress: 1 }, { duration: TITLE_DUR, ease: "easeOutCubic" }),
    ),

    // 2) 0.5–2.35s — bars grow left-to-right with a 0.15s stagger. Each value
    //    label fades in, counts up from 0, and rides the bar top (same ease and
    //    duration as the bar growth). Quarter labels fade in with their bars.
    stagger(
      BAR_STAGGER,
      ...DATA.map((d, i) =>
        par(
          tween(`bar-${i}`, { height: barHeight(d.value) }, { duration: BAR_DUR, ease: "easeOutCubic" }),
          tween(`foot-${i}`, { height: 12, opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween(`val-${i}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
          tween(
            `val-${i}`,
            { content: d.value, y: BASELINE_Y - barHeight(d.value) - 18 },
            { duration: BAR_DUR, ease: "easeOutCubic" },
          ),
          tween(`qlabel-${i}`, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // 3) Hold until 5.2s.
    wait(HOLD_UNTIL - GROW_END),

    // 4) 5.2–6.0s — everything fades out together.
    tween("chart", { opacity: 0 }, { duration: FADE_OUT_DUR, ease: "easeInQuad" }),
  ),
});
