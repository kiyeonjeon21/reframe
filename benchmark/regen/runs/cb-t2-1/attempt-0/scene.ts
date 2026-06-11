import { scene, rect, text, line, seq, par, stagger, to, tween, wait } from "@reframe/core";

const data = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 71 },
  { label: "Wed", value: 55 },
  { label: "Thu", value: 90 },
  { label: "Fri", value: 64 },
];

// Horizontal bar chart geometry: bars grow left-to-right from a left baseline.
const baselineX = 560; // vertical axis the bars grow from
const plotWidth = 1040; // full-scale bar length
const rowPitch = 130;
const barThickness = 80;
const rowY = (i: number) => 300 + i * rowPitch; // vertical center of each row

const maxValue = Math.max(...data.map((d) => d.value));
const barLen = (v: number) => (v / maxValue) * plotWidth;
const overshoot = 1.06; // springy pop past the target, then settle

const valueGap = 26;
const valueX = (v: number) => baselineX + barLen(v) + valueGap;

const gridValues = [30, 60, 90];
const gridX = (v: number) => baselineX + (v / maxValue) * plotWidth;

const maxIndex = data.findIndex((d) => d.value === maxValue);

export default scene({
  id: "chart-buildup",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0B0E14",
  nodes: [
    text({
      id: "title",
      x: 460,
      y: 110,
      content: "Weekly Active Users",
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 800,
      fill: "#FFFFFF",
    }),
    text({
      id: "subtitle",
      x: 460,
      y: 178,
      content: "Daily totals · Mon–Fri",
      fontFamily: "Inter",
      fontSize: 26,
      fontWeight: 400,
      fill: "#8B93A7",
      letterSpacing: 1,
    }),

    // Faint vertical gridlines with scale ticks along the bottom.
    ...gridValues.map((v, i) =>
      line({
        id: `grid-${i}`,
        x1: gridX(v),
        y1: 248,
        x2: gridX(v),
        y2: 872,
        stroke: "#1B2230",
        strokeWidth: 2,
      }),
    ),
    ...gridValues.map((v, i) =>
      text({
        id: `tick-${i}`,
        x: gridX(v),
        y: 894,
        anchor: "top-center",
        content: v,
        fontFamily: "Inter",
        fontSize: 24,
        fontWeight: 400,
        fill: "#5B6478",
      }),
    ),

    // Left baseline the bars grow out of.
    line({
      id: "axis",
      x1: baselineX,
      y1: 240,
      x2: baselineX,
      y2: 880,
      stroke: "#444C5E",
      strokeWidth: 3,
    }),

    // Bars: anchored at the left edge so width animates rightward.
    ...data.map((d, i) =>
      rect({
        id: `bar-${i}`,
        x: baselineX,
        y: rowY(i),
        width: barLen(d.value),
        height: barThickness,
        anchor: "center-left", // width animates left-to-right from the axis
        fill: i === maxIndex ? "#60A5FA" : "#3B82F6",
        radius: 10,
      }),
    ),

    // Values ride the bar ends and count up.
    ...data.map((d, i) =>
      text({
        id: `value-${i}`,
        x: valueX(d.value),
        y: rowY(i),
        anchor: "center-left",
        content: d.value, // numeric content interpolates -> count-up
        fontFamily: "Inter",
        fontSize: 38,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
    ),

    // Day labels sit to the left of the baseline.
    ...data.map((d, i) =>
      text({
        id: `label-${i}`,
        x: baselineX - 32,
        y: rowY(i),
        anchor: "center-right",
        content: d.label,
        fontFamily: "Inter",
        fontSize: 30,
        fontWeight: 700,
        fill: "#8B93A7",
        letterSpacing: 1,
      }),
    ),
  ],

  states: {
    empty: Object.fromEntries([
      ["title", { opacity: 0, y: 90 }],
      ["subtitle", { opacity: 0, y: 162 }],
      ["axis", { progress: 0 }],
      ...gridValues.map((_, i) => [`grid-${i}`, { progress: 0 }]),
      ...gridValues.map((_, i) => [`tick-${i}`, { opacity: 0, y: 906 }]),
      ...data.map((_, i) => [`bar-${i}`, { width: 0 }]),
      ...data.map((_, i) => [
        `value-${i}`,
        { opacity: 0, content: 0, x: baselineX + valueGap },
      ]),
      ...data.map((_, i) => [`label-${i}`, { opacity: 0, x: baselineX - 62 }]),
    ]),
    built: Object.fromEntries([
      ["title", { opacity: 1, y: 110 }],
      ["subtitle", { opacity: 1, y: 178 }],
      ["axis", { progress: 1 }],
      ...gridValues.map((_, i) => [`grid-${i}`, { progress: 1 }]),
      ...gridValues.map((_, i) => [`tick-${i}`, { opacity: 1, y: 894 }]),
      ...data.map((d, i) => [`bar-${i}`, { width: barLen(d.value) }]),
      ...data.map((d, i) => [
        `value-${i}`,
        { opacity: 1, content: d.value, x: valueX(d.value) },
      ]),
      ...data.map((_, i) => [`label-${i}`, { opacity: 1, x: baselineX - 32 }]),
    ]),
  },
  initial: "empty",

  timeline: seq(
    // Frame: header, baseline, gridlines, and ticks settle in first.
    to("built", {
      duration: 0.6,
      ease: "easeOutCubic",
      stagger: 0.06,
      filter: [
        "title",
        "subtitle",
        "axis",
        ...gridValues.map((_, i) => `grid-${i}`),
        ...gridValues.map((_, i) => `tick-${i}`),
      ],
    }),
    wait(0.1),

    // Bars sweep in top-to-bottom as a wave, each with a springy overshoot:
    // stretch past the target length, then settle back. Values ride along.
    stagger(
      0.12,
      ...data.map((d, i) =>
        seq(
          par(
            tween(
              `bar-${i}`,
              { width: barLen(d.value) * overshoot },
              { duration: 0.5, ease: "easeOutCubic" },
            ),
            tween(
              `label-${i}`,
              { opacity: 1, x: baselineX - 32 },
              { duration: 0.3, ease: "easeOutCubic" },
            ),
            tween(
              `value-${i}`,
              {
                opacity: 1,
                content: d.value,
                x: baselineX + barLen(d.value) * overshoot + valueGap,
              },
              { duration: 0.5, ease: "easeOutCubic" },
            ),
          ),
          // Spring settle back to the true length.
          par(
            tween(
              `bar-${i}`,
              { width: barLen(d.value) },
              { duration: 0.22, ease: "easeInOutQuad" },
            ),
            tween(
              `value-${i}`,
              { x: valueX(d.value) },
              { duration: 0.22, ease: "easeInOutQuad" },
            ),
          ),
        ),
      ),
    ),

    wait(2.2),

    // Exit: bars retract into the baseline in reverse order (Fri first),
    // values and labels collapsing with them.
    stagger(
      0.08,
      ...data
        .map((d, i) => ({ d, i }))
        .reverse()
        .map(({ i }) =>
          par(
            tween(`bar-${i}`, { width: 0 }, { duration: 0.35, ease: "easeInCubic" }),
            tween(
              `value-${i}`,
              { opacity: 0, x: baselineX + valueGap },
              { duration: 0.3, ease: "easeInQuad" },
            ),
            tween(
              `label-${i}`,
              { opacity: 0, x: baselineX - 62 },
              { duration: 0.3, ease: "easeInQuad" },
            ),
          ),
        ),
    ),

    // Frame fades out last.
    to("empty", { duration: 0.45, ease: "easeInCubic" }),
    wait(0.3),
  ),
});
