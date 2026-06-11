import {
  scene,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  oscillate,
} from "@reframe/core";

// ---------------------------------------------------------------------------
// Kinetic typography statement — SHIP / FAST / BREAK / NOTHING
// 1920x1080 @ 30fps, total duration exactly 5.0s, background #0D0D0F.
// ---------------------------------------------------------------------------

// Vertical layout: optically centered block around y = 540.
// Line boxes: 150, 150, 150, 210 with 42px gaps -> block height 786,
// block top = 540 - 393 = 147. Line centers fall out below.
const WORDS = [
  { id: "word-ship",    content: "SHIP",    y: 222, fontSize: 150, fill: "#FFFFFF", exitX: -760 },
  { id: "word-fast",    content: "FAST",    y: 414, fontSize: 150, fill: "#FFFFFF", exitX: 2680 },
  { id: "word-break",   content: "BREAK",   y: 606, fontSize: 150, fill: "#FFFFFF", exitX: -760 },
  { id: "word-nothing", content: "NOTHING", y: 828, fontSize: 210, fill: "#FFC400", exitX: 2680 },
] as const;

// One word's punch-in: fade up while scaling 0.4 -> 1.12 (quick overshoot),
// then settle crisply back to 1. Energetic, not bouncy.
const punchIn = (id: string) =>
  seq(
    par(
      tween(id, { opacity: 1 }, { duration: 0.18, ease: "easeOutQuad" }),
      tween(id, { scale: 1.12 }, { duration: 0.3, ease: "easeOutCubic" }),
    ),
    tween(id, { scale: 1 }, { duration: 0.2, ease: "easeInOutQuad" }),
  );

// One line's exit: fast horizontal fly-out (direction alternates per line),
// accelerating, while fading.
const flyOut = (id: string, exitX: number) =>
  par(
    tween(id, { x: exitX }, { duration: 0.52, ease: "easeInCubic" }),
    tween(id, { opacity: 0 }, { duration: 0.38, ease: "easeInQuad" }),
  );

export default scene({
  id: "kinetic-typo-statement",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0D0D0F",
  nodes: WORDS.map((w) =>
    text({
      id: w.id,
      x: 960,
      y: w.y,
      anchor: "center",
      content: w.content,
      fontFamily: "Inter",
      fontSize: w.fontSize,
      fontWeight: 800,
      fill: w.fill,
      letterSpacing: w.fontSize === 210 ? 10 : 8,
      opacity: 0,
      scale: 0.4,
    }),
  ),
  states: {
    hidden: Object.fromEntries(
      WORDS.map((w) => [w.id, { opacity: 0, scale: 0.4 }]),
    ),
  },
  initial: "hidden",
  timeline: seq(
    // Lead-in beat on the dark frame.
    wait(0.8),

    // 1) Words punch in, reading order, 0.25s apart.
    //    Block length = 3 * 0.25 + 0.50 = 1.25s -> last word lands at t = 2.05.
    stagger(0.25, ...WORDS.map((w) => punchIn(w.id))),

    // 2) Full block holds (~1.85s). NOTHING keeps a subtle pulse via behavior.
    wait(1.85),

    // 3) Final ~0.6s: lines fly out horizontally, alternating directions,
    //    tightly staggered top to bottom. Length = 3 * 0.06 + 0.52 = 0.70s.
    stagger(0.06, ...WORDS.map((w) => flyOut(w.id, w.exitX))),

    // Tail to land the cut at exactly 5.0s total.
    wait(0.4),
  ),
  behaviors: [
    // Gentle continuous scale pulse on the punchline so the hold never freezes.
    oscillate("word-nothing", "scale", { amplitude: 0.018, frequency: 1.1 }),
  ],
});
