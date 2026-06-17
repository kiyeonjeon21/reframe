import {
  scene, group, rect, ellipse, text, seq, par, beat, tween, wait, motionPath, oscillate,
  devicePreset, deviceScreen, type NodeIR, type BehaviorIR,
} from "@reframe/core";

// A single device with a full dramatic arc (기승전결), curved motion + camera work:
//   기 · the drop      — the phone arcs in (motionPath), overshoots into a 2.5D
//                        hero tilt, a shockwave rings out, the UI wakes.
//   승 · it takes off  — it faces you, the now-playing dims and a feed of viral
//                        toasts cascades in (plays, likes, shares, trending).
//   전 · everywhere    — the camera pulls back as the phone SPINS and four
//                        devices burst out of it along curved paths.
//   결 · resolution    — the constellation settles, the camera pushes in, title.
// devicePreset + tweens / motionPath / skew+rotation (2.5D) / oscillate. Deterministic.

const W = 1920, H = 1080, CX = 960, CY = 540;
const BG = "#090C16"; // deep navy, not pitch black
const FG = "#FFFFFF";
const MUTED = "#7C8496";
const ACC = "#FF4D00";
const SUB = ["#FF4D00", "#00C2A8", "#7C5CFF", "#3B82F6"];
const HERO = 0.95;

const ce = (id: string, x: number, y: number, r: number, fill: string, extra: Record<string, unknown> = {}): NodeIR =>
  ellipse({ id, x, y, anchor: "center", width: r * 2, height: r * 2, fill, ...extra });
const ri = (id: string, x: number, y: number, w: number, h: number, fill: string, radius = 0, extra: Record<string, unknown> = {}): NodeIR =>
  rect({ id, x, y, anchor: "center", width: w, height: h, fill, radius, ...extra });
