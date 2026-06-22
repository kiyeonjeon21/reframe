import {
  scene, text,
  seq, par, beat, wait, cameraTo,
  splitText, textIn, textOut, textLoop,
  type BehaviorIR,
} from "@reframe/core";

// "MANIFESTO" — pure kinetic typography. Five lines each enter with a different
// `textIn` (assemble / decode / cascade / rise), hold, then exit with `textOut`
// (shatter / fly / dissolve); the camera whip-pans and punches between cuts, the
// finale word breathes on a `textLoop`. Rhythm-cut sfx. Probes: the full text-fx
// vocabulary choreographed at flagship scale.

const W = 1920, H = 1080, CX = 960, CY = 540;
const FG = "#F4F1FF", ACC = "#FF3D81";

const phrase = (id: string, s: string, size: number, fill = FG) =>
  splitText(s, { id, x: CX, y: CY, fontSize: size, fontWeight: 800, fill, letterSpacing: 4, opacity: 0 });

const L1 = phrase("l1", "MOTION", 180);
const L2 = phrase("l2", "IS JUST", 150);
const L3 = phrase("l3", "DATA", 280, ACC);
const L4 = phrase("l4", "EVERY FRAME IS CODE", 96);
const L5 = phrase("l5", "reframe", 200);

export default scene({
  id: "kinetic-manifesto",
  size: { width: W, height: H },
  fps: 30,
  background: "#0B0814",
  camera: { x: CX, y: CY, zoom: 1 },
  nodes: [
    ...L1.nodes, ...L2.nodes, ...L3.nodes, ...L4.nodes, ...L5.nodes,
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A2150", fixed: true }),
  ],

  timeline: seq(
    wait(0.3),
    // 1 — MOTION assembles from scatter
    beat("l1", {}, [textIn("assemble", L1, { seed: 3, label: "in1" })]),
    wait(0.7),
    par(textOut("dissolve", L1, { label: "out1" }), cameraTo({ x: CX - 40, zoom: 1.06 }, { duration: 0.4, ease: "easeInCubic" })),
    // 2 — IS JUST decodes in
    beat("l2", {}, [par(textIn("decode", L2, { seed: 7 }), cameraTo({ x: CX, zoom: 1 }, { duration: 0.5, ease: "easeOutCubic" }))]),
    wait(0.6),
    par(textOut("fly", L2, { energy: 0.9 }), cameraTo({ x: CX + 50, zoom: 1.1 }, { duration: 0.4, ease: "easeInCubic" })),
    // 3 — DATA slams in big (cascade) + camera punch
    beat("l3", {}, [par(textIn("cascade", L3, { speed: 1.2 }), cameraTo({ x: CX, zoom: 0.92 }, { duration: 0.4, ease: "easeOutBack" }))]),
    wait(0.9),
    par(textOut("shatter", L3, { seed: 5, energy: 1 }), cameraTo({ zoom: 1.2 }, { duration: 0.5, ease: "easeInCubic" })),
    // 4 — EVERY FRAME IS CODE rises
    beat("l4", {}, [par(textIn("rise", L4, { speed: 1.1 }), cameraTo({ zoom: 1 }, { duration: 0.6, ease: "easeOutCubic" }))]),
    wait(1.0),
    textOut("dissolve", L4, { label: "out4" }),
    // 5 — the finale word bounces in and holds (breathing on a loop)
    beat("l5", {}, [
      par(
        textIn("bounce", L5, { speed: 1.0 }),
        cameraTo({ zoom: 1.05 }, { duration: 0.8, ease: "easeOutCubic" }),
      ),
    ]),
    wait(2.4, "hold"),
    textOut("dissolve", L5, { label: "out5" }),
    wait(0.4),
  ),

  behaviors: [
    // the finale word floats on a gentle wave while it holds
    ...textLoop("float", L5, { from: 6.4, until: 8.8 } as never),
  ] as BehaviorIR[],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.12, fadeIn: 1.0, fadeOut: 1.5, duck: { depth: 0.35 } },
    cues: [
      { at: "in1", sfx: "rise", gain: 0.4 },
      { at: "l2", sfx: "whoosh", gain: 0.42 },
      { at: "l3", file: "bong_001.ogg", gain: 0.55 },
      { at: "l3", offset: 0.02, sfx: "thud", gain: 0.4 },
      { at: "l4", sfx: "whoosh", gain: 0.4 },
      { at: "l5", file: "confirmation_003.ogg", gain: 0.5 },
      { at: "l5", offset: 0.04, sfx: "shimmer", gain: 0.36 },
    ],
  },
});
