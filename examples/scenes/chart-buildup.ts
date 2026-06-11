import { scene, rect, text, line, seq, to, wait } from "@reframe/core";

const data = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 71 },
  { label: "Wed", value: 55 },
  { label: "Thu", value: 90 },
  { label: "Fri", value: 64 },
];

const chart = { x: 360, y: 220, width: 1200, height: 600 };
const barWidth = 120;
const gap = (chart.width - data.length * barWidth) / (data.length - 1);
const maxValue = Math.max(...data.map((d) => d.value));
const barHeight = (v: number) => (v / maxValue) * chart.height;
const barX = (i: number) => chart.x + i * (barWidth + gap);
const baseline = chart.y + chart.height;

export default scene({
  id: "chart-buildup",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0B0E14",
  nodes: [
    text({
      id: "title",
      x: chart.x,
      y: 100,
      content: "Weekly Active Users",
      fontFamily: "Inter",
      fontSize: 44,
      fontWeight: 700,
      fill: "#FFFFFF",
    }),
    line({
      id: "axis",
      x1: chart.x - 24,
      y1: baseline,
      x2: chart.x + chart.width + 24,
      y2: baseline,
      stroke: "#444444",
      strokeWidth: 3,
    }),
    ...data.map((d, i) =>
      rect({
        id: `bar-${i}`,
        x: barX(i),
        y: baseline,
        width: barWidth,
        height: barHeight(d.value),
        anchor: "bottom-left", // height animates upward from the axis
        fill: "#3B82F6",
        radius: 8,
      }),
    ),
    ...data.map((d, i) =>
      text({
        id: `value-${i}`,
        x: barX(i) + barWidth / 2,
        y: baseline - barHeight(d.value) - 16,
        anchor: "bottom-center",
        content: d.value, // numeric content interpolates -> count-up
        fontFamily: "Inter",
        fontSize: 36,
        fontWeight: 700,
        fill: "#FFFFFF",
      }),
    ),
    ...data.map((d, i) =>
      text({
        id: `label-${i}`,
        x: barX(i) + barWidth / 2,
        y: baseline + 24,
        anchor: "top-center",
        content: d.label,
        fontFamily: "Inter",
        fontSize: 28,
        fill: "#8B93A7",
      }),
    ),
  ],

  // State objects are plain data, so they can be generated with host-language code.
  states: {
    empty: Object.fromEntries([
      ["title", { opacity: 0, y: 80 }],
      ["axis", { progress: 0 }],
      ...data.map((_, i) => [`bar-${i}`, { height: 0 }]),
      ...data.map((_, i) => [`value-${i}`, { opacity: 0, content: 0, y: baseline - 16 }]),
      ...data.map((_, i) => [`label-${i}`, { opacity: 0 }]),
    ]),
    built: Object.fromEntries([
      ["title", { opacity: 1, y: 100 }],
      ["axis", { progress: 1 }],
      ...data.map((d, i) => [`bar-${i}`, { height: barHeight(d.value) }]),
      ...data.map((d, i) => [
        `value-${i}`,
        { opacity: 1, content: d.value, y: baseline - barHeight(d.value) - 16 },
      ]),
      ...data.map((_, i) => [`label-${i}`, { opacity: 1 }]),
    ]),
  },
  initial: "empty",

  timeline: seq(
    to("built", { duration: 0.7, ease: "easeOutQuart", stagger: 0.09 }),
    wait(2.5),
    to("empty", { duration: 0.5, ease: "easeInCubic" }),
  ),
});
