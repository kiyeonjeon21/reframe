import {
  scene, rect, ellipse, text,
  seq, par, beat, tween, wait,
} from "@reframe/core";

// SYNTH vs SAMPLE — for the six original names that have both a procedural recipe
// AND a vendored CC0 .wav (whoosh/rise/shimmer/thud/pop/tick), play them back to
// back so you can A/B which you prefer. Synth (`sfx:`) pitch-varies; the sample
// (`file: "<name>.wav"`) is the fixed recording. Pick per sound, then I'll set the
// winners as the default for each name.

const W = 1920, H = 1080, CX = 960, CY = 470;
const SYN = "#54D6C0", SAM = "#FF8A5C";
const NAMES = ["whoosh", "rise", "shimmer", "thud", "pop", "tick"];
const STEP = 0.85;

export default scene({
  id: "sfx-compare",
  size: { width: W, height: H },
  fps: 30,
  background: "#0A0812",
  nodes: [
    text({ id: "title", x: CX, y: 150, anchor: "center", content: "SYNTH  vs  SAMPLE", fontFamily: "Inter", fontSize: 60, fontWeight: 800, fill: "#F4F1FF", letterSpacing: 5 }),
    text({ id: "sub", x: CX, y: 210, anchor: "center", content: "the 6 original names · which do you prefer?", fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: "#6E6A8A", letterSpacing: 2 }),
    ellipse({ id: "pulse", x: CX, y: CY, width: 320, height: 320, anchor: "center", fill: SYN, opacity: 0, scale: 0 }),
    text({ id: "name", x: CX, y: CY, anchor: "center", content: "", fontFamily: "Inter", fontSize: 88, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
    rect({ id: "tagbg", x: CX, y: CY + 120, width: 230, height: 56, radius: 28, anchor: "center", fill: SYN, opacity: 0 }),
    text({ id: "tag", x: CX, y: CY + 120, anchor: "center", content: "", fontFamily: "Inter", fontSize: 28, fontWeight: 800, fill: "#0A0812", letterSpacing: 3, opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A2150", fixed: true }),
  ],

  timeline: seq(
    wait(0.5),
    ...NAMES.flatMap((nm) => [
      // synth take
      beat(`${nm}-synth`, {}, [
        par(
          tween("name", { content: nm as never, opacity: 1 }, { duration: 0.04 }),
          tween("tag", { content: "SYNTH" as never, opacity: 1 }, { duration: 0.04 }),
          tween("tagbg", { fill: SYN as never, opacity: 1 }, { duration: 0.04 }),
          tween("pulse", { fill: SYN as never }, { duration: 0.001 }),
          seq(
            tween("pulse", { scale: 0.5, opacity: 0.7 }, { duration: 0.1, ease: "easeOutCubic" }),
            tween("pulse", { scale: 1.0, opacity: 0 }, { duration: STEP - 0.1, ease: "easeOutCubic" }),
          ),
        ),
      ]),
      wait(STEP - 0.04),
      // sample take
      beat(`${nm}-sample`, {}, [
        par(
          tween("tag", { content: "SAMPLE" as never }, { duration: 0.04 }),
          tween("tagbg", { fill: SAM as never }, { duration: 0.04 }),
          tween("pulse", { fill: SAM as never }, { duration: 0.001 }),
          seq(
            tween("pulse", { scale: 0.5, opacity: 0.7 }, { duration: 0.1, ease: "easeOutCubic" }),
            tween("pulse", { scale: 1.0, opacity: 0 }, { duration: STEP - 0.1, ease: "easeOutCubic" }),
          ),
        ),
      ]),
      wait(STEP - 0.04),
    ]),
    wait(0.8),
  ),

  audio: {
    cues: [
      ...NAMES.map((nm) => ({ at: `${nm}-synth`, sfx: nm as never })),
      ...NAMES.map((nm) => ({ at: `${nm}-sample`, file: `${nm}.wav` })),
    ],
  },
});
