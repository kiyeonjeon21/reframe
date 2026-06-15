import {
  composition,
  scene,
  group,
  rect,
  text,
  ellipse,
  seq,
  par,
  beat,
  tween,
  wait,
  type SceneIR,
} from "@reframe/core";

// A composition is the layer ABOVE a scene: three independent scenes laid out
// on one timeline with transitions + a bed that spans them. Each scene still
// renders/previews standalone (reframe render promo.ts --scene <id>).

const SIZE = { width: 1280, height: 720 };
const BG = "#0B0D12";
const ACCENT = "#FF4D00";

// ---- scene 1: logo lockup ----
const intro = (): SceneIR =>
  scene({
    id: "intro",
    size: SIZE,
    fps: 30,
    background: BG,
    nodes: [
      group({ id: "lockup", x: 640, y: 360 }, [
        ellipse({ id: "disc", x: 0, y: -40, width: 150, height: 150, anchor: "center", fill: ACCENT, opacity: 0, scale: 0.3 }),
        text({ id: "word", x: 0, y: 90, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
      ]),
    ],
    // a beat that OWNS the lockup's nodes — the intent unit "logo-reveal"
    timeline: beat("logo-reveal", { nodes: ["disc", "word"] }, [
      par(
        tween("disc", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutExpo", label: "disc-in" }),
        seq(wait(0.2), tween("word", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "word-in" })),
      ),
      wait(0.6),
    ]),
    audio: { cues: [{ at: "disc-in", sfx: "whoosh", gain: 0.8 }, { at: "word-in", sfx: "pop", gain: 0.6 }] },
  });

// ---- scene 2: a feature line ----
const feature = (): SceneIR =>
  scene({
    id: "feature",
    size: SIZE,
    fps: 30,
    background: BG,
    nodes: [
      rect({ id: "bar", x: 220, y: 330, width: 8, height: 60, fill: ACCENT, opacity: 0 }),
      text({ id: "headline", x: 250, y: 326, content: "scenes compose", fontFamily: "Inter", fontSize: 52, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
    ],
    timeline: beat("headline", { nodes: ["bar", "headline"] }, [
      par(
        tween("bar", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "bar-in" }),
        seq(wait(0.1), tween("headline", { opacity: 1, x: 270 }, { duration: 0.5, ease: "easeOutCubic", label: "head-in" })),
      ),
      wait(0.7),
    ]),
    audio: { cues: [{ at: "head-in", sfx: "rise", gain: 0.5 }] },
  });

// ---- scene 3: close ----
const outro = (): SceneIR =>
  scene({
    id: "outro",
    size: SIZE,
    fps: 30,
    background: BG,
    nodes: [
      text({ id: "cta", x: 640, y: 360, anchor: "center", content: "reframe — own it", fontFamily: "Inter", fontSize: 44, fill: "#8B93A7", opacity: 0 }),
    ],
    timeline: beat("close", { nodes: ["cta"] }, [
      tween("cta", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "cta-in" }),
      wait(0.6),
    ]),
    audio: { cues: [{ at: "cta-in", sfx: "shimmer", gain: 0.6 }] },
  });

export default composition({
  id: "promo",
  scenes: [
    { scene: intro() },
    { scene: feature(), transition: "crossfade" }, // blends out of the logo
    { scene: outro() }, // hard cut
  ],
  // a bed that spans all three scenes (swap in a kokoro narration file later)
  audio: { bgm: { synth: "ambient-pad", gain: 0.28, fadeIn: 0.8, fadeOut: 1.0 } },
});
