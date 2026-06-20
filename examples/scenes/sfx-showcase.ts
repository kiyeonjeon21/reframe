import {
  scene, ellipse, text,
  seq, par, beat, tween, wait, oscillate,
} from "@reframe/core";

// SFX PALETTE — fires every procedural sound effect in turn (name + category +
// a pulse on screen) so ONE render auditions the whole library, then a row of
// the SAME sfx to show the auto-variation (each repeat is seeded by cue order →
// a little melody, not a stuck note). Bed = the new "lofi" bgm, low under it.

const W = 1920, H = 1080, CX = 960, CY = 480;
const CAT = {
  transition: "#7C5CFF", ui: "#54D6C0", impact: "#FF6B6B",
  positive: "#FFC861", alert: "#FF3D81",
} as const;

const SFX: { n: string; c: keyof typeof CAT }[] = [
  { n: "whoosh", c: "transition" }, { n: "swish", c: "transition" }, { n: "rise", c: "transition" },
  { n: "riser", c: "transition" }, { n: "warp", c: "transition" },
  { n: "tick", c: "ui" }, { n: "click", c: "ui" }, { n: "blip", c: "ui" },
  { n: "pop", c: "ui" }, { n: "select", c: "ui" },
  { n: "thud", c: "impact" }, { n: "boom", c: "impact" }, { n: "knock", c: "impact" },
  { n: "chime", c: "positive" }, { n: "ding", c: "positive" }, { n: "coin", c: "positive" },
  { n: "sparkle", c: "positive" }, { n: "shimmer", c: "positive" }, { n: "success", c: "positive" },
  { n: "zap", c: "alert" }, { n: "error", c: "alert" },
];

const STEP = 0.6; // seconds between sounds

export default scene({
  id: "sfx-showcase",
  size: { width: W, height: H },
  fps: 30,
  background: "#0A0812",
  nodes: [
    text({ id: "title", x: CX, y: 150, anchor: "center", content: "SFX PALETTE", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#F4F1FF", letterSpacing: 6 }),
    text({ id: "sub", x: CX, y: 210, anchor: "center", content: "21 procedural sounds · seed varies pitch", fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: "#6E6A8A", letterSpacing: 2 }),
    ellipse({ id: "pulse", x: CX, y: CY, width: 360, height: 360, anchor: "center", fill: "#7C5CFF", opacity: 0, scale: 0 }),
    text({ id: "name", x: CX, y: CY, anchor: "center", content: "", fontFamily: "Inter", fontSize: 90, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
    text({ id: "cat", x: CX, y: CY + 110, anchor: "center", content: "", fontFamily: "Inter", fontSize: 28, fontWeight: 700, fill: "#8A86A8", letterSpacing: 4, opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A2150", fixed: true }),
  ],

  timeline: seq(
    wait(0.5),
    ...SFX.map((s) =>
      seq(
        beat(s.n, {}, [
          par(
            tween("name", { content: s.n as never, fill: CAT[s.c] as never, opacity: 1 }, { duration: 0.04 }),
            tween("cat", { content: s.c.toUpperCase() as never, opacity: 1 }, { duration: 0.04 }),
            tween("pulse", { fill: CAT[s.c] as never }, { duration: 0.001 }),
            seq(
              tween("pulse", { scale: 0.5, opacity: 0.7 }, { duration: 0.1, ease: "easeOutCubic" }),
              tween("pulse", { scale: 1.1, opacity: 0 }, { duration: STEP - 0.1, ease: "easeOutCubic" }),
            ),
          ),
        ]),
        wait(STEP - 0.04),
      ),
    ),
    // auto-variation demo: the SAME sfx six times — each repeat seeded by cue
    // order, so the pitch climbs into a little phrase
    beat("vary", {}, [
      par(
        tween("name", { content: "auto-vary" as never, fill: "#54D6C0" as never }, { duration: 0.04 }),
        tween("cat", { content: "SAME SFX · DIFFERENT EACH TIME" as never }, { duration: 0.04 }),
      ),
    ]),
    wait(1.6),
  ),

  behaviors: [
    oscillate("title", "opacity", { amplitude: 0.04, frequency: 0.3 }, { from: 0, until: 16 }),
  ],

  audio: {
    bgm: { synth: "lofi", gain: 0.1, fadeIn: 1.0, fadeOut: 1.5, duck: { depth: 0.4 } },
    cues: [
      ...SFX.map((s) => ({ at: s.n, sfx: s.n as never })),
      // six blips in a row — auto-seeded by cue index → a rising phrase
      ...Array.from({ length: 6 }, (_, i) => ({ at: "vary", offset: i * 0.22, sfx: "blip" as never })),
    ],
  },
});
