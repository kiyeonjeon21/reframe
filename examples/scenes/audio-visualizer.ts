import {
  scene, group, rect, ellipse, text,
  seq, par, stagger, beat, tween, wait, oscillate, wiggle, cameraTo,
  splitText, textIn, radialGradient,
  type NodeIR, type BehaviorIR,
} from "@reframe/core";

// "THE DROP" — an audio visualizer as choreography (deterministic, no real FFT).
// A radial ring of 56 spectrum bars dances on staggered `oscillate` frequencies
// around a pulsing core; energy BUILDS, then THE DROP hits: a white flash, every
// bar spikes, a particle ring bursts out, the camera punches in and SHAKES
// (`wiggle` the camera), and the bgm lands. Acts: intro → build → drop → groove.

const W = 1920, H = 1080, CX = 960, CY = 540;
const ACC = "#FF2D6F", ACC2 = "#7C5CFF", CYAN = "#22E0E0", FG = "#FFFFFF";
const NB = 56;          // spectrum bars
const R0 = 150;         // inner ring radius
const NP = 60;          // burst particles

// deterministic per-index hash → [0,1)
const hash = (i: number, s: number) => { const x = Math.sin(i * 51.7 + s * 19.3) * 43758.5; return x - Math.floor(x); };
const barColor = (u: number) => (u < 0.34 ? ACC : u < 0.67 ? ACC2 : CYAN);

const bars: NodeIR[] = Array.from({ length: NB }, (_, i) => {
  const ang = (i / NB) * 360;
  return group({ id: `barg-${i}`, x: CX, y: CY, rotation: ang }, [
    rect({ id: `bar-${i}`, x: 0, y: -R0, width: 9, height: 28, radius: 4, anchor: "bottom-center", fill: barColor(i / NB), opacity: 0 }),
  ]);
});

const burst: NodeIR[] = Array.from({ length: NP }, (_, i) => {
  const ang = (i / NP) * Math.PI * 2;
  return ellipse({ id: `pp-${i}`, x: CX + Math.cos(ang) * R0, y: CY + Math.sin(ang) * R0, width: 10 + hash(i, 3) * 12, height: 10 + hash(i, 3) * 12, anchor: "center", fill: barColor(hash(i, 4)), blend: "add", opacity: 0 });
});

const title = splitText("THE DROP", { id: "ttl", x: CX, y: CY, fontSize: 132, fontWeight: 800, fill: FG, letterSpacing: 6 });

