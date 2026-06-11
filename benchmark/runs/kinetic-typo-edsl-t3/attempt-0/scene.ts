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
// Layout
//
// Four uppercase words stacked as one optically centered block. Cap heights
// (~0.72em) are used to size each line box, with a constant 60px gap between
// lines, so the block reads as evenly spaced and sits centered on y = 540:
//
//   SHIP / FAST / BREAK : 150px  (cap ~108)   -> centers 266 / 434 / 602
//   NOTHING (punchline) : 210px  (cap ~151)   -> center  792
// ---------------------------------------------------------------------------

const CX = 960;
const EXIT_DIST = 1560; // far enough to clear the frame at either edge

const words = [
  { id: "ship",    content: "SHIP",    y: 266, fontSize: 150, fill: "#FFFFFF", letterSpacing: 10, over: 1.10, dir: -1 },
  { id: "fast",    content: "FAST",    y: 434, fontSize: 150, fill: "#FFFFFF", letterSpacing: 10, over: 1.10, dir:  1 },
  { id: "break",   content: "BREAK",   y: 602, fontSize: 150, fill: "#FFFFFF", letterSpacing: 10, over: 1.10, dir: -1 },
  { id: "nothing", content: "NOTHING", y: 792, fontSize: 210, fill: "#FFC400", letterSpacing: 8,  over: 1.12, dir:  1 },
];

// Punch-in: fade up fast while scaling 0.4 -> slight overshoot, then a short,
// firm settle. Decelerating up / quick settle keeps it punchy, not bouncy.
const punchIn = (id: string, over: number) =>
  seq(
    par(
      tween(id, { opacity: 1 }, { duration: 0.14, ease: "easeOutQuad" }),
      tween(id, { scale: over }, { duration: 0.30, ease: "easeOutCubic" }),
    ),
    tween(id, { scale: 1 }, { duration: 0.16, ease: "easeInOutQuad" }),
  );

// Exit: fly out horizontally, alternating direction per line, accelerating.
const flyOut = (w: (typeof words)[number]) =>
  par(
    tween(w.id, { x: CX + w.dir * EXIT_DIST }, { duration: 0.45, ease: "easeInCubic" }),
    tween(w.id, { opacity: 0 }, { duration: 0.38, ease: "easeInQuad" }),
  );

// ---------------------------------------------------------------------------
// Timing (total = 5.00s exactly)
//   0.00 - 0.50   beat of black
//   0.50 - 1.71   words punch in, 0.25s apart (each pop = 0.46s)
//   1.71 - 4.40   block holds; NOTHING pulses gently (behavior below)
//   4.40 - 5.00   exit: 0.05s flick per line, 0.45s accelerating fly-out
// ---------------------------------------------------------------------------

export default scene({
  id: "kinetic-typo",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0D0D0F",
  nodes: words.map((w) =>
    text({
      id: w.id,
      x: CX,
      y: w.y,
      anchor: "center",
      content: w.content,
      fontFamily: "Inter",
      fontSize: w.fontSize,
      fontWeight: 800,
      fill: w.fill,
      letterSpacing: w.letterSpacing,
      opacity: 0,
      scale: 0.4,
    }),
  ),
  timeline: seq(
    wait(0.5),
    stagger(0.25, ...words.map((w) => punchIn(w.id, w.over))),
    wait(2.69),
    stagger(0.05, ...words.map((w) => flyOut(w))),
  ),
  behaviors: [
    // Subtle continuous pulse on the punchline so the hold never feels frozen.
    oscillate("nothing", "scale", { amplitude: 0.018, frequency: 0.9 }),
  ],
});
