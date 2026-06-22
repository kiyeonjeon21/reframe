import {
  scene, group, rect, ellipse, path, text,
  seq, par, beat, tween, wait, oscillate, wiggle, cameraTo, motionPath,
  linearGradient, radialGradient,
  type NodeIR, type BehaviorIR,
} from "@reframe/core";

// "LIFTOFF" — a launch-to-orbit sequence. countdown → ignition (plume + camera
// SHAKE via wiggle) → ascent (the world scrolls down past the rocket, atmosphere
// bands pass, the sky darkens to space, stars fade in, altitude counts up) →
// stage separation (a booster tumbles away) → orbit (Earth's curved horizon
// rises, the rocket tilts over, pull back). beats + camera + 2.5D parallax + audio.

const W = 1920, H = 1080, CX = 960;
const SKY = "#0A1830", SPACE = "#03040A", FLAME = "#FFB23E", FG = "#EAF0FF";
const RY = 560; // rocket centre y (held; the world moves instead)

const hash = (i: number, s: number) => { const x = Math.sin(i * 71.3 + s * 13.7) * 4373.1; return x - Math.floor(x); };

// the rocket — body + nose + fins + window + booster ring (the part that sheds)
const rocket: NodeIR = group({ id: "rocket", x: CX, y: RY, scale: 1 }, [
  path({ id: "rk-nose", x: 0, y: 0, d: "M0 -150 L26 -84 L-26 -84 Z", fill: "#E7ECF5", originX: 0, originY: 0 }),
  rect({ id: "rk-body", x: 0, y: -10, width: 52, height: 160, radius: 8, anchor: "center", fill: linearGradient(["#FFFFFF", "#C2CAD8"], { angle: 0 }) }),
  ellipse({ id: "rk-win", x: 0, y: -44, width: 22, height: 22, anchor: "center", fill: "#3FA7FF", stroke: "#1A6CC0", strokeWidth: 3 }),
  rect({ id: "rk-stripe", x: 0, y: 6, width: 52, height: 14, anchor: "center", fill: "#FF4D3D" }),
  path({ id: "rk-finL", x: 0, y: 0, d: "M-26 36 L-58 84 L-26 70 Z", fill: "#FF4D3D", originX: 0, originY: 0 }),
  path({ id: "rk-finR", x: 0, y: 0, d: "M26 36 L58 84 L26 70 Z", fill: "#FF4D3D", originX: 0, originY: 0 }),
  // booster ring (detaches at stage separation)
  group({ id: "booster", x: 0, y: 70, opacity: 1 }, [
    rect({ id: "bo-body", x: 0, y: 0, width: 50, height: 30, radius: 4, anchor: "center", fill: "#9AA3B2" }),
  ]),
]);

// exhaust plume (hidden until ignition)
const plume: NodeIR = group({ id: "plume", x: CX, y: RY + 96, scale: 0, opacity: 0 }, [
  ellipse({ id: "fl-out", x: 0, y: 60, width: 78, height: 220, anchor: "center", fill: radialGradient(["#FFE39A", "#FF6A00", "#FF6A0000"]), blend: "screen" }),
  ellipse({ id: "fl-in", x: 0, y: 36, width: 40, height: 130, anchor: "center", fill: radialGradient(["#FFFFFF", FLAME, "#FFB23E00"]), blend: "screen" }),
]);

// the world that scrolls DOWN as the rocket ascends (ground + clouds)
const world: NodeIR = group({ id: "world", x: 0, y: 0 }, [
  rect({ id: "ground", x: CX, y: 980, width: W, height: 240, anchor: "center", fill: "#14223A" }),
  rect({ id: "pad", x: CX, y: 880, width: 220, height: 30, anchor: "center", fill: "#2A3550" }),
  ...Array.from({ length: 7 }, (_, i) =>
    ellipse({ id: `cloud-${i}`, x: 160 + hash(i, 1) * 1600, y: 360 + hash(i, 2) * 360, width: 180 + hash(i, 3) * 160, height: 60 + hash(i, 4) * 30, anchor: "center", fill: "#1C2C49", opacity: 0.7 })),
]);

