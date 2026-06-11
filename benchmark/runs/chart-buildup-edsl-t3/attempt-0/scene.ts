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

const data = [
  { label: "Q1", value: 8.2 },
  { label: "Q2", value: 9.1 },
  { label: "Q3", value: 11.4 },
  { label: "Q4", value: 14.0 },
];

const maxValue = 14.0;          // tallest bar (Q4)
const maxBarHeight = 460;       // px height of the tallest bar
const pxPerUnit = maxBarHeight / maxValue;

const baselineY = 850;          // y of the axis baseline
const barWidth = 180;
const barSpacing = 290;         // center-to-center
const firstBarCx = 525;         // center x of Q1 bar
const axisX1 = 405;
const axisX2 = 1515;

const valueGap = 36;            // value label sits this far above the bar top
const growDuration = 1.4;
const staggerInterval = 0.15;

// Per-bar derived geometry
const bars = data.map((d, i) => {
  const cx = firstBarCx + i * barSpacing;
  const height = d.value * pxPerUnit;
  const whole = Math.floor(d.value + 1e-6);
  const tenth = Math.round(d.value * 10) % 10;
  // Optical centering of "8.2" vs "14.0": shift the decimal point right a
  // touch when the integer part has two digits.
  const dotOffset = whole >= 10 ? 12 : 0;
  return { ...d, i, cx, height, whole, tenth, dotOffset };
});

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default scene({
  id: "chart-buildup",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0B0E14",
  nodes: [
    group({ id: "stage", x: 0, y: 0, opacity: 1 }, [
      // Title — top-left of the chart area
      text({
        id: "title",
        x: axisX1,
        y: 186,
        anchor: "top-left",
        content: "2025 Revenue ($M)",
        fontFamily: "Inter",
        fontSize: 60,
        fontWeight: 800,
        fill: "#FFFFFF",
        letterSpacing: 0.5,
        opacity: 0,
      }),

      // Baseline axis (draws on during the intro)
      line({
        id: "axis",
        x1: axisX1,
        y1: baselineY,
        x2: axisX2,
        y2: baselineY,
        stroke: "#3A4150",
        strokeWidth: 3,
        progress: 0,
      }),

      // Bars (grow upward from the baseline)
      ...bars.map((b) =>
        rect({
          id: `bar-${b.i}`,
          x: b.cx,
          y: baselineY,
          anchor: "bottom-center",
          width: barWidth,
          height: 0,
          fill: "#5B8CFF",
          radius: 10,
        })
      ),

      // Value labels — "8.2" built from whole + "." + tenth so the count-up
      // keeps one decimal place. The group rides just above the bar top.
      ...bars.map((b) =>
        group(
          { id: `val-${b.i}`, x: b.cx, y: baselineY - 26, opacity: 0 },
          [
            text({
              id: `val-whole-${b.i}`,
              x: b.dotOffset - 6,
              y: 0,
              anchor: "center-right",
              content: 0,
              fontFamily: "Inter",
              fontSize: 44,
              fontWeight: 700,
              fill: "#EAF0FF",
            }),
            text({
              id: `val-dot-${b.i}`,
              x: b.dotOffset,
              y: 0,
              anchor: "center",
              content: ".",
              fontFamily: "Inter",
              fontSize: 44,
              fontWeight: 700,
              fill: "#EAF0FF",
            }),
            text({
              id: `val-frac-${b.i}`,
              x: b.dotOffset + 6,
              y: 0,
              anchor: "center-left",
              content: 0,
              fontFamily: "Inter",
              fontSize: 44,
              fontWeight: 700,
              fill: "#EAF0FF",
            }),
          ]
        )
      ),

      // Quarter labels under the axis
      ...bars.map((b) =>
        text({
          id: `q-${b.i}`,
          x: b.cx,
          y: 880,
          anchor: "top-center",
          content: b.label,
          fontFamily: "Inter",
          fontSize: 34,
          fontWeight: 700,
          fill: "#8A93A6",
          letterSpacing: 2,
          opacity: 0,
        })
      ),
    ]),
  ],

  timeline: seq(
    // 0.0 – 0.5s: title fades in (with a gentle rise); axis draws on.
    par(
      tween("title", { opacity: 1, y: 170 }, { duration: 0.5, ease: "easeOutCubic" }),
      tween("axis", { progress: 1 }, { duration: 0.5, ease: "easeOutQuad" })
    ),

    // 0.5 – 2.35s: bars grow left-to-right, 0.15s apart. Each value label
    // fades in, counts up, and rides the bar top; quarter labels fade in too.
    stagger(
      staggerInterval,
      ...bars.map((b) =>
        par(
          tween(
            `bar-${b.i}`,
            { height: b.height },
            { duration: growDuration, ease: "easeOutCubic" }
          ),
          tween(
            `val-${b.i}`,
            { y: baselineY - b.height - valueGap },
            { duration: growDuration, ease: "easeOutCubic" }
          ),
          tween(`val-${b.i}`, { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          tween(
            `val-whole-${b.i}`,
            { content: b.whole },
            { duration: growDuration, ease: "easeOutCubic" }
          ),
          tween(
            `val-frac-${b.i}`,
            { content: b.tenth },
            { duration: growDuration, ease: "easeOutCubic" }
          ),
          tween(`q-${b.i}`, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" })
        )
      )
    ),

    // Hold until 5.2s. (0.5 + 1.85 = 2.35s elapsed so far.)
    wait(2.85),

    // 5.2 – 6.0s: everything fades out together.
    tween("stage", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" })
  ),
});
