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

const MAX_VALUE = 14.0;
const MAX_BAR_HEIGHT = 480; // px height of the tallest bar (Q4)
const PX_PER_UNIT = MAX_BAR_HEIGHT / MAX_VALUE;

const BASELINE_Y = 860; // chart baseline (bars sit on this)
const BAR_WIDTH = 180;
const BAR_GAP = 110;
const CHART_WIDTH = DATA.length * BAR_WIDTH + (DATA.length - 1) * BAR_GAP; // 1050
const CHART_LEFT = (1920 - CHART_WIDTH) / 2; // 435
const AXIS_OVERHANG = 40;

const barCenterX = (i: number) =>
  CHART_LEFT + BAR_WIDTH / 2 + i * (BAR_WIDTH + BAR_GAP);

const barHeight = (v: number) => v * PX_PER_UNIT;

const VALUE_GAP = 18; // gap between bar top and value label (label bottom)

// Per-bar grow animation
const GROW_DURATION = 1.4;
const GROW_STAGGER = 0.15;
const GROW_EASE = "easeOutQuart" as const;

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
        x: CHART_LEFT - AXIS_OVERHANG,
        y: 168,
        content: "2025 Revenue ($M)",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 0.5,
        opacity: 0,
      }),

      // Baseline axis
      line({
        id: "axis",
        x1: CHART_LEFT - AXIS_OVERHANG,
        y1: BASELINE_Y,
        x2: CHART_LEFT + CHART_WIDTH + AXIS_OVERHANG,
        y2: BASELINE_Y,
        stroke: "#3A4150",
        strokeWidth: 3,
        progress: 0,
      }),

      // Bars — grow upward from the baseline
      ...DATA.map((d, i) =>
        rect({
          id: `bar-${i}`,
          x: barCenterX(i),
          y: BASELINE_Y,
          width: BAR_WIDTH,
          height: 0,
          anchor: "bottom-center",
          fill: "#5B8CFF",
          radius: 10,
        }),
      ),

      // Value labels — count up and ride just above the bar top
      ...DATA.map((d, i) =>
        text({
          id: `value-${i}`,
          x: barCenterX(i),
          y: BASELINE_Y - VALUE_GAP,
          anchor: "bottom-center",
          content: 0,
          fontFamily: "Inter",
          fontSize: 46,
          fontWeight: 700,
          fill: "#FFFFFF",
          opacity: 0,
        }),
      ),

      // Quarter labels — below the axis, muted gray
      ...DATA.map((d, i) =>
        text({
          id: `qlabel-${i}`,
          x: barCenterX(i),
          y: BASELINE_Y + 36,
          anchor: "top-center",
          content: d.label,
          fontFamily: "Inter",
          fontSize: 38,
          fontWeight: 700,
          fill: "#8A93A6",
          letterSpacing: 1,
          opacity: 0,
        }),
      ),
    ]),
  ],

  timeline: seq(
    // 1. 0.0–0.5s — title fades in (gentle rise) while the axis draws on
    par(
      tween("title", { opacity: 1, y: 148 }, { duration: 0.5, ease: "easeOutCubic" }),
      tween("axis", { progress: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),

    // 2. 0.5–2.35s — bars grow left to right (0.15s stagger), values count up
    //    riding the bar tops; quarter labels fade in with their bars.
    stagger(
      GROW_STAGGER,
      ...DATA.map((d, i) =>
        par(
          tween(
            `bar-${i}`,
            { height: barHeight(d.value) },
            { duration: GROW_DURATION, ease: GROW_EASE },
          ),
          tween(
            `value-${i}`,
            { y: BASELINE_Y - barHeight(d.value) - VALUE_GAP, content: d.value },
            { duration: GROW_DURATION, ease: GROW_EASE },
          ),
          tween(`value-${i}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
          tween(`qlabel-${i}`, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // 4. Hold until 5.2s (build ends at 2.35s)
    wait(2.85),

    // 5. 5.2–6.0s — everything fades out together
    tween("chart", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
  ),
});
