// "Liquid Glass" showcase — a glass dashboard assembling over a living aurora.
// Bold colour orbs drift BEHIND every frosted panel, so the engine's live `backdrop`
// primitive visibly shimmers through the glass (sampled fresh every frame). Hero bar,
// three frosted tiles, a glass progress pill, a light sweep, a slow camera push, and a
// synth score. Pure shapes (no image) → also plays live in `reframe player`.

import {
  scene, group, rect, ellipse, path, text,
  seq, par, stagger, tween, wait, oscillate, cameraTo,
  linearGradient, radialGradient,
  type NodeIR, type TimelineIR,
} from "@reframe/core";

const W = 1920, H = 1080;

// ── a glass panel: live backdrop + tint + sheen + specular rim (all start hidden) ──
const glass = (id: string, x: number, y: number, w: number, h: number, r: number, blur = 24, sat = 1.5): NodeIR[] => [
  rect({ id: `${id}-body`, x, y, width: w, height: h, radius: r, anchor: "center", opacity: 0, scale: 0.9,
    backdrop: { blur, saturate: sat },
    fill: linearGradient(["#FFFFFF24", "#FFFFFF0A"], { angle: 90 }),
    shadowColor: "#03060E", shadowBlur: 56, shadowX: 0, shadowY: 30 }),
  rect({ id: `${id}-sheen`, x, y: y - h / 4, width: w - 8, height: h / 2, radius: r, anchor: "center", opacity: 0,
    fill: linearGradient(["#FFFFFF5E", "#FFFFFF00"], { angle: 90 }), blend: "screen" }),
  rect({ id: `${id}-rim`, x, y, width: w, height: h, radius: r, anchor: "center", opacity: 0,
    fill: "none", stroke: linearGradient(["#FFFFFFE6", "#FFFFFF1F", "#FFFFFF73"], { angle: 125 }), strokeWidth: 2.4 }),
];
const glassIn = (id: string, label: string, dur = 0.62): TimelineIR =>
  par(
    tween(`${id}-body`, { opacity: 1, scale: 1 }, { duration: dur, ease: "easeOutBack", label }),
    tween(`${id}-sheen`, { opacity: 1 }, { duration: dur * 0.8, ease: "easeOutCubic", label: `${label}-sheen` }),
    tween(`${id}-rim`, { opacity: 1 }, { duration: dur * 0.8, ease: "easeOutCubic", label: `${label}-rim` }),
  );

const orb = (id: string, x: number, y: number, d: number, c: string): NodeIR =>
  ellipse({ id, x, y, width: d, height: d, anchor: "center", fill: radialGradient([c, `${c}00`], { r: 0.5 }), blend: "screen" });

const TILES = [
  { id: "t0", x: 540, label: "Frosted", accent: "#FF7A3D" },
  { id: "t1", x: 960, label: "Live", accent: "#3D9BFF" },
  { id: "t2", x: 1380, label: "Deterministic", accent: "#19E3B1" },
];
const TY = 612, TW = 332, TH = 320, TR = 38;

