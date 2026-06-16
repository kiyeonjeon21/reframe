import { scene, group, seq, par, beat, tween, wait, type NodeIR, type DevicePresetName, type TimelineIR } from "@reframe/core";
import { BG, FG, MUTED, SUB, CARD, CARD2, ri, tx, slot, deviceHero, signature } from "../lib/deviceKit.js";

// The X promo cut (16:9, ~26s), authored so the whole film is a reframe render
// — the dogfood flex. Spine: a fast signature-motion montage (the hook) → "one
// call each" title → an editor schematic (how you tweak it) → the regen payoff
// (your edits survive) → end card. The live-editor insert is captured separately
// from the real preview; this film stands on its own for the dogfood claim.

const CX = 960;
const CY = 540;
const ACC = "#FF4D00";

// ── cold open: six signature motions, centred, crossfading fast ──
const MONTAGE: DevicePresetName[] = ["watch", "tablet", "car", "foldable", "monitor", "terminal"];
const montageStages: NodeIR[] = MONTAGE.map((name, i) =>
  group({ id: `stage-${name}`, x: CX, y: CY + 24, opacity: 0 }, [
    deviceHero(name, SUB[i % SUB.length]!),
    tx(`${name}-cap`, 0, 402, `devicePreset("${name}")`, 26, 700, MUTED, "center"),
  ]),
);
const montageBeat = (name: DevicePresetName): TimelineIR =>
  beat(name, { nodes: [name] }, [
    seq(
      tween(`stage-${name}`, { opacity: 1, y: CY }, { duration: 0.35, ease: "easeOutCubic", label: `${name}-in` }),
      signature(name),
      wait(0.15),
      tween(`stage-${name}`, { opacity: 0, y: CY - 18 }, { duration: 0.35, ease: "easeInCubic", label: `${name}-out` }),
    ),
  ]);
const MDWELL = 1.95;
const montage: TimelineIR = par(...MONTAGE.map((name, i) => seq(wait(i * MDWELL), montageBeat(name))));

