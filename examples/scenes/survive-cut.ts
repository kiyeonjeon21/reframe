// Edit-survival, told as a single-lane native story (the differentiator, made
// visceral). 1) the AI's logo reveals. 2) a cursor recolours the mark, the copy
// swaps, a watermark drops in — three obvious HUMAN edits, each tagged. 3) you tell
// the AI "redesign it" and the SAME nodes rebuild into a new horizontal layout. 4)
// your blue mark, your copy and your watermark are still there — the three tags
// travel to where the edits landed and stay. That's the moat: edits live in an
// overlay keyed by stable address, so they reapply when the AI regenerates the base
// (see examples/scenes/survive-base.ts + survive-regen.ts + overlays/survive-edits.json
// for the literal render round-trip). Pure / deterministic. Plays live in player too.

import {
  scene, group, ellipse, rect, text, path, cursor, cursorTo, cursorClick,
  seq, par, tween, wait, oscillate, glow,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080, CX = 960, CY = 540;
const BG = "#0A0B10", INK = "#ECF1FF", ORANGE = "#FF5A1F", BLUE = "#2E6BFF";

const CUR_START: [number, number] = [1480, 980];

// edit tags travel from their v1 spot to where the edit lands in the v2 redesign
const tagPill = (id: string, x: number, y: number, s: string): NodeIR =>
  rect({ id, x, y, width: 30 + s.length * 13, height: 50, radius: 25, anchor: "center", fill: "#0C1426", stroke: BLUE, strokeWidth: 1.5, opacity: 0 });
const tagText = (id: string, x: number, y: number, s: string): NodeIR =>
  text({ id, x, y, anchor: "center", content: s, fontFamily: "Inter", fontSize: 23, fontWeight: 700, fill: BLUE, opacity: 0 });

export default scene({
  id: "survive-cut",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    // the logo lockup (the AI's design) — real nodes, recoloured + rearranged live
    group({ id: "lockup", x: CX, y: CY }, [
      ellipse({ id: "disc", x: 0, y: -50, width: 200, height: 200, anchor: "center", fill: ORANGE, ...glow(ORANGE, 60), scale: 0, opacity: 0 }),
      rect({ id: "mark", x: 0, y: -50, width: 80, height: 80, anchor: "center", fill: BG, radius: 16, scale: 0, rotation: -135, opacity: 0 }),
      rect({ id: "underline", x: 60, y: 60, width: 0, height: 5, anchor: "center-left", fill: "#2A3040", radius: 2, opacity: 0 }),
      text({ id: "wordmark", x: 0, y: 120, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 88, fontWeight: 800, fill: INK, opacity: 0 }),
      text({ id: "tagOld", x: 0, y: 196, anchor: "center", content: "motion, declared", fontFamily: "Inter", fontSize: 30, fontWeight: 500, fill: "#8B93A7", opacity: 0 }),
      text({ id: "tagNew", x: 0, y: 196, anchor: "center", content: "ship it on Friday", fontFamily: "Inter", fontSize: 30, fontWeight: 500, fill: "#8B93A7", opacity: 0 }),
    ]),

    // the human watermark (overlay-added node), bottom-right
    text({ id: "wm", x: 1790, y: 1035, anchor: "center", content: "made with reframe", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: "#3E4658", opacity: 0 }),

    // captions (one per beat — text content can't tween)
    text({ id: "cap1", x: CX, y: 96, anchor: "center", content: "the AI wrote this logo", fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: INK, opacity: 0 }),
    text({ id: "cap2", x: CX, y: 96, anchor: "center", content: "you change three things", fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: INK, opacity: 0 }),
    text({ id: "cap3", x: CX, y: 96, anchor: "center", content: "new layout. your three edits stayed.", fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: INK, opacity: 0 }),

    // three travelling edit tags
    tagPill("t-col", 1250, 416, "your colour"), tagText("t-col-x", 1250, 416, "your colour"),
    tagPill("t-cop", 960, 838, "your copy"), tagText("t-cop-x", 960, 838, "your copy"),
    tagPill("t-wm", 1556, 980, "+ your watermark"), tagText("t-wm-x", 1556, 980, "+ your watermark"),

    // the "redesign" prompt pill
    rect({ id: "pill", x: CX, y: CY, width: 520, height: 78, radius: 39, anchor: "center", fill: "#0C1426", stroke: BLUE, strokeWidth: 1.5, opacity: 0 }),
    text({ id: "pill-x", x: CX, y: CY, anchor: "center", content: "↻  redesign it", fontFamily: "Inter", fontSize: 32, fontWeight: 600, fill: INK, opacity: 0 }),

    // cursor (on top)
    cursor({ id: "cur", x: CUR_START[0], y: CUR_START[1], opacity: 0, accent: BLUE }),

    // end card
    text({ id: "end1", x: CX, y: 446, anchor: "center", content: "Your edits live in a layer.", fontFamily: "Inter", fontSize: 70, fontWeight: 800, fill: INK, opacity: 0 }),
    text({ id: "end2", x: CX, y: 534, anchor: "center", content: "Not baked into the render.", fontFamily: "Inter", fontSize: 70, fontWeight: 800, fill: BLUE, opacity: 0 }),
    rect({ id: "epill", x: CX, y: 672, width: 470, height: 80, radius: 40, anchor: "center", fill: "#0C1426", stroke: "#2A3346", strokeWidth: 1.5, opacity: 0 }),
    text({ id: "enpm", x: CX, y: 672, anchor: "center", content: "npm i reframe-video", fontFamily: "Inter", fontSize: 32, fontWeight: 600, fill: INK, letterSpacing: 2, opacity: 0 }),
  ],

  timeline: seq(
    // ── 1 · the AI's logo reveals ──
    par(
      tween("disc", { scale: 1, opacity: 1 }, { duration: 0.6, ease: "easeOutBack", label: "reveal" }),
      seq(wait(0.1), tween("mark", { scale: 1, rotation: 0, opacity: 1 }, { duration: 0.6, ease: "easeOutBack" })),
      seq(wait(0.2), tween("wordmark", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.3), tween("tagOld", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      tween("cap1", { opacity: 1 }, { duration: 0.5, label: "open" }),
    ),
    wait(1.3),
    // ── 2 · a human makes three edits ──
    par(
      tween("cur", { opacity: 1 }, { duration: 0.3 }),
      cursorTo("cur", CUR_START, [CX, CY - 50], { duration: 0.9, label: "reach" }),
      tween("cap1", { opacity: 0 }, { duration: 0.3 }),
    ),
    cursorClick("cur", { label: "click" }),
    par(
      // recolour the mark orange → blue
      tween("disc", { fill: BLUE, shadowColor: BLUE }, { duration: 0.45, ease: "easeOutCubic", label: "edit" }),
      // swap the copy
      tween("tagOld", { opacity: 0 }, { duration: 0.35 }),
      seq(wait(0.1), tween("tagNew", { opacity: 1 }, { duration: 0.35 })),
      // drop a watermark
      seq(wait(0.5), tween("wm", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" })),
      tween("cap2", { opacity: 1 }, { duration: 0.35 }),
      // tags pop on each edit
      seq(wait(0.15), par(tween("t-col", { opacity: 1 }, { duration: 0.3, ease: "easeOutBack" }), tween("t-col-x", { opacity: 1 }, { duration: 0.3 }))),
      seq(wait(0.4), par(tween("t-cop", { opacity: 1 }, { duration: 0.3, ease: "easeOutBack" }), tween("t-cop-x", { opacity: 1 }, { duration: 0.3 }))),
      seq(wait(0.65), par(tween("t-wm", { opacity: 1 }, { duration: 0.3, ease: "easeOutBack" }), tween("t-wm-x", { opacity: 1 }, { duration: 0.3 }))),
    ),
    wait(1.4),
    // ── 3 · tell the AI to redesign ──
    par(
      tween("cur", { opacity: 0 }, { duration: 0.3 }),
      tween("cap2", { opacity: 0 }, { duration: 0.3 }),
      tween("pill", { opacity: 1 }, { duration: 0.35, ease: "easeOutBack", label: "redesign" }),
      tween("pill-x", { opacity: 1 }, { duration: 0.35 }),
    ),
    wait(0.8),
    // ── 4 · the SAME nodes rebuild into a new layout; the blue/copy/watermark stay ──
    par(
      tween("pill", { opacity: 0 }, { duration: 0.4, label: "rebuild" }),
      tween("pill-x", { opacity: 0 }, { duration: 0.4 }),
      // disc + mark slide left
      tween("disc", { x: -360, y: 0, scale: 0.84 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("mark", { x: -360, y: 0, scale: 0.84 }, { duration: 0.8, ease: "easeInOutCubic" }),
      // wordmark moves up-right, grows; underline draws under it; tagline drops below
      tween("wordmark", { x: 84, y: -12, scale: 1.18 }, { duration: 0.8, ease: "easeInOutCubic" }),
      seq(wait(0.25), tween("underline", { width: 540, opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      tween("tagNew", { x: 84, y: 96, scale: 1.05 }, { duration: 0.8, ease: "easeInOutCubic" }),
      // the three tags travel to where YOUR edits landed in the new design
      tween("t-col", { x: 470, y: 412 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("t-col-x", { x: 470, y: 412 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("t-cop", { x: 1330, y: 648 }, { duration: 0.8, ease: "easeInOutCubic" }),
      tween("t-cop-x", { x: 1330, y: 648 }, { duration: 0.8, ease: "easeInOutCubic" }),
      // watermark tag stays in its corner
    ),
    tween("cap3", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "stayed" }),
    wait(2.2),
    // ── 5 · clear → end card ──
    par(
      ...["lockup", "wm", "cap3", "t-col", "t-col-x", "t-cop", "t-cop-x", "t-wm", "t-wm-x"].map((id) =>
        tween(id, { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" })),
    ),
    par(
      tween("end1", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "end" }),
      seq(wait(0.15), tween("end2", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      seq(wait(0.5), par(
        tween("epill", { opacity: 1 }, { duration: 0.5, ease: "easeOutBack" }),
        tween("enpm", { opacity: 1 }, { duration: 0.5 }),
      )),
    ),
    wait(1.6),
  ),

  behaviors: [
    oscillate("lockup", "y", { amplitude: 5, frequency: 0.3 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.1, fadeIn: 1.0, fadeOut: 1.8, duck: { depth: 0.3 } },
    cues: [
      { at: "open", file: "maximize_001.ogg", gain: 0.3 },
      { at: "click", file: "select_001.ogg", gain: 0.4 },
      { at: "edit", offset: 0.15, sfx: "pop", gain: 0.3 },
      { at: "edit", offset: 0.4, sfx: "pop", gain: 0.3 },
      { at: "edit", offset: 0.65, sfx: "pop", gain: 0.3 },
      { at: "redesign", file: "pluck_001.ogg", gain: 0.4 },
      { at: "rebuild", file: "maximize_009.ogg", gain: 0.4 },
      { at: "stayed", file: "confirmation_003.ogg", gain: 0.46 },
      { at: "stayed", offset: 0.05, sfx: "shimmer", gain: 0.34 },
      { at: "end", file: "bong_001.ogg", gain: 0.4 },
    ],
  },
});
