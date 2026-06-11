import { scene, text, seq, par, stagger, tween, wait, oscillate } from "@reframe/core";

// ---------------------------------------------------------------------------
// Kinetic typography: SHIP / FAST / BREAK / NOTHING
// 1920x1080 @ 30fps, total duration exactly 5.0s
//
// Vertical layout (block optically centered):
//   small lines: 160px, punchline: 250px, consistent 30px inter-line gap.
//   centers -> 210 / 400 / 590 / 825 (block spans 130..950, centered on 540)
//
// Timing budget (sums to exactly 5.0s):
//   lead-in           0.35
//   punch-in stagger  0.25 * 3 + 0.34 = 1.09   (last word lands at t=1.44)
//   hold              2.94                      (NOTHING pulses gently)
//   exit stagger      0.04 * 3 + 0.50 = 0.62   (ends at t=5.00)
// ---------------------------------------------------------------------------

const CX = 960;

const words = [
  { id: "word-ship",    label: "SHIP",    y: 210, size: 160, weight: 800, fill: "#FFFFFF", tracking: 6,  exitX: -700 },
  { id: "word-fast",    label: "FAST",    y: 400, size: 160, weight: 800, fill: "#FFFFFF", tracking: 6,  exitX: 2620 },
  { id: "word-break",   label: "BREAK",   y: 590, size: 160, weight: 800, fill: "#FFFFFF", tracking: 6,  exitX: -700 },
  { id: "word-nothing", label: "NOTHING", y: 825, size: 250, weight: 800, fill: "#FFC400", tracking: 8,  exitX: 2620 },
];

// One word's punch-in: fade up while scaling 0.4 -> 1.10, then a single
// quick settle back to 1.0 (energetic, not bouncy).
const punchIn = (id: string) =>
  seq(
    par(
      tween(id, { opacity: 1 }, { duration: 0.12, ease: "easeOutQuad" }),
      tween(id, { scale: 1.10 }, { duration: 0.22, ease: "easeOutCubic" }),
    ),
    tween(id, { scale: 1 }, { duration: 0.12, ease: "easeInOutQuad" }),
  );

// Fast horizontal fly-out, accelerating, alternating direction per line.
const flyOut = (id: string, exitX: number) =>
  par(
    tween(id, { x: exitX }, { duration: 0.5, ease: "easeInCubic" }),
    tween(id, { opacity: 0 }, { duration: 0.45, ease: "easeInQuad" }),
  );

export default scene({
  id: "kinetic-typo-statement",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0D0D0F",
  nodes: words.map((w) =>
    text({
      id: w.id,
      x: CX,
      y: w.y,
      anchor: "center",
      content: w.label,
      fontFamily: "Inter",
      fontSize: w.size,
      fontWeight: w.weight,
      fill: w.fill,
      letterSpacing: w.tracking,
    }),
  ),
  states: {
    // Start hidden and small; base props above are the finished design.
    hidden: Object.fromEntries(words.map((w) => [w.id, { opacity: 0, scale: 0.4 }])),
  },
  initial: "hidden",
  timeline: seq(
    // Lead-in beat.
    wait(0.35),

    // 1) Words punch in, reading order, 0.25s apart.
    stagger(0.25, ...words.map((w) => punchIn(w.id))),

    // 2) Hold the full block; NOTHING pulses via the behavior below.
    wait(2.94),

    // 3) Final ~0.6s: lines fly out horizontally, alternating directions.
    stagger(0.04, ...words.map((w) => flyOut(w.id, w.exitX))),
  ),
  behaviors: [
    // Subtle continuous pulse on the punchline so the hold never feels frozen.
    oscillate("word-nothing", "scale", { amplitude: 0.022, frequency: 1.1 }),
  ],
});