export default scene({
  id: "liquid-glass-showcase",
  size: { width: W, height: H },
  fps: 30,
  background: "#06080F",
  camera: { x: W / 2, y: H / 2, zoom: 1 },
  nodes: [
    // ── living aurora behind everything (drifts → the glass backdrops shimmer) ──
    rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: linearGradient(["#0A0F22", "#0E0B26", "#081E2A"], { angle: 125 }) }),
    orb("o-1", 360, 300, 1120, "#FF6A3D"),
    orb("o-2", 1560, 280, 1180, "#3D7BFF"),
    orb("o-3", 1180, 880, 1240, "#B14DFF"),
    orb("o-4", 560, 880, 980, "#19E3B1"),
    orb("o-5", 980, 540, 900, "#FF4D8D"),
    orb("o-6", 1500, 760, 820, "#F4C84B"),

    // ── hero glass bar ──
    ...glass("hero", W / 2, 250, 1200, 168, 42, 26, 1.45),
    text({ id: "title", x: W / 2, y: 232, anchor: "center", content: "Liquid Glass", fontFamily: "Inter", fontSize: 68, fontWeight: 800, fill: "#FFFFFF", opacity: 0, shadowColor: "#04101C", shadowBlur: 18, shadowX: 0, shadowY: 2 }),
    text({ id: "sub", x: W / 2, y: 292, anchor: "center", content: "live backdrop blur · a reframe engine primitive", fontFamily: "Inter", fontSize: 26, fontWeight: 500, fill: "#D8E0F0", opacity: 0 }),

    // ── three frosted tiles (icon + label inside each) ──
    ...TILES.flatMap((t) => glass(t.id, t.x, TY, TW, TH, TR, 22, 1.5)),
    ...TILES.map((t) => ellipse({ id: `${t.id}-ic`, x: t.x, y: TY - 38, width: 92, height: 92, anchor: "center", fill: radialGradient([t.accent, `${t.accent}66`], { r: 0.55 }), shadowColor: t.accent, shadowBlur: 26, opacity: 0 })),
    ...TILES.map((t) => text({ id: `${t.id}-lb`, x: t.x, y: TY + 92, anchor: "center", content: t.label, fontFamily: "Inter", fontSize: 30, fontWeight: 600, fill: "#FFFFFF", opacity: 0, shadowColor: "#04101C", shadowBlur: 12, shadowX: 0, shadowY: 1 })),

    // ── glass progress pill (a frosted bar with an accent fill that sweeps in) ──
    ...glass("pill", W / 2, 880, 980, 104, 52, 22, 1.5),
    rect({ id: "pill-track", x: W / 2, y: 880, width: 880, height: 14, radius: 7, anchor: "center", fill: "#FFFFFF24", opacity: 0 }),
    rect({ id: "pill-fill", x: W / 2 - 440, y: 880, width: 0, height: 14, radius: 7, anchor: "center-left", opacity: 0,
      fill: linearGradient(["#3D9BFF", "#19E3B1"], { angle: 0 }), shadowColor: "#3D9BFF", shadowBlur: 18 }),

    // ── light sweep across the hero bar ──
    group({ id: "sweepclip", x: W / 2, y: 250, opacity: 0, clip: { kind: "rect", x: -600, y: -84, width: 1200, height: 168, radius: 42 } }, [
      rect({ id: "sweep", x: -760, y: 0, width: 220, height: 360, rotation: 18, anchor: "center",
        fill: linearGradient(["#FFFFFF00", "#FFFFFFB0", "#FFFFFF00"], { angle: 0 }), blend: "screen" }),
    ]),
  ],

  timeline: seq(
    wait(0.3),
    // hero bar + title
    par(
      glassIn("hero", "hero-in", 0.7),
      seq(wait(0.28), par(
        tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "title-in" }),
        tween("sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "sub-in" }),
      )),
    ),
    // a light sweep across the hero
    par(
      tween("sweepclip", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic", label: "sweep-on" }),
      seq(wait(0.1), tween("sweep", { x: 820 }, { duration: 1.5, ease: "easeInOutQuad", label: "sweep-1" })),
    ),
    // three tiles pop in, staggered
    stagger(0.16,
      ...TILES.map((t) => par(
        glassIn(t.id, `${t.id}-in`, 0.58),
        seq(wait(0.18), par(
          tween(`${t.id}-ic`, { opacity: 1 }, { duration: 0.4, ease: "easeOutBack", label: `${t.id}-ic-in` }),
          tween(`${t.id}-lb`, { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: `${t.id}-lb-in` }),
        )),
      )),
    ),
    // glass pill + the accent fill sweeping across
    par(
      glassIn("pill", "pill-in", 0.6),
      seq(wait(0.22), par(
        tween("pill-track", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "track-in" }),
        tween("pill-fill", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic", label: "fill-in" }),
        seq(wait(0.1), tween("pill-fill", { width: 880 }, { duration: 1.6, ease: "easeInOutCubic", label: "fill-grow" })),
      )),
    ),
    wait(1.4),
  ),

  // a slow cinematic push the whole time
  behaviors: [
    oscillate("o-1", "x", { amplitude: 90, frequency: 0.05 }),
    oscillate("o-2", "y", { amplitude: 80, frequency: 0.045, phase: 1 }),
    oscillate("o-3", "x", { amplitude: 110, frequency: 0.04, phase: 2 }),
    oscillate("o-4", "y", { amplitude: 90, frequency: 0.05, phase: 0.5 }),
    oscillate("o-5", "x", { amplitude: 130, frequency: 0.035, phase: 3 }),
    oscillate("o-6", "y", { amplitude: 100, frequency: 0.042, phase: 1.7 }),
    oscillate("camera", "zoom", { amplitude: 0.018, frequency: 0.05 }, { from: 0 }),
  ],

  audio: {
    bgm: { synth: "uplift", gain: 0.32, fadeIn: 1.2, fadeOut: 1.6, duck: { depth: 0.4 } },
    cues: [
      { at: "hero-in", sfx: "rise", gain: 0.7 },
      { at: "sweep-1", sfx: "shimmer", gain: 0.5 },
      { at: "t0-in", sfx: "pop", gain: 0.6 },
      { at: "t1-in", sfx: "pop", gain: 0.6 },
      { at: "t2-in", sfx: "pop", gain: 0.6 },
      { at: "pill-in", sfx: "select", gain: 0.6 },
      { at: "fill-grow", sfx: "swoosh", gain: 0.45 },
    ],
  },
});
