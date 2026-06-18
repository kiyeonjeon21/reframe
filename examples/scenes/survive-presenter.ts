// Edit-survival, told as content. A split screen: the LEFT lane is the scene the
// AI wrote; the RIGHT lane is that same scene plus a human overlay (a recolour, a
// new line, a watermark). Both play, then the AI REGENERATES the base into a new
// layout — the left lane changes, and the right lane keeps every human edit because
// the overlay reapplies by stable address. Plays the four REAL renders (in
// survive-presenter/, built from survive-base.ts + survive-regen.ts +
// survive-edits.json) as video layers. mp4 only. Deterministic same-machine.

import {
  scene, rect, text, video,
  seq, par, tween, wait,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#08090E";
const INK = "#ECF1FF";
const DIM = "#737B91";
const ACCENT = "#2E6BFF";

const CW = 840, CH = 472;          // clip cell size (16:9)
const LX = 500, RX = 1420, CY = 512; // lane centres

// a framed clip cell: a backing card + the clip, both starting hidden
const cell = (id: string, src: string, cx: number, start: number): NodeIR[] => [
  rect({ id: `${id}-card`, x: cx, y: CY, width: CW + 16, height: CH + 16, radius: 22, anchor: "center", fill: "#0E1018", stroke: "#1E2230", strokeWidth: 1.5, opacity: 0 }),
  video({ id, src, x: cx, y: CY, width: CW, height: CH, anchor: "center", fit: "cover", start, opacity: 0 }),
];

const laneLabel = (id: string, cx: number, s: string, fill: string): NodeIR =>
  text({ id, x: cx, y: 196, anchor: "center", content: s, fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill, letterSpacing: 6, opacity: 0 });

export default scene({
  id: "survive-presenter",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    text({ id: "title", x: W / 2, y: 96, anchor: "center", content: "your edits survive the AI redoing the work", fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: INK, opacity: 0 }),
    laneLabel("llabel", LX, "THE AI'S BASE", DIM),
    laneLabel("rlabel", RX, "BASE + YOUR OVERLAY", ACCENT),

    // phase 1 — v1 (centered logo). left = AI base, right = base + overlay
    ...cell("bL", "survive-presenter/base-v1.mp4", LX, 0.6),
    ...cell("yL", "survive-presenter/yours-v1.mp4", RX, 0.6),
    // phase 2 — v2 (AI redesign, horizontal). same overlay reapplied on the right
    ...cell("bR", "survive-presenter/base-v2.mp4", LX, 3.5),
    ...cell("yR", "survive-presenter/yours-v2.mp4", RX, 3.5),

    // the "regenerate" prompt that flashes between phases
    rect({ id: "regen-pill", x: W / 2, y: CY, width: 470, height: 76, radius: 38, anchor: "center", fill: "#11141F", stroke: ACCENT, strokeWidth: 1.5, opacity: 0 }),
    text({ id: "regen-text", x: W / 2, y: CY, anchor: "center", content: "↻  redesign the logo", fontFamily: "Inter", fontSize: 30, fontWeight: 600, fill: INK, opacity: 0 }),

    // payoff caption (phase 2)
    text({ id: "cap", x: W / 2, y: 880, anchor: "center", content: "new layout, new timing. your colour and copy reapply by themselves.", fontFamily: "Inter", fontSize: 30, fontWeight: 600, fill: DIM, letterSpacing: 1, opacity: 0 }),

    // end card (hidden until the lanes clear)
    text({ id: "e1", x: W / 2, y: 430, anchor: "center", content: "Edits live in a layer.", fontFamily: "Inter", fontSize: 72, fontWeight: 800, fill: INK, opacity: 0 }),
    text({ id: "e2", x: W / 2, y: 520, anchor: "center", content: "Not baked into the output.", fontFamily: "Inter", fontSize: 72, fontWeight: 800, fill: ACCENT, opacity: 0 }),
    rect({ id: "epill", x: W / 2, y: 660, width: 470, height: 80, radius: 40, anchor: "center", fill: "#11141F", stroke: "#2A3346", strokeWidth: 1.5, opacity: 0 }),
    text({ id: "enpm", x: W / 2, y: 660, anchor: "center", content: "npm i reframe-video", fontFamily: "Inter", fontSize: 32, fontWeight: 600, fill: INK, letterSpacing: 2, opacity: 0 }),
  ],

  timeline: seq(
    // intro: title, labels, cells
    par(
      tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      tween("llabel", { opacity: 1 }, { duration: 0.5 }),
      tween("rlabel", { opacity: 1 }, { duration: 0.5 }),
      tween("bL-card", { opacity: 1 }, { duration: 0.4 }),
      tween("yL-card", { opacity: 1 }, { duration: 0.4 }),
    ),
    // phase 1: v1 clips play
    par(
      tween("bL", { opacity: 1 }, { duration: 0.4, label: "p1" }),
      tween("yL", { opacity: 1 }, { duration: 0.4 }),
    ),
    wait(2.0),
    // regenerate beat
    par(
      tween("regen-pill", { opacity: 1 }, { duration: 0.3, ease: "easeOutBack", label: "regen" }),
      tween("regen-text", { opacity: 1 }, { duration: 0.3 }),
    ),
    wait(0.5),
    // crossfade v1 → v2 (cards swap clips, pill fades)
    par(
      tween("bL", { opacity: 0 }, { duration: 0.4 }),
      tween("yL", { opacity: 0 }, { duration: 0.4 }),
      tween("bR", { opacity: 1 }, { duration: 0.4, label: "p2" }),
      tween("yR", { opacity: 1 }, { duration: 0.4 }),
      tween("bR-card", { opacity: 1 }, { duration: 0.01 }),
      tween("yR-card", { opacity: 1 }, { duration: 0.01 }),
      tween("regen-pill", { opacity: 0 }, { duration: 0.3 }),
      tween("regen-text", { opacity: 0 }, { duration: 0.3 }),
    ),
    // payoff caption
    tween("cap", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "cap" }),
    wait(2.0),
    // clear the lanes
    par(
      ...["title", "llabel", "rlabel", "bR", "yR", "bL-card", "yL-card", "bR-card", "yR-card", "cap"].map((id) =>
        tween(id, { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" })),
    ),
    // end card
    par(
      tween("e1", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "end" }),
      seq(wait(0.15), tween("e2", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      seq(wait(0.5), par(
        tween("epill", { opacity: 1 }, { duration: 0.5, ease: "easeOutBack" }),
        tween("enpm", { opacity: 1 }, { duration: 0.5 }),
      )),
    ),
    wait(1.4),
  ),
});