const tx = (id: string, x: number, y: number, s: string, size: number, weight: number, fill: string, anchor: "center" | "center-left" = "center"): NodeIR =>
  text({ id, x, y, anchor, content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

const { width: SW, height: SH } = deviceScreen("phone"); // 352 x 736
const FILLW = SW * 0.5;

// now-playing (the "np" group dims when the viral feed takes over)
const np: NodeIR = group({ id: "np", x: 0, y: 0 }, [
  tx("ui-time", -SW / 2 + 26, -SH / 2 + 34, "9:41", 20, 700, FG),
  ce("ui-sig", SW / 2 - 40, -SH / 2 + 32, 5, MUTED),
  ri("ui-art", 0, -SH * 0.16, SW * 0.62, SW * 0.62, ACC, 30, { scale: 0 }),
  group({ id: "ui-song", x: 0, y: 14, opacity: 0 }, [
    tx("ui-title", 0, SH * 0.14, "Midnight Drive", 27, 800, FG),
    tx("ui-artist", 0, SH * 0.19, "The Echoes", 16, 400, MUTED),
  ]),
  ri("ui-track", 0, SH * 0.27, SW * 0.72, 5, "#2A2D38", 3),
  ri("ui-fill", -SW * 0.36, SH * 0.27, 0, 5, ACC, 3, { anchor: "center-left" }),
  ...[0, 1, 2, 3, 4].map((i) => ri(`eq${i}`, -88 + i * 44, SH * 0.42, 18, 30, i === 2 ? ACC : FG, 4, { anchor: "bottom-center" })),
]);

// the viral feed: toasts that slide in from the right and stack (cascade in 승)
const TOASTS = [
  { ic: "▶", t: "1,000,000 plays", c: ACC },
  { ic: "♥", t: "248k likes", c: "#FF4D6D" },
  { ic: "↗", t: "64k shares", c: "#00C2A8" },
  { ic: "★", t: "#1 trending", c: "#F59E0B" },
];
const toastNodes: NodeIR[] = TOASTS.map((to, i) => {
  const slotY = -SH * 0.22 + i * SH * 0.135;
  return group({ id: `toast${i}`, x: 150, y: slotY, opacity: 0 }, [
    ri(`toast${i}-bg`, 0, 0, SW * 0.84, 58, "#171C28", 29, { stroke: "#313D54", strokeWidth: 1.5 }),
    tx(`toast${i}-ic`, -SW * 0.32, 0, to.ic, 22, 800, to.c),
    tx(`toast${i}-t`, -SW * 0.32 + 30, 0, to.t, 21, 700, FG, "center-left"),
  ]);
});

const screenUI: NodeIR = group({ id: "screen-ui", x: 0, y: 0, opacity: 0 }, [
  np,
  group({ id: "toasts", x: 0, y: 0 }, toastNodes),
  ri("glint", -340, 0, 90, 1000, FG, 0, { rotation: 22, opacity: 0.13 }),
]);

const phone = devicePreset("phone", { id: "phone", x: 0, y: 0, scale: HERO, screen: "#13151E", content: [screenUI] });

const miniApp = (name: string, accent: string): NodeIR[] => {
  const { width: w, height: h } = deviceScreen(name as Parameters<typeof deviceScreen>[0]);
  const s = Math.min(w, h);
  return [
    ri(`${name}-mi-art`, 0, -h * 0.1, s * 0.5, s * 0.5, accent, s * 0.06),
    ri(`${name}-mi-b1`, 0, h * 0.24, w * 0.5, 10, "#2A2D38", 5),
    ri(`${name}-mi-b2`, -w * 0.08, h * 0.32, w * 0.34, 8, accent, 4),
  ];
};

interface Dev { name: string; x: number; y: number; s: number; path: [number, number][] }
const DEVS: Dev[] = [
  { name: "tablet", x: -640, y: -250, s: 0.5, path: [[0, 0], [-260, -300], [-640, -250]] },
  { name: "laptop", x: 650, y: -250, s: 0.44, path: [[0, 0], [260, -300], [650, -250]] },
  { name: "browser", x: -700, y: 230, s: 0.42, path: [[0, 0], [-300, 300], [-700, 230]] },
  { name: "tv", x: 700, y: 230, s: 0.42, path: [[0, 0], [300, 300], [700, 230]] },
];
// start stacked at the phone's centre (hidden); the burst flies them out
const devNodes: NodeIR[] = DEVS.map((d, i) =>
  group({ id: `${d.name}-w`, x: 0, y: 0, opacity: 0, scale: 0 }, [
    devicePreset(d.name as Parameters<typeof devicePreset>[0], { id: d.name, x: 0, y: 0, scale: d.s, screen: "#13151E", content: miniApp(d.name, SUB[(i + 1) % SUB.length]!) }),
  ]),
);

const behaviors: BehaviorIR[] = [
  // float + breathing tilt on the phone, dancing UI, and a slow camera drift
  oscillate("phone-cam", "y", { amplitude: 9, frequency: 0.16, phase: 0 }),
  oscillate("phone-cam", "skewX", { amplitude: 1.0, frequency: 0.13, phase: 1 }),
  oscillate("ui-art", "scale", { amplitude: 0.02, frequency: 0.5, phase: 0 }),
  ...[0, 1, 2, 3, 4].map((i) => oscillate(`eq${i}`, "height", { amplitude: 16, frequency: 2.2 + i * 0.6, phase: i * 1.3 })),
  oscillate("stage", "x", { amplitude: 5, frequency: 0.05, phase: 0 }),
  oscillate("stage", "y", { amplitude: 4, frequency: 0.04, phase: 1 }),
];

export default scene({
  id: "device-hero",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  behaviors,
  nodes: [
    // atmospheric backdrop (fixed): many faint concentric layers fake a SMOOTH
    // navy radial glow (a single flat ellipse would show a hard edge), plus one
    // soft cool wash up-right — so the frame reads as depth, not a black void
    group({ id: "backdrop", x: 0, y: 0 }, [
      ...Array.from({ length: 14 }, (_, i) => {
        const t = i / 13;
        return ce(`glow${i}`, CX, CY - 20, 1360 - t * 1090, "#18294C", { opacity: 0.05 });
      }),
      ...Array.from({ length: 8 }, (_, i) => {
        const t = i / 7;
        return ce(`cool${i}`, CX + 470, CY - 320, 760 - t * 560, "#26406E", { opacity: 0.035 });
      }),
    ]),
    group({ id: "stage", x: CX, y: CY, scale: 1 }, [
      ce("spot3", 0, -10, 380, ACC, { opacity: 0 }),
      ce("spot2", 0, -10, 230, "#FF8A3A", { opacity: 0 }),
      ce("shadow", 0, 470, 150, "#000000", { opacity: 0, scaleY: 0.22, scaleX: 0.6 }),
      ellipse({ id: "ring", x: 0, y: 0, anchor: "center", width: 700, height: 700, stroke: FG, strokeWidth: 4, scale: 0, opacity: 0.55 }),
      ...devNodes,
      group({ id: "phone-cam", x: 0, y: 0, scale: 0.2, rotation: -30, skewX: -14, opacity: 0 }, [phone]),
    ]),
    group({ id: "title", x: CX, y: 902, opacity: 0 }, [
      tx("title-t", 0, 0, "your app, everywhere", 40, 800, FG),
      tx("title-s", 0, 44, "one scene, every screen", 20, 400, MUTED),
    ]),
    text({ id: "wm", x: 1844, y: 1046, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 18, fontWeight: 700, fill: "#2A3140" }),
  ],
  timeline: seq(
    // ── 기 · the drop (a curved entrance + overshoot) ──
    beat("ki", {}, [
      seq(
        par(
          motionPath("phone-cam", [[-180, -520], [70, -150], [0, 0]], { duration: 1.3, ease: "easeOutBack", label: "drop" }),
          tween("phone-cam", { scale: 1, rotation: -4, skewX: -6, opacity: 1 }, { duration: 1.3, ease: "easeOutBack" }),
          seq(wait(0.4), tween("spot3", { opacity: 0.11 }, { duration: 0.9, ease: "easeOutCubic" })),
          seq(wait(0.4), tween("spot2", { opacity: 0.17 }, { duration: 0.9, ease: "easeOutCubic" })),
          seq(wait(0.7), tween("shadow", { opacity: 0.5, scaleX: 1, scaleY: 0.32 }, { duration: 0.7, ease: "easeOutCubic" })),
        ),
        par(
          tween("ring", { scale: 2.4, opacity: 0 }, { duration: 0.6, ease: "easeOutCubic", label: "land" }),
          tween("screen-ui", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "wake" }),
        ),
        par(
          tween("ui-art", { scale: 1 }, { duration: 0.5, ease: "easeOutBack" }),
          seq(wait(0.12), tween("ui-song", { opacity: 1, y: 0 }, { duration: 0.4, ease: "easeOutCubic" })),
          seq(wait(0.28), tween("ui-fill", { width: FILLW }, { duration: 0.8, ease: "easeOutCubic" })),
        ),
        tween("glint", { x: 420 }, { duration: 0.6, ease: "easeInOutCubic", label: "glint" }),
      ),
    ]),
    // ── 승 · it takes off (viral feed cascades) ──
    beat("seung", {}, [
      seq(
        par(
          tween("phone-cam", { rotation: -1, skewX: -2 }, { duration: 0.7, ease: "easeOutCubic", label: "face" }),
          tween("np", { opacity: 0.06 }, { duration: 0.6, ease: "easeOutCubic" }),
        ),
        par(
          ...TOASTS.map((_, i) => seq(wait(i * 0.42), tween(`toast${i}`, { x: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutBack", ...(i === 0 ? { label: "viral" } : {}) }))),
        ),
        wait(1.3),
      ),
    ]),
    // ── 전 · everywhere (the phone spins, devices burst out on curves) ──
    beat("jeon", {}, [
      seq(
        par(
          tween("stage", { scale: 0.55 }, { duration: 1.7, ease: "easeInOutCubic", label: "everywhere" }),
          tween("phone-cam", { rotation: 356, skewX: -5 }, { duration: 1.3, ease: "easeInOutCubic" }),
          tween("np", { opacity: 1 }, { duration: 0.9, ease: "easeOutCubic" }),
          ...TOASTS.map((_, i) => tween(`toast${i}`, { opacity: 0 }, { duration: 0.4, ease: "easeInCubic" })),
          ...DEVS.map((d, i) => seq(wait(0.45 + i * 0.13), par(
            motionPath(`${d.name}-w`, d.path, { duration: 1.0, ease: "easeOutCubic" }),
            tween(`${d.name}-w`, { opacity: 1, scale: 1 }, { duration: 0.9, ease: "easeOutBack" }),
          ))),
        ),
        wait(0.9),
      ),
    ]),
    // ── 결 · resolution (camera pushes in, title) ──
    beat("gyeol", {}, [
      seq(
        par(
          tween("stage", { scale: 0.6 }, { duration: 2.4, ease: "easeOutCubic", label: "resolve" }),
          tween("title", { opacity: 1, y: 872 }, { duration: 0.9, ease: "easeOutCubic" }),
          ...DEVS.map((d) => tween(`${d.name}-w`, { opacity: 0.92 }, { duration: 0.8, ease: "easeOutCubic" })),
        ),
        wait(1.8),
      ),
    ]),
  ),
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.18, fadeIn: 1.2, fadeOut: 2, duck: { depth: 0.4 } },
    cues: [
      { at: "drop", offset: 0.2, file: "maximize_009.ogg", gain: 0.4 },
      { at: "land", file: "bong_001.ogg", gain: 0.55 },
      { at: "wake", file: "maximize_001.ogg", gain: 0.32 },
      { at: "glint", file: "glass_001.ogg", gain: 0.38 },
      // each toast pops as it lands
      { at: "viral", file: "confirmation_004.ogg", gain: 0.5 },
      { at: "viral", offset: 0.42, file: "select_001.ogg", gain: 0.4 },
      { at: "viral", offset: 0.84, file: "select_002.ogg", gain: 0.4 },
      { at: "viral", offset: 1.26, file: "select_003.ogg", gain: 0.42 },
      // the spin + burst
      { at: "everywhere", offset: 0.2, file: "maximize_005.ogg", gain: 0.45 },
      { at: "everywhere", offset: 1.0, file: "bong_001.ogg", gain: 0.48 },
      { at: "resolve", offset: 0.3, file: "glass_001.ogg", gain: 0.32 },
    ],
  },
});