export default scene({
  id: "audio-visualizer",
  size: { width: W, height: H },
  fps: 30,
  background: "#06040C",
  camera: { x: CX, y: CY, zoom: 0.9 },
  nodes: [
    ellipse({ id: "core", x: CX, y: CY, width: 300, height: 300, anchor: "center", fill: radialGradient([ACC, "#7C5CFF22", "#7C5CFF00"]), blend: "screen", opacity: 0 }),
    ...burst,
    ...bars,
    ellipse({ id: "ring", x: CX, y: CY, width: 2 * R0, height: 2 * R0, anchor: "center", stroke: "#2A2150", strokeWidth: 2, opacity: 0 }),
    ...title.nodes,
    text({ id: "artist", x: CX, y: CY + 92, anchor: "center", content: "REFRAME ·  live set", fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: "#8B86A8", letterSpacing: 6, opacity: 0 }),
    rect({ id: "flash", x: CX, y: CY, width: W, height: H, anchor: "center", fill: FG, blend: "screen", opacity: 0, fixed: true }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A2150", fixed: true }),
  ],

  timeline: seq(
    // ── intro ──
    beat("intro", {}, [
      par(
        tween("core", { opacity: 1 }, { duration: 0.7, ease: "easeOutCubic" }),
        tween("ring", { opacity: 1 }, { duration: 0.7 }),
        textIn("rise", title, { speed: 1.1 }),
        seq(wait(0.3), tween("artist", { opacity: 1 }, { duration: 0.5 })),
        stagger(0.01, ...bars.map((_, i) => tween(`bar-${i}`, { opacity: 0.95, height: 36 + hash(i, 1) * 30 }, { duration: 0.5, ease: "easeOutBack" }))),
      ),
    ]),
    wait(0.6),
    // ── build: push in, energy rises ──
    beat("build", {}, [
      par(
        cameraTo({ zoom: 1.08 }, { duration: 1.6, ease: "easeInCubic" }),
        tween("core", { scale: 1.3 }, { duration: 1.6, ease: "easeInCubic" }),
        ...bars.map((_, i) => tween(`bar-${i}`, { height: 70 + hash(i, 2) * 60 }, { duration: 1.5, ease: "easeInQuad" })),
        ...title.nodes.map((n) => tween(n.id, { opacity: 0.15 }, { duration: 1.0 })),
        tween("artist", { opacity: 0 }, { duration: 0.6 }),
      ),
    ]),
    // ── THE DROP ──
    beat("drop", {}, [
      par(
        seq(tween("flash", { opacity: 0.85 }, { duration: 0.05 }), tween("flash", { opacity: 0 }, { duration: 0.6, ease: "easeOutCubic" })),
        tween("core", { scale: 2.0, opacity: 1 }, { duration: 0.4, ease: "easeOutBack" }),
        cameraTo({ zoom: 1.0 }, { duration: 0.4, ease: "easeOutBack" }),
        // every bar spikes
        ...bars.map((_, i) => seq(
          tween(`bar-${i}`, { height: 150 + hash(i, 5) * 130 }, { duration: 0.18, ease: "easeOutExpo" }),
          tween(`bar-${i}`, { height: 60 + hash(i, 6) * 50 }, { duration: 0.5, ease: "easeOutCubic" }),
        )),
        // particle ring bursts outward
        stagger(0.004, ...burst.map((_, i) => {
          const ang = (i / NP) * Math.PI * 2;
          return seq(
            tween(`pp-${i}`, { opacity: 1 }, { duration: 0.08 }),
            par(
              tween(`pp-${i}`, { x: CX + Math.cos(ang) * 720, y: CY + Math.sin(ang) * 720 }, { duration: 1.3, ease: "easeOutExpo" }),
              seq(wait(0.5), tween(`pp-${i}`, { opacity: 0, scale: 0.4 }, { duration: 0.8, ease: "easeInQuad" })),
            ),
          );
        })),
      ),
    ]),
    // ── groove (bars dance on the spectrum behaviors below) ──
    wait(3.2, "groove"),
    beat("out", { parallel: true }, [
      tween("core", { opacity: 0, scale: 1 }, { duration: 0.8, ease: "easeInQuad" }),
      tween("ring", { opacity: 0 }, { duration: 0.8 }),
      ...bars.map((_, i) => tween(`bar-${i}`, { opacity: 0, height: 10 }, { duration: 0.6, ease: "easeInQuad" })),
    ]),
  ),

  behaviors: [
    // the spectrum: each bar bobs at its own seeded frequency (the "music")
    ...bars.map((_, i): BehaviorIR =>
      oscillate(`bar-${i}`, "height", { amplitude: 34 + hash(i, 7) * 30, frequency: 1.4 + hash(i, 8) * 3.2, phase: i * 0.4 }, { from: 4.6, until: 8.2, ramp: 0.4 })),
    // core pulse + slow ring rotation feel
    oscillate("core", "scale", { amplitude: 0.18, frequency: 2.0, phase: 0 }, { from: 4.6, until: 8.0, ramp: 0.4 }),
    // camera shake on the drop
    wiggle("camera", "x", { amplitude: 16, frequency: 11, seed: 3 }, { from: 4.3, until: 5.1, ramp: 0.1 }),
    wiggle("camera", "y", { amplitude: 16, frequency: 13, seed: 9 }, { from: 4.3, until: 5.1, ramp: 0.1 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.13, fadeIn: 1.0, fadeOut: 1.5, duck: { depth: 0.4 } },
    cues: [
      { at: "build", sfx: "rise", gain: 0.5 },
      { at: "drop", file: "bong_001.ogg", gain: 0.6 },
      { at: "drop", offset: 0.02, sfx: "thud", gain: 0.5 },
      { at: "drop", offset: 0.04, sfx: "shimmer", gain: 0.4 },
    ],
  },
});
