import {
  scene, ellipse, text,
  seq, par, beat, tween, wait, oscillate,
} from "@reframe/core";

// CC0 SAMPLE LIBRARY — auditions the recorded sample files in assets/sfx/ (a
// different layer from the procedural synth palette in sfx-showcase.ts). These
// are played with `file:` cues, not `sfx:`. Useful for keyboard typing
// (keypress-*), footsteps, and the Kenney UI pack (click/confirm/select/…).

const W = 1920, H = 1080, CX = 960, CY = 480;
const GRP = {
  keypress: "#54D6C0", footstep: "#E08CFF", click: "#3AA0FF",
  confirm: "#46E5A0", maximize: "#FFC861", select: "#7C5CFF",
  pluck: "#FF6FA5", misc: "#FF6B6B", ui: "#9D8CFF", impact: "#FF8A5C",
} as const;

const SAMPLES: { f: string; g: keyof typeof GRP }[] = [
  { f: "keypress-001.wav", g: "keypress" }, { f: "keypress-004.wav", g: "keypress" },
  { f: "keypress-007.wav", g: "keypress" }, { f: "keypress-010.wav", g: "keypress" }, { f: "keypress-014.wav", g: "keypress" },
  { f: "footstep_001.ogg", g: "footstep" }, { f: "footstep_002.ogg", g: "footstep" }, { f: "footstep_003.ogg", g: "footstep" },
  { f: "click_001.ogg", g: "click" }, { f: "click_002.ogg", g: "click" }, { f: "click_003.ogg", g: "click" }, { f: "click_004.ogg", g: "click" },
  { f: "confirmation_001.ogg", g: "confirm" }, { f: "confirmation_002.ogg", g: "confirm" }, { f: "confirmation_003.ogg", g: "confirm" }, { f: "confirmation_004.ogg", g: "confirm" },
  { f: "maximize_001.ogg", g: "maximize" }, { f: "maximize_002.ogg", g: "maximize" }, { f: "maximize_005.ogg", g: "maximize" }, { f: "maximize_009.ogg", g: "maximize" },
  { f: "select_001.ogg", g: "select" }, { f: "select_002.ogg", g: "select" }, { f: "select_003.ogg", g: "select" },
  { f: "pluck_001.ogg", g: "pluck" }, { f: "pluck_002.ogg", g: "pluck" },
  { f: "bong_001.ogg", g: "misc" }, { f: "glass_001.ogg", g: "misc" }, { f: "open_001.ogg", g: "misc" },
  // Kenney Interface — added UI families
  { f: "back_001.ogg", g: "ui" }, { f: "back_002.ogg", g: "ui" },
  { f: "close_001.ogg", g: "ui" }, { f: "close_002.ogg", g: "ui" },
  { f: "drop_001.ogg", g: "ui" }, { f: "drop_002.ogg", g: "ui" },
  { f: "error_001.ogg", g: "ui" }, { f: "error_002.ogg", g: "ui" },
  { f: "glitch_001.ogg", g: "ui" }, { f: "glitch_002.ogg", g: "ui" },
  { f: "minimize_001.ogg", g: "ui" }, { f: "minimize_002.ogg", g: "ui" },
  { f: "switch_001.ogg", g: "ui" }, { f: "switch_002.ogg", g: "ui" },
  { f: "toggle_001.ogg", g: "ui" }, { f: "toggle_002.ogg", g: "ui" },
  { f: "scroll_001.ogg", g: "ui" }, { f: "scratch_001.ogg", g: "ui" },
  // Kenney RPG Audio — impact / foley
  { f: "chop.ogg", g: "impact" }, { f: "knifeSlice.ogg", g: "impact" }, { f: "knifeSlice2.ogg", g: "impact" },
  { f: "metalClick.ogg", g: "impact" }, { f: "metalLatch.ogg", g: "impact" },
  { f: "metalPot1.ogg", g: "impact" }, { f: "metalPot2.ogg", g: "impact" },
  { f: "handleCoins.ogg", g: "impact" }, { f: "handleCoins2.ogg", g: "impact" },
  { f: "doorOpen_1.ogg", g: "impact" }, { f: "doorClose_1.ogg", g: "impact" },
  { f: "creak1.ogg", g: "impact" }, { f: "bookFlip1.ogg", g: "impact" },
];

const stem = (f: string) => f.replace(/\.[^.]+$/, "");
const STEP = 0.55;

export default scene({
  id: "sample-showcase",
  size: { width: W, height: H },
  fps: 30,
  background: "#0A0812",
  nodes: [
    text({ id: "title", x: CX, y: 150, anchor: "center", content: "CC0 SAMPLE LIBRARY", fontFamily: "Inter", fontSize: 60, fontWeight: 800, fill: "#F4F1FF", letterSpacing: 5 }),
    text({ id: "sub", x: CX, y: 210, anchor: "center", content: "recorded files · play with file: cues", fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: "#6E6A8A", letterSpacing: 2 }),
    ellipse({ id: "pulse", x: CX, y: CY, width: 360, height: 360, anchor: "center", fill: "#54D6C0", opacity: 0, scale: 0 }),
    text({ id: "name", x: CX, y: CY, anchor: "center", content: "", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
    text({ id: "cat", x: CX, y: CY + 100, anchor: "center", content: "", fontFamily: "Inter", fontSize: 28, fontWeight: 700, fill: "#8A86A8", letterSpacing: 4, opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A2150", fixed: true }),
  ],

  timeline: seq(
    wait(0.5),
    ...SAMPLES.map((s) =>
      seq(
        beat(stem(s.f), {}, [
          par(
            tween("name", { content: stem(s.f) as never, fill: GRP[s.g] as never, opacity: 1 }, { duration: 0.04 }),
            tween("cat", { content: s.g.toUpperCase() as never, opacity: 1 }, { duration: 0.04 }),
            tween("pulse", { fill: GRP[s.g] as never }, { duration: 0.001 }),
            seq(
              tween("pulse", { scale: 0.5, opacity: 0.7 }, { duration: 0.1, ease: "easeOutCubic" }),
              tween("pulse", { scale: 1.1, opacity: 0 }, { duration: STEP - 0.1, ease: "easeOutCubic" }),
            ),
          ),
        ]),
        wait(STEP - 0.04),
      ),
    ),
    wait(1.0),
  ),

  behaviors: [
    oscillate("title", "opacity", { amplitude: 0.04, frequency: 0.3 }, { from: 0, until: 40 }),
  ],

  audio: {
    cues: SAMPLES.map((s) => ({ at: stem(s.f), file: s.f })),
  },
});