// ── title ──
const titleGrp = group({ id: "title-grp", x: CX, y: CY, opacity: 0 }, [
  slot("ttl-1", 0, 24, [tx("ttl-1t", 0, -70, "10 device presets.", 78, 800, FG, "center")]),
  slot("ttl-2", 0, 24, [tx("ttl-2t", 0, 14, "10 signature motions.", 78, 800, ACC, "center")]),
  slot("ttl-3", 0, 24, [tx("ttl-3t", 0, 96, "one devicePreset() call each.", 30, 400, MUTED, "center")]),
]);
const titleBeat: TimelineIR = beat("title", {}, [
  seq(
    par(
      tween("title-grp", { opacity: 1 }, { duration: 0.3, label: "title-in" }),
      tween("ttl-1", { x: 0, y: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      seq(wait(0.12), tween("ttl-2", { x: 0, y: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.26), tween("ttl-3", { x: 0, y: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
    ),
    wait(1.5),
    tween("title-grp", { opacity: 0, y: CY - 24 }, { duration: 0.45, ease: "easeInCubic", label: "title-out" }),
  ),
]);

// ── editor schematic: drag a beat to retime, saved as a non-destructive overlay ──
const editorGrp = group({ id: "ed-grp", x: CX, y: CY, opacity: 0 }, [
  ri("ed-panel", 0, -40, 1120, 540, "#0D0F16", 20),
  ri("ed-bar", 0, -286, 1120, 48, CARD2, 0),
  tx("ed-file", -520, -286, "preview · scene.ts", 16, 600, MUTED),
  // a device thumbnail standing in for the canvas
  ri("ed-canvas", -300, -70, 360, 300, CARD, 16),
  ri("ed-cv-bar", -300, -150, 240, 22, ACC, 8),
  ...[0, 1, 2].map((i) => ri(`ed-cv-r${i}`, -300, -70 + i * 40, 220, 14, "#222634", 6)),
  // the timeline: three beat chips on a track
  ri("ed-track", 0, 168, 1000, 70, "#12141B", 14),
  ri("ed-b0", -330, 168, 200, 46, "#3B82F6", 8),
  group({ id: "ed-b1g", x: 0, y: 0 }, [ri("ed-b1", -40, 168, 230, 46, ACC, 8)]),
  ri("ed-b2", 320, 168, 150, 46, "#7C5CFF", 8),
  ri("ed-playhead", -40, 168, 3, 90, FG, 2),
  // cursor + the overlay chip that proves it is non-destructive
  group({ id: "ed-cursor", x: -40, y: 150, opacity: 0 }, [ri("ed-cur", 0, 0, 16, 16, FG, 3, { rotation: 45 })]),
  slot("ed-chip", 30, 0, [
    ri("ed-chipbg", 250, 168, 260, 46, "#10231A", 10),
    tx("ed-chiptext", 250, 168, "overlay { gap: +0.8s }", 17, 700, "#10B981", "center"),
  ]),
  tx("ed-cap", 0, 250, "edit it like a video. saved as a non-destructive overlay.", 24, 500, FG, "center"),
]);
const editorBeat: TimelineIR = beat("editor", {}, [
  seq(
    tween("ed-grp", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "ed-in" }),
    tween("ed-cursor", { opacity: 1 }, { duration: 0.2 }),
    // grab the middle beat chip and drag it right (retime); cursor + playhead follow
    par(
      tween("ed-b1g", { x: 120 }, { duration: 0.7, ease: "easeInOutCubic", label: "retime" }),
      tween("ed-cursor", { x: 80 }, { duration: 0.7, ease: "easeInOutCubic" }),
      tween("ed-playhead", { x: 80 }, { duration: 0.7, ease: "easeInOutCubic" }),
    ),
    tween("ed-chip", { x: 0, opacity: 1 }, { duration: 0.4, ease: "easeOutBack", label: "chip" }),
    wait(1.6),
    tween("ed-grp", { opacity: 0, y: CY - 24 }, { duration: 0.45, ease: "easeInCubic", label: "ed-out" }),
  ),
]);

// ── payoff: AI regenerates the base, your edits survive ──
const payoffGrp = group({ id: "pay-grp", x: CX, y: CY, opacity: 0 }, [
  tx("pay-h", 0, -200, "AI rewrites the scene.", 56, 800, FG, "center"),
  slot("pay-base", -40, 0, [
    ri("pay-base-bg", -300, -10, 420, 220, CARD, 18),
    tx("pay-base-t", -300, -90, "base.ts", 20, 700, MUTED, "center"),
    ...[0, 1, 2].map((i) => ri(`pay-base-l${i}`, -300, -30 + i * 34, 320 - i * 40, 14, "#2A2F3D", 6)),
  ]),
  tx("pay-arrow", 60, 0, "→", 60, 800, MUTED, "center"),
  slot("pay-new", 40, 0, [
    ri("pay-new-bg", 320, -10, 420, 220, CARD, 18),
    tx("pay-new-t", 320, -90, "regenerated.ts", 20, 700, MUTED, "center"),
    ...[0, 1, 2].map((i) => ri(`pay-new-l${i}`, 320, -30 + i * 34, 300 - i * 30, 14, "#2A2F3D", 6)),
  ]),
  slot("pay-survive", 0, 30, [
    ri("pay-sv-bg", 0, 200, 540, 56, "#10231A", 14),
    tx("pay-sv-t", 0, 200, "✓  your edits survived", 24, 700, "#10B981", "center"),
  ]),
]);
const payoffBeat: TimelineIR = beat("payoff", {}, [
  seq(
    par(
      tween("pay-grp", { opacity: 1 }, { duration: 0.35, label: "pay-in" }),
      tween("pay-h", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" }),
      seq(wait(0.15), tween("pay-base", { x: 0, opacity: 1 }, { duration: 0.45, ease: "easeOutCubic" })),
      seq(wait(0.4), tween("pay-new", { x: 0, opacity: 1 }, { duration: 0.45, ease: "easeOutCubic" })),
    ),
    tween("pay-survive", { y: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutBack", label: "survive" }),
    wait(1.8),
    tween("pay-grp", { opacity: 0, y: CY - 24 }, { duration: 0.45, ease: "easeInCubic", label: "pay-out" }),
  ),
]);

// ── end card ──
const endGrp = group({ id: "end-grp", x: CX, y: CY, opacity: 0 }, [
  slot("end-logo", 0, 0, [tx("end-logo-t", 0, -60, "reframe", 100, 800, FG, "center")], 1),
  tx("end-line", 0, 24, "AI writes it.  you edit it.  it renders the same every time.", 27, 400, MUTED, "center"),
  ri("end-pill", 0, 110, 560, 56, CARD, 14),
  tx("end-url", 0, 110, "github.com/kiyeonjeon21/reframe", 24, 700, ACC, "center"),
]);
const endBeat: TimelineIR = beat("endcard", {}, [
  seq(
    par(
      tween("end-grp", { opacity: 1 }, { duration: 0.4, label: "end-in" }),
      tween("end-logo", { scale: 1 }, { duration: 0.6, ease: "easeOutBack" }),
      seq(wait(0.25), tween("end-line", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.45), tween("end-url", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
    ),
    wait(2.2),
  ),
]);

export default scene({
  id: "x-demo",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    tx("wm", 64, 54, "reframe", 22, 800, "#3A3F4C"),
    tx("footer", 960, 1040, "every frame in this video is a reframe render", 17, 400, "#3A3F4C", "center"),
    ...montageStages,
    titleGrp,
    editorGrp,
    payoffGrp,
    endGrp,
  ],
  timeline: seq(
    montage,
    wait(0.15), // a breath after the montage settles
    titleBeat,
    editorBeat,
    payoffBeat,
    endBeat,
  ),
  // Label-anchored audio: a CC0 music bed, a Kokoro voiceover, and real CC0
  // samples (Cherry mechanical keypresses, Kenney UI clicks, a confirmation) on
  // the tactile beats. All anchor to timeline labels, so they survive retiming.
  audio: {
    bgm: { file: "bgm-song21.mp3", gain: 0.17, fadeIn: 1.5, fadeOut: 2, duck: { depth: 0.5 } },
    cues: [
      // ── Kokoro-82M voiceover (examples/scenes/x-demo-vo/, regen with generate.py) ──
      { at: "watch-in", file: "x-demo-vo/intro.wav", gain: 1.15 },
      { at: "car-in", file: "x-demo-vo/claim.wav", gain: 1.15 },
      { at: "ed-in", offset: 0.2, file: "x-demo-vo/edit.wav", gain: 1.15 },
      { at: "pay-in", offset: 0.1, file: "x-demo-vo/survive.wav", gain: 1.15 },
      { at: "end-in", offset: 0.2, file: "x-demo-vo/outro.wav", gain: 1.15 },
      // ── montage entrances: soft air ──
      { at: "watch-in", sfx: "whoosh", gain: 0.22 },
      { at: "tablet-in", sfx: "whoosh", gain: 0.22 },
      { at: "car-in", sfx: "whoosh", gain: 0.2 },
      { at: "monitor-in", sfx: "whoosh", gain: 0.22 },
      { at: "terminal-in", sfx: "whoosh", gain: 0.2 },
      // ── watch: ring sweep + close ──
      { at: "ring", sfx: "shimmer", gain: 0.3 },
      { at: "ring", offset: 0.95, file: "confirmation_001.ogg", gain: 0.4 },
      // ── tablet: real mechanical keypresses as icons land ──
      { at: "tablet-in", offset: 0.18, file: "keypress-001.wav", gain: 0.45 },
      { at: "tablet-in", offset: 0.34, file: "keypress-004.wav", gain: 0.42 },
      { at: "tablet-in", offset: 0.5, file: "keypress-007.wav", gain: 0.42 },
      { at: "tablet-in", offset: 0.66, file: "keypress-010.wav", gain: 0.4 },
      // ── car: route draw + arrival ──
      { at: "route", sfx: "rise", gain: 0.26 },
      { at: "eta", file: "confirmation_001.ogg", gain: 0.4 },
      // ── foldable: the hinge opens, UI clicks on ──
      { at: "unfold", sfx: "whoosh", gain: 0.42 },
      { at: "light", file: "click_003.ogg", gain: 0.4 },
      // ── monitor: soft taps as bars grow ──
      { at: "monitor-in", offset: 0.5, file: "keypress-004.wav", gain: 0.3 },
      { at: "monitor-in", offset: 0.62, file: "keypress-007.wav", gain: 0.3 },
      { at: "monitor-in", offset: 0.74, file: "keypress-010.wav", gain: 0.3 },
      // ── terminal: typing then a confirm ──
      { at: "terminal-in", offset: 0.12, file: "keypress-001.wav", gain: 0.42 },
      { at: "terminal-in", offset: 0.26, file: "keypress-007.wav", gain: 0.4 },
      { at: "terminal-in", offset: 0.4, file: "keypress-014.wav", gain: 0.4 },
      { at: "terminal-in", offset: 0.78, file: "confirmation_001.ogg", gain: 0.36 },
      // ── title lands ──
      { at: "title-in", offset: 0.4, sfx: "thud", gain: 0.5 },
      // ── editor: grab the beat, overlay saved ──
      { at: "retime", file: "click_002.ogg", gain: 0.5 },
      { at: "chip", file: "confirmation_001.ogg", gain: 0.4 },
      // ── payoff: edits survive ──
      { at: "pay-in", sfx: "whoosh", gain: 0.24 },
      { at: "survive", file: "confirmation_001.ogg", gain: 0.55 },
      // ── end card ──
      { at: "end-in", sfx: "shimmer", gain: 0.34 },
      { at: "end-in", offset: 0.5, file: "confirmation_001.ogg", gain: 0.35 },
    ],
  },
});
