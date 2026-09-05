// "Clean up my desktop" — a dense, alive interactive-product choreography in the
// style of the reference opening: a command bar the camera zooms into, a cursor
// that clicks it, a typewriter query (with keyclicks), app icons that pop in with
// spring overshoot and then arc into a trash bin — all as ONE continuous camera
// move. Render WITH motion blur for the broadcast feel:
//
//   pnpm reframe render desktop-cleanup.ts --motion-blur 8 -o out/desktop-cleanup.mp4
//
// Pure function of time (seeded fx only) → deterministic, golden-safe.

import {
  scene, group, rect, ellipse, line, path, text,
  seq, par, stagger, beat, tween, wait, cameraTo, motionPath, oscillate,
  cursor, cursorTo, cursorClick,
  splitText, textIn, textOut, textTypeCues,
  linearGradient, glow,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080, CX = W / 2;
const BG = "#0C0C10";
const WHITE = "#F2F2EF";
const GRAY = "#7C8089";
const ACCENT = "#FF4D00";
const BAR = "#17171C";
const BARLINE = "#2A2A33";

// ── command bar geometry ────────────────────────────────────────────────────
const BAR_Y = 460, BAR_W = 780, BAR_H = 100;
const BAR_LEFT = CX - BAR_W / 2;
const Q_X = BAR_LEFT + 96;                       // query text start (after search glyph)

const query = splitText("clean up my desktop", { id: "q", x: Q_X, y: BAR_Y + 1, fontSize: 40, fontWeight: 400, fill: WHITE, align: "left" });
const CARET_X = Q_X + query.width + 10;

// ── app icons (stylized: gradient tile + a white glyph) ─────────────────────
const ICON_Y = 706, ICON_DX = 196, ICON_SZ = 124;
const iconX = [0, 1, 2, 3, 4].map((i) => CX + (i - 2) * ICON_DX);
const grads = [
  ["#FF5C3A", "#FF2D6B"],
  ["#3AA0FF", "#2D6BFF"],
  ["#00C2A8", "#0AB07F"],
  ["#FFC24B", "#FF7A2F"],
  ["#7C5CFF", "#A03AFF"],
];
// a distinct white glyph per tile so they read as different apps
function glyph(i: number): NodeIR {
  const c = "#FFFFFF";
  switch (i) {
    case 0: return ellipse({ id: `ic-g${i}`, x: 0, y: 0, width: 54, height: 54, anchor: "center", fill: "none", stroke: c, strokeWidth: 9 });
    case 1: return path({ id: `ic-g${i}`, x: 0, y: 0, d: "M -22 -26 L 30 0 L -22 26 Z", fill: c });
    case 2: return group({ id: `ic-g${i}`, x: 0, y: 0 }, [
      rect({ id: `ic-g${i}-a`, x: -16, y: 0, width: 14, height: 52, radius: 4, anchor: "center", fill: c }),
      rect({ id: `ic-g${i}-b`, x: 8, y: 0, width: 14, height: 52, radius: 4, anchor: "center", fill: c }),
    ]);
    case 3: return rect({ id: `ic-g${i}`, x: 0, y: 0, width: 50, height: 50, radius: 12, anchor: "center", fill: "none", stroke: c, strokeWidth: 9 });
    default: return path({ id: `ic-g${i}`, x: 0, y: -2, d: "M0 -30 L9 -10 L31 -8 L14 7 L19 29 L0 18 L-19 29 L-14 7 L-31 -8 L-9 -10 Z", fill: c });
  }
}
const icons: NodeIR[] = iconX.map((x, i) =>
  group({ id: `icon-${i}`, x, y: ICON_Y, scale: 0, opacity: 0 }, [
    rect({ id: `icon-${i}-bg`, x: 0, y: 0, anchor: "center", width: ICON_SZ, height: ICON_SZ, radius: 30, fill: linearGradient([grads[i]![0]!, grads[i]![1]!], { angle: 125 }), ...glow("#00000088", 24) }),
    glyph(i),
  ]),
);

// ── trash bin (vector) ───────────────────────────────────────────────────────
const BIN_X = CX, BIN_Y = 904;
const bin = group({ id: "bin", x: BIN_X, y: BIN_Y, scale: 0.8, opacity: 0 }, [
  // can body (trapezoid, closed with Z so it fills)
  path({ id: "bin-body", x: 0, y: 0, d: "M -66 -54 L 66 -54 L 52 78 L -52 78 Z", fill: "#20202A", stroke: "#3C3C46", strokeWidth: 5 }),
  // vertical ribs
  line({ id: "bin-r1", x1: -22, y1: -38, x2: -18, y2: 64, stroke: "#3C3C46", strokeWidth: 4 }),
  line({ id: "bin-r2", x1: 0, y1: -38, x2: 0, y2: 64, stroke: "#3C3C46", strokeWidth: 4 }),
  line({ id: "bin-r3", x1: 22, y1: -38, x2: 18, y2: 64, stroke: "#3C3C46", strokeWidth: 4 }),
  // lid + handle
  rect({ id: "bin-lid", x: 0, y: -68, anchor: "center", width: 164, height: 22, radius: 8, fill: "#2A2A34", stroke: "#3C3C46", strokeWidth: 4 }),
  rect({ id: "bin-handle", x: 0, y: -84, anchor: "center", width: 54, height: 14, radius: 7, fill: "#2A2A34", stroke: "#3C3C46", strokeWidth: 4 }),
]);

export default scene({
  id: "desktop-cleanup",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: {},
  nodes: [
    // command bar chrome (one group → single opacity fade-in)
    group({ id: "bar", x: 0, y: 0, opacity: 0 }, [
      rect({ id: "bar-bg", x: CX, y: BAR_Y, anchor: "center", width: BAR_W, height: BAR_H, radius: 26, fill: BAR, stroke: BARLINE, strokeWidth: 2, ...glow("#000000AA", 40) }),
      // search glyph (magnifier)
      ellipse({ id: "bar-mag", x: BAR_LEFT + 50, y: BAR_Y - 4, width: 30, height: 30, anchor: "center", fill: "none", stroke: GRAY, strokeWidth: 5 }),
      line({ id: "bar-maghandle", x1: BAR_LEFT + 62, y1: BAR_Y + 8, x2: BAR_LEFT + 74, y2: BAR_Y + 20, stroke: GRAY, strokeWidth: 5 }),
    ]),
    // typed query (glyphs start hidden, revealed by typewriter)
    ...query.nodes,
    // caret
    rect({ id: "caret", x: CARET_X, y: BAR_Y - 1, anchor: "center", width: 4, height: 46, radius: 2, fill: ACCENT, opacity: 0 }),

    // app icons + trash
    ...icons,
    bin,

    // closing label
    text({ id: "done", x: CX, y: H / 2, anchor: "center", content: "desktop, cleaned", fontFamily: "Inter", fontSize: 72, fontWeight: 800, fill: WHITE, opacity: 0 }),

    // cursor on top of everything
    cursor({ id: "cur", x: 1520, y: 210, scale: 1.1, opacity: 0, accent: ACCENT }),
  ],

  timeline: seq(
    // 1 — bar appears, camera zooms in, cursor glides toward it
    beat("open", {}, [par(
      tween("bar", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
      tween("cur", { opacity: 1 }, { duration: 0.3 }),
      cameraTo({ zoom: 1.22, y: 430 }, { duration: 1.1, ease: "easeOutCubic", label: "zoom-in" }),
      seq(wait(0.2), cursorTo("cur", [1520, 210], [770, BAR_Y], { duration: 0.75, arc: 0.16 })),
    )]),

    // 2 — click the bar
    beat("clickbar", {}, [cursorClick("cur", { press: "bar-bg", label: "click" })]),

    // 3 — typewriter the query (+ keyclicks), camera keeps pushing
    beat("typing", {}, [seq(
      par(
        textIn("typewriter", query, { speed: 1.0, label: "type" }),
        cameraTo({ zoom: 1.3 }, { duration: 1.7, ease: "easeInOutCubic" }),
        // nudge the cursor off to the side as typing takes over
        seq(wait(0.1), cursorTo("cur", [770, BAR_Y], [1230, BAR_Y - 150], { duration: 0.9, arc: 0.2 })),
      ),
      wait(0.25),
    )]),

    // 4 — pull back; app icons pop in with spring overshoot
    beat("icons", {}, [seq(
      par(
        cameraTo({ zoom: 1.0, y: 600 }, { duration: 0.8, ease: "easeInOutCubic", label: "pullback" }),
        tween("caret", { opacity: 0 }, { duration: 0.2 }),
        tween("cur", { opacity: 0 }, { duration: 0.3 }),
      ),
      stagger(0.1, ...iconX.map((_, i) =>
        tween(`icon-${i}`, { scale: 1, opacity: 1 }, { duration: 0.55, ease: "springBouncy", label: i === 0 ? "pop" : undefined }))),
      wait(0.25),
    )]),

    // 5 — trash bin slides in; icons arc into it and vanish; bin reacts
    beat("trash", {}, [seq(
      tween("bin", { opacity: 1, scale: 1 }, { duration: 0.45, ease: "easeOutBack", label: "bin-in" }),
      wait(0.1),
      stagger(0.13, ...iconX.map((x, i) =>
        par(
          motionPath(`icon-${i}`, [[x, ICON_Y], [(x + BIN_X) / 2, 470], [BIN_X, BIN_Y - 60]],
            { duration: 0.58, ease: "easeInCubic", curviness: 1.3, label: i === 0 ? "drop" : undefined }),
          tween(`icon-${i}`, { scale: 0.12, rotation: 200 }, { duration: 0.58, ease: "easeInCubic" }),
          seq(wait(0.42), tween(`icon-${i}`, { opacity: 0 }, { duration: 0.16 })),
        ))),
      // bin shake on the last drop
      tween("bin", { scale: 1.09 }, { duration: 0.1, ease: "easeOutQuad" }),
      tween("bin", { scale: 1.0 }, { duration: 0.22, ease: "easeOutBack" }),
    )]),

    // 6 — settle: clear the bar + query, pull to centre, the payoff line rises
    beat("done", {}, [seq(
      par(
        textOut("dissolve", query, { label: "q-out" }),
        tween("bar", { opacity: 0 }, { duration: 0.45, ease: "easeInQuad" }),
        tween("bin", { opacity: 0 }, { duration: 0.45, ease: "easeInQuad" }),
        cameraTo({ zoom: 1.0, y: H / 2 }, { duration: 0.8, ease: "easeInOutCubic" }),
      ),
      tween("done", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "payoff" }),
      wait(1.4, "end"),
    )]),
  ),

  behaviors: [
    // blinking caret during the type window
    oscillate("caret", "opacity", { amplitude: 0.5, frequency: 2.6 }, { from: 1.55, until: 3.4 }),
  ],

  audio: {
    bgm: { synth: "pulse", gain: 0.13, fadeIn: 0.8, fadeOut: 1.6, duck: { depth: 0.4 } },
    cues: [
      { at: "zoom-in", sfx: "riser", gain: 0.3 },
      { at: "click", sfx: "select", gain: 0.45 },
      ...textTypeCues(query, { at: "type", gain: 0.34 }),
      { at: "pop", sfx: "sparkle", gain: 0.4 },
      { at: "bin-in", sfx: "scan", gain: 0.3 },
      { at: "drop", sfx: "swoosh", gain: 0.4 },
      { at: "payoff", sfx: "success", gain: 0.45 },
    ],
  },
});