const stars: NodeIR = group({ id: "stars", x: 0, y: 0, opacity: 0 },
  Array.from({ length: 90 }, (_, i) =>
    ellipse({ id: `st-${i}`, x: hash(i, 5) * W, y: hash(i, 6) * H, width: 1 + hash(i, 7) * 3, height: 1 + hash(i, 7) * 3, anchor: "center", fill: "#FFFFFF", opacity: 0.3 + hash(i, 8) * 0.6 })),
);

export default scene({
  id: "rocket-launch",
  size: { width: W, height: H },
  fps: 30,
  background: SKY,
  nodes: [
    rect({ id: "space", x: CX, y: H / 2, width: W, height: H, anchor: "center", fill: SPACE, opacity: 0 }), // fades in as we leave the atmosphere
    stars,
    world,
    plume,
    rocket,
    // Earth's curved horizon (rises at orbit)
    ellipse({ id: "earth", x: CX, y: 1900, width: 2600, height: 1400, anchor: "center", fill: linearGradient(["#2E6CC8", "#0B2A55"], { angle: 90 }), opacity: 0 }),
    ellipse({ id: "earth-atmo", x: CX, y: 1210, width: 2640, height: 1420, anchor: "center", stroke: "#7FB6FF", strokeWidth: 6, opacity: 0 }),
    // HUD
    text({ id: "count", x: CX, y: 250, anchor: "center", content: "3", fontFamily: "Inter", fontSize: 180, fontWeight: 800, fill: FG, opacity: 0, fixed: true }),
    text({ id: "alt", x: W - 80, y: 90, anchor: "center-right", content: 0, contentThousands: true, suffix: " m", fontFamily: "Inter", fontSize: 50, fontWeight: 800, fill: FG, opacity: 0, fixed: true }),
    text({ id: "phase", x: 80, y: 90, anchor: "center-left", content: "T-MINUS", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: "#7FB6FF", letterSpacing: 3, opacity: 0, fixed: true }),
    rect({ id: "flash", x: CX, y: H / 2, width: W, height: H, anchor: "center", fill: "#FFFFFF", blend: "screen", opacity: 0, fixed: true }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A3550", fixed: true }),
  ],

  timeline: seq(
    // ── countdown ──
    beat("count", {}, [
      tween("phase", { opacity: 1 }, { duration: 0.3 }),
      ...["3", "2", "1"].map((n) => seq(
        par(tween("count", { opacity: 1, scale: 1, content: n }, { duration: 0.18, ease: "easeOutBack" }), ...(n !== "3" ? [] : [])),
        wait(0.5),
        tween("count", { opacity: 0, scale: 1.3 }, { duration: 0.3, ease: "easeInQuad" }),
      )),
    ]),
    // ── ignition ──
    beat("ignite", {}, [
      par(
        tween("count", { opacity: 1, scale: 1, content: "LIFTOFF" as never, fontSize: 96 }, { duration: 0.3, ease: "easeOutBack" }),
        tween("plume", { opacity: 1, scale: 1 }, { duration: 0.35, ease: "easeOutCubic" }),
        seq(tween("flash", { opacity: 0.5 }, { duration: 0.06 }), tween("flash", { opacity: 0 }, { duration: 0.7 })),
        tween("phase", { content: "IGNITION" as never }, { duration: 0.1 }),
        seq(wait(0.6), tween("count", { opacity: 0 }, { duration: 0.5 })),
        tween("alt", { opacity: 1 }, { duration: 0.4 }),
      ),
    ]),
    // ── ascent: the world scrolls down, sky → space, stars in, altitude up ──
    beat("ascent", {}, [
      par(
        tween("world", { y: 1500 }, { duration: 4.0, ease: "easeInCubic", label: "climb" }),
        tween("rocket", { y: RY - 60, scale: 0.92 }, { duration: 4.0, ease: "easeInOutCubic" }),
        tween("space", { opacity: 1 }, { duration: 3.0, ease: "easeInQuad" }),
        tween("stars", { opacity: 1 }, { duration: 2.5, ease: "easeInQuad" }),
        tween("alt", { content: 84000 }, { duration: 4.0, ease: "easeInCubic" }),
        tween("phase", { content: "ASCENT" as never }, { duration: 0.1 }),
        cameraTo({ y: H / 2 - 30, zoom: 1.04 }, { duration: 4.0, ease: "easeInOutCubic" }),
      ),
    ]),
    // ── stage separation ──
    beat("stage", {}, [
      par(
        tween("phase", { content: "STAGE SEP" as never }, { duration: 0.1 }),
        seq(tween("flash", { opacity: 0.35 }, { duration: 0.05 }), tween("flash", { opacity: 0 }, { duration: 0.5 })),
        // booster detaches, tumbles away below
        seq(
          tween("booster", { opacity: 1 }, { duration: 0.01 }),
          par(
            motionPath("booster", [[0, 70], [-60, 260], [-160, 620]], { duration: 1.4, ease: "easeInCubic" }),
            tween("booster", { rotation: -220, opacity: 0 }, { duration: 1.4, ease: "easeInCubic" }),
          ),
        ),
      ),
    ]),
    wait(0.3),
    // ── orbit: Earth rises, rocket tilts over, pull back ──
    beat("orbit", {}, [
      par(
        tween("phase", { content: "ORBIT" as never }, { duration: 0.1 }),
        tween("earth", { opacity: 1, y: 1380 }, { duration: 1.8, ease: "easeOutCubic" }),
        tween("earth-atmo", { opacity: 0.8, y: 820 }, { duration: 1.8, ease: "easeOutCubic" }),
        tween("rocket", { y: 470, rotation: 64, scale: 0.78 }, { duration: 1.8, ease: "easeInOutCubic" }),
        tween("plume", { opacity: 0.5, scale: 0.7 }, { duration: 1.2, ease: "easeInOutCubic" }),
        cameraTo({ zoom: 0.92, y: H / 2 + 20 }, { duration: 1.8, ease: "easeInOutCubic" }),
        tween("alt", { content: 408000 }, { duration: 1.8, ease: "easeOutCubic" }),
      ),
    ]),
    wait(1.8),
  ),

  behaviors: [
    // exhaust flicker + rocket vibration during powered flight
    oscillate("plume", "scaleY", { amplitude: 0.12, frequency: 18, phase: 0 }, { from: 2.2, until: 7.0, ramp: 0.2 }),
    wiggle("fl-out", "scaleX", { amplitude: 0.16, frequency: 22, seed: 2 }, { from: 2.2, until: 7.0, ramp: 0.2 }),
    // camera shake — violent at ignition, easing through ascent
    wiggle("camera", "x", { amplitude: 10, frequency: 24, seed: 5 }, { from: 2.1, until: 3.0, ramp: 0.15 }),
    wiggle("camera", "y", { amplitude: 12, frequency: 20, seed: 7 }, { from: 2.1, until: 3.0, ramp: 0.15 }),
    wiggle("rocket", "x", { amplitude: 3, frequency: 16, seed: 11 }, { from: 2.1, until: 6.8, ramp: 0.4 }),
    // stars twinkle
    ...Array.from({ length: 90 }, (_, i): BehaviorIR =>
      oscillate(`st-${i}`, "opacity", { amplitude: 0.3, frequency: 0.6 + hash(i, 9) * 1.4, phase: i }, { from: 4.0, until: 11.0, ramp: 0.5 })),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.12, fadeIn: 1.0, fadeOut: 2.0, duck: { depth: 0.4 } },
    cues: [
      { at: "count", file: "select_001.ogg", gain: 0.4 },
      { at: "ignite", file: "maximize_009.ogg", gain: 0.5 },
      { at: "ignite", offset: 0.02, sfx: "thud", gain: 0.6 },
      { at: "climb", sfx: "rise", gain: 0.4 },
      { at: "stage", file: "glass_001.ogg", gain: 0.42 },
      { at: "stage", offset: 0.02, sfx: "thud", gain: 0.4 },
      { at: "orbit", file: "confirmation_003.ogg", gain: 0.5 },
      { at: "orbit", offset: 0.05, sfx: "shimmer", gain: 0.34 },
    ],
  },
});
