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
const MAX_VALUE = 14.0; // tallest bar (Q4)
const MAX_BAR_HEIGHT = 480; // px height of the tallest bar
const BAR_WIDTH = 170;
const BAR_SPACING = 280; // center-to-center
const CHART_LEFT = 400;
const CHART_RIGHT = 1520;
const FIRST_BAR_X = 540; // center of Q1 bar

const VALUE_GAP = 40; // value label sits this far above the bar top
const QUARTER_Y = 912; // quarter labels below the axis

const barX = (i: number) => FIRST_BAR_X + i * BAR_SPACING;
const barHeight = (v: number) => (v / MAX_VALUE) * MAX_BAR_HEIGHT;

// Colors
const BG = "#0B0E14";
const BAR_FILL = "#5B8CFF";
const AXIS = "#3A4150";
const MUTED = "#828B9E";
const WHITE = "#FFFFFF";

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

const TITLE_IN = 0.5; // 0.0 - 0.5s
const BAR_STAGGER = 0.15; // left-to-right offset
const BAR_GROW = 1.5; // each bar's growth duration
// bars phase: 0.5 -> 0.5 + 3*0.15 + 1.5 = 2.45s
const HOLD_UNTIL = 5.2;
const FADE_OUT = 0.8; // 5.2 - 6.0s
const BARS_END = TITLE_IN + 3 * BAR_STAGGER + BAR_GROW; // 2.45

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default scene({
  id: "chart-buildup",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "root", x: 0, y: 0 }, [
      // Title — top-left of the chart area
      text({
        id: "title",
        x: CHART_LEFT,
        y: 176,
        anchor: "top-left",
        content: "2025 Revenue ($M)",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fill: WHITE,
        letterSpacing: 0.5,
        opacity: 0,
      }),

      // Bars — grow upward from the baseline
      ...DATA.map((d, i) =>
        rect({
          id: `bar-${i}`,
          x: barX(i),
          y: BASELINE_Y,
          width: BAR_WIDTH,
          height: 0,
          anchor: "bottom-center",
          fill: BAR_FILL,
          radius: 10,
          opacity: 0,
        }),
      ),

      // Baseline axis (drawn after bars so it sits on top of their feet)
      line({
        id: "axis",
        x1: CHART_LEFT,
        y1: BASELINE_Y,
        x2: CHART_RIGHT,
        y2: BASELINE_Y,
        stroke: AXIS,
        strokeWidth: 3,
        opacity: 0,
      }),

      // Value labels — count up while riding the bar top
      ...DATA.map((d, i) =>
        text({
          id: `value-${i}`,
          x: barX(i),
          y: BASELINE_Y - VALUE_GAP,
          anchor: "center",
          content: 0,
          contentDecimals: 1,
          fontFamily: "Inter",
          fontSize: 44,
          fontWeight: 700,
          fill: WHITE,
          opacity: 0,
        }),
      ),

      // Quarter labels below the axis
      ...DATA.map((d, i) =>
        text({
          id: `quarter-${i}`,
          x: barX(i),
          y: QUARTER_Y,
          anchor: "center",
          content: d.quarter,
          fontFamily: "Inter",
          fontSize: 32,
          fontWeight: 700,
          fill: MUTED,
          letterSpacing: 2,
          opacity: 0,
        }),
      ),
    ]),
  ],

  timeline: seq(
    // 1. 0.0-0.5s — title fades in (with a gentle rise), axis settles in with it
    par(
      tween("title", { opacity: 1, y: 160 }, { duration: TITLE_IN, ease: "easeOutCubic" }),
      tween("axis", { opacity: 1 }, { duration: TITLE_IN, ease: "easeOutQuad" }),
    ),

    // 2-3. 0.5-2.45s — bars grow left to right; value labels count up and ride
    //      the bar tops; quarter labels fade in with their bars
    stagger(
      BAR_STAGGER,
      ...DATA.map((d, i) =>
        par(
          tween(`bar-${i}`, { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween(
            `bar-${i}`,
            { height: barHeight(d.value) },
            { duration: BAR_GROW, ease: "easeOutQuart" },
          ),
          tween(`value-${i}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
          tween(
            `value-${i}`,
            { y: BASELINE_Y - barHeight(d.value) - VALUE_GAP, content: d.value },
            { duration: BAR_GROW, ease: "easeOutQuart" },
          ),
          tween(`quarter-${i}`, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // 4. Hold until 5.2s
    wait(HOLD_UNTIL - BARS_END),

    // 5. 5.2-6.0s — everything fades out together
    tween("root", { opacity: 0 }, { duration: FADE_OUT, ease: "easeInOutQuad" }),
  ),
});
