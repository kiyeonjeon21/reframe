// Camera primitive showcase: ONE keyframable viewport tours a wide board of
// panels. The camera pushes in on each detail (zoom about a focal point), pans
// with a slight bank to the next, then pulls back to reveal the whole board —
// while a title and watermark stay pinned to the screen via `fixed: true`.
//
// The whole move is `cameraTo({ x, y, zoom, rotation }, …)` on the reserved
// "camera" target; no stage group, no manual pivots. Pure + deterministic.

import {
  scene, group, rect, text, seq, wait, cameraTo, cameraFit, oscillate,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const PW = 600, PH = 408; // panel size — frame each one with cameraFit so it never clips
const pbox = (c: [number, number]) => ({ x: c[0] - PW / 2, y: c[1] - PH / 2, width: PW, height: PH });
const BG = "#0B0E16", CARD = "#161B28", LINE = "#2A3346";
const FG = "#FFFFFF", MUTED = "#8A93A6";

const tx = (id: string, x: number, y: number, s: string, size: number, weight: number, fill: string): NodeIR =>
  text({ id, x, y, anchor: "center-left", content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

// a panel on the board: a card with a header and a few data rows
function panel(id: string, cx: number, cy: number, accent: string, title: string, rows: number): NodeIR {
  const w = 600, h = 408;
  const kids: NodeIR[] = [
    rect({ id: `${id}-card`, x: cx, y: cy, width: w, height: h, radius: 20, fill: CARD, anchor: "center" }),
    rect({ id: `${id}-accent`, x: cx - w / 2, y: cy - h / 2, width: 12, height: h, radius: 6, fill: accent, anchor: "top-left" }),
    rect({ id: `${id}-dot`, x: cx - w / 2 + 50, y: cy - h / 2 + 50, width: 26, height: 26, radius: 13, fill: accent, anchor: "center" }),
    tx(`${id}-title`, cx - w / 2 + 80, cy - h / 2 + 50, title, 34, 800, FG),
  ];
  for (let i = 0; i < rows; i++) {
    const ry = cy - h / 2 + 120 + i * 64;
    kids.push(rect({ id: `${id}-r${i}`, x: cx - w / 2 + 40, y: ry, width: w - 80, height: 40, radius: 8, fill: LINE, anchor: "center-left" }));
    kids.push(rect({ id: `${id}-b${i}`, x: cx - w / 2 + 40, y: ry, width: (w - 80) * (0.4 + 0.5 * ((i * 37) % 5) / 5), height: 40, radius: 8, fill: accent, anchor: "center-left" }));
  }
  return group({ id, x: 0, y: 0 }, kids);
}

// the board (world space — the camera moves over it)
const A: [number, number] = [470, 330];
const B: [number, number] = [1450, 330];
const C: [number, number] = [960, 820];

export default scene({
  id: "camera-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, zoom: 1, rotation: 0 },
  nodes: [
    // faint connecting lines between panels (so the board reads as one space)
    rect({ id: "wire-1", x: A[0], y: A[1], width: 980, height: 4, fill: LINE, anchor: "center-left", rotation: 0, opacity: 0.4 }),
    rect({ id: "wire-2", x: B[0], y: B[1], width: 700, height: 4, fill: LINE, anchor: "center-left", rotation: 64, opacity: 0.4 }),

    panel("pa", A[0], A[1], "#FF5C3A", "INGEST", 3),
    panel("pb", B[0], B[1], "#3AA0FF", "TRANSFORM", 3),
    panel("pc", C[0], C[1], "#46E5A0", "DELIVER", 3),

    // pinned HUD (ignores the camera) — stays rock-steady while the world moves
    group({ id: "hud", x: 80, y: 80, fixed: true }, [
      tx("hud-t", 0, 0, "CAMERA", 30, 800, FG),
      tx("hud-s", 0, 36, "one viewport, keyframed", 18, 500, MUTED),
    ]),
    text({ id: "wm", x: 1840, y: 1030, anchor: "center-right", content: "reframe", fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: "#36405A", fixed: true }),
  ],

  // a single moving viewport: establish → push into each panel → pull back
  timeline: seq(
    wait(0.5),
    cameraTo(cameraFit(pbox(A), { margin: 52 }), { duration: 1.5, ease: "easeInOutCubic", label: "to-a" }),
    wait(0.9),
    cameraTo({ ...cameraFit(pbox(B), { margin: 52 }), rotation: -5 }, { duration: 1.6, ease: "easeInOutCubic", label: "to-b" }),
    wait(0.9),
    cameraTo({ ...cameraFit(pbox(C), { margin: 52 }), rotation: 0 }, { duration: 1.6, ease: "easeInOutCubic", label: "to-c" }),
    wait(0.9),
    cameraTo({ x: W / 2, y: H / 2, zoom: 1, rotation: 0 }, { duration: 1.8, ease: "easeInOutCubic", label: "to-wide" }),
    wait(0.8),
  ),

  // a hair of handheld life on the wide shots (rides on top of the keyframes)
  behaviors: [
    oscillate("camera", "rotation", { amplitude: 0.4, frequency: 0.13, phase: 0 }),
  ],
});
