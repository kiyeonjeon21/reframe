import {
  scene,
  group,
  rect,
  ellipse,
  line,
  text,
  seq,
  par,
  beat,
  stagger,
  tween,
  wait,
  oscillate,
  type AudioCueIR,
  type NodeIR,
} from "@reframe/core";

// The reframe demo, made with reframe. Six chapters in one scene:
// logo sting → "an AI writes the scene" → "you turn knobs, not code" →
// "the AI redesigns; your edits survive" → "one template, N videos" → close.

const BG = "#0B0D12";
const ACCENT = "#FF4D00";
const USER_ACCENT = "#00C2A8"; // the color "the human" picks in chapter 3
const MUTED = "#8B93A7";
const CODE_GREEN = "#7EE0B8";

const CH = { logoOut: 3.4, ch2: 4.0, ch3: 9.5, ch4: 15.0, ch5: 21.0, ch6: 25.5, end: 30.0 };

// ---------- chapter 5 helper: mini personalized cards ----------
const MINIS = [
  { id: "m1", x: 560, name: "Alice Park", role: "CTO", color: "#00C2A8" },
  { id: "m2", x: 960, name: "Ben Okafor", role: "Head of Design", color: "#7C5CFF" },
  { id: "m3", x: 1360, name: "Chloe Tanaka", role: "Engineering Lead", color: "#F59E0B" },
];

const miniCard = (m: (typeof MINIS)[number]): NodeIR =>
  group({ id: m.id, x: m.x, y: 600, opacity: 0, scale: 0.88 }, [
    rect({ id: `${m.id}-bg`, x: -160, y: -90, width: 320, height: 180, fill: "#14171F", stroke: "#262B36", strokeWidth: 1, radius: 14 }),
    rect({ id: `${m.id}-bar`, x: -130, y: -8, width: 5, height: 58, fill: m.color }),
    text({ id: `${m.id}-name`, x: -112, y: -6, content: m.name, fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: "#FFFFFF" }),
    text({ id: `${m.id}-role`, x: -112, y: 26, content: m.role, fontFamily: "Inter", fontSize: 14, fill: MUTED }),
  ]);

// ---------- chapter 2 code lines ----------
const CODE_LINES = [
  `scene({`,
  `  nodes: [ text({ id: "name" }) ],`,
  `  states: { hidden, shown },`,
  `  timeline: seq(`,
  `    to("shown", { label: "enter" })),`,
  `})`,
];

export default scene({
  id: "reframe-demo",
  size: { width: 1920, height: 1080 },
  fps: 30,
  duration: CH.end,
  background: BG,
  nodes: [
    // ===== chapter 1 + 6: the lockup =====
    group({ id: "lockup", x: 960, y: 500 }, [
      ellipse({ id: "disc", x: 0, y: -60, width: 210, height: 210, anchor: "center", fill: ACCENT, opacity: 0, scale: 0.3 }),
      rect({ id: "mark", x: 0, y: -60, width: 84, height: 84, anchor: "center", fill: BG, radius: 18, opacity: 0, rotation: -120, scale: 0.4 }),
      text({ id: "wordmark", x: 0, y: 130, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 88, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
      text({ id: "tagline", x: 0, y: 205, anchor: "center", content: "motion, declared", fontFamily: "Inter", fontSize: 28, fill: MUTED, opacity: 0 }),
      text({ id: "url", x: 0, y: 262, anchor: "center", content: "reframe — AI writes it · you own it", fontFamily: "Inter", fontSize: 20, fill: "#5A6275", opacity: 0 }),
    ]),

    // ===== chapter 2: headline + code card =====
    group({ id: "g2", x: 0, y: 16, opacity: 0 }, [
      text({ id: "h2", x: 140, y: 250, content: "1 · An AI writes the scene", fontFamily: "Inter", fontSize: 46, fontWeight: 800, fill: "#FFFFFF" }),
      text({ id: "s2", x: 142, y: 322, content: "the output is data with addresses — not freeform code", fontFamily: "Inter", fontSize: 22, fill: MUTED }),
      rect({ id: "codeBg", x: 130, y: 400, width: 690, height: 380, fill: "#10131A", stroke: "#222835", strokeWidth: 1, radius: 16 }),
      ...CODE_LINES.map((content, i) =>
        text({ id: `code-${i}`, x: 178, y: 452 + i * 52, content, fontFamily: "Inter", fontSize: 23, fill: i === 4 ? CODE_GREEN : "#9CB4D8", opacity: 0 }),
      ),
    ]),

    // ===== the rendered "scene card" (persists ch2 → ch4) =====
    group({ id: "card", x: 1330, y: 640, opacity: 0 }, [
      rect({ id: "cardBg", x: -320, y: -180, width: 640, height: 360, fill: "#14171F", stroke: "#262B36", strokeWidth: 1, radius: 20 }),
      text({ id: "cardChip", x: 292, y: -156, anchor: "top-right", content: "rendered scene", fontFamily: "Inter", fontSize: 15, fill: "#3E4756" }),
      rect({ id: "miniBar", x: -270, y: 35, width: 6, height: 92, fill: ACCENT }),
      text({ id: "miniName", x: -244, y: 42, content: "Dr. Maya Chen", fontFamily: "Inter", fontSize: 33, fontWeight: 700, fill: "#FFFFFF" }),
      text({ id: "miniRole", x: -244, y: 92, content: "Climate Scientist", fontFamily: "Inter", fontSize: 20, fill: MUTED }),
      text({ id: "miniWm", x: 292, y: 158, anchor: "bottom-right", content: "© maya", fontFamily: "Inter", fontSize: 16, fill: "#5A6275", opacity: 0 }),
    ]),

    // ===== chapter 3: knobs =====
    group({ id: "g3", x: 0, y: 16, opacity: 0 }, [
      text({ id: "h3", x: 140, y: 250, content: "2 · You turn knobs — not code", fontFamily: "Inter", fontSize: 46, fontWeight: 800, fill: "#FFFFFF" }),
      text({ id: "s3", x: 142, y: 322, content: "every knob writes to an overlay, never your scene file", fontFamily: "Inter", fontSize: 22, fill: MUTED }),
      text({ id: "lblAccent", x: 142, y: 478, content: "accent", fontFamily: "Inter", fontSize: 20, fill: MUTED }),
      line({ id: "trackAccent", x1: 280, y1: 490, x2: 640, y2: 490, stroke: "#2A303C", strokeWidth: 5 }),
      ellipse({ id: "knobAccent", x: 330, y: 490, width: 26, height: 26, anchor: "center", fill: "#E7EAF0" }),
      rect({ id: "swatch", x: 680, y: 474, width: 32, height: 32, fill: ACCENT, radius: 8 }),
      text({ id: "lblTiming", x: 142, y: 568, content: "timing", fontFamily: "Inter", fontSize: 20, fill: MUTED }),
      line({ id: "trackTiming", x1: 280, y1: 580, x2: 640, y2: 580, stroke: "#2A303C", strokeWidth: 5 }),
      ellipse({ id: "knobTiming", x: 380, y: 580, width: 26, height: 26, anchor: "center", fill: "#E7EAF0" }),
      text({ id: "valTiming", x: 680, y: 568, content: "0.6s", fontFamily: "Inter", fontSize: 20, fill: CODE_GREEN }),
      text({ id: "overlayNote", x: 142, y: 680, content: '→ overlay: { "nodes.bar.fill": "#00C2A8", "timeline.enter.duration": 1.4 }', fontFamily: "Inter", fontSize: 19, fill: "#5F88C2" }),
    ]),

    // ===== chapter 4: survival checklist =====
    group({ id: "g4", x: 0, y: 16, opacity: 0 }, [
      text({ id: "h4", x: 140, y: 250, content: "3 · The AI redesigns — your edits survive", fontFamily: "Inter", fontSize: 46, fontWeight: 800, fill: "#FFFFFF" }),
      text({ id: "s4", x: 142, y: 322, content: "the overlay reapplies onto the new design, by stable address", fontFamily: "Inter", fontSize: 22, fill: MUTED }),
      text({ id: "ck1", x: 142, y: 470, content: "✓  accent #00C2A8 — kept", fontFamily: "Inter", fontSize: 26, fill: CODE_GREEN, opacity: 0 }),
      text({ id: "ck2", x: 142, y: 530, content: "✓  watermark — kept", fontFamily: "Inter", fontSize: 26, fill: CODE_GREEN, opacity: 0 }),
      text({ id: "ck3", x: 142, y: 590, content: "✓  timing 1.4s — kept", fontFamily: "Inter", fontSize: 26, fill: CODE_GREEN, opacity: 0 }),
      text({ id: "ck4", x: 142, y: 650, content: "✗  tagline — renamed, reported loudly", fontFamily: "Inter", fontSize: 26, fill: "#FFB454", opacity: 0 }),
      text({ id: "ckNote", x: 142, y: 720, content: "measured: 100% across 23 regenerations — never a silent loss", fontFamily: "Inter", fontSize: 19, fill: "#5A6275", opacity: 0 }),
    ]),

    // ===== chapter 5: batch =====
    group({ id: "g5", x: 0, y: 0, opacity: 0 }, [
      text({ id: "h5", x: 960, y: 280, anchor: "center", content: "4 · One template — N videos", fontFamily: "Inter", fontSize: 52, fontWeight: 800, fill: "#FFFFFF" }),
      text({ id: "s5", x: 960, y: 345, anchor: "center", content: "data rows are overlay addresses", fontFamily: "Inter", fontSize: 22, fill: MUTED }),
      text({ id: "cmd5", x: 960, y: 800, anchor: "center", content: "pnpm reframe batch lower-third.ts team.json", fontFamily: "Inter", fontSize: 22, fill: CODE_GREEN }),
    ]),
    ...MINIS.map(miniCard),
  ],

  timeline: par(
    // ----- chapter 1: logo sting -----
    beat("ch1-logo", {}, [seq(
      wait(0.2),
      par(
        tween("disc", { opacity: 1, scale: 1 }, { duration: 0.7, ease: "easeOutExpo", label: "logo-in" }),
        seq(wait(0.15), tween("mark", { opacity: 1, rotation: 0, scale: 1 }, { duration: 0.7, ease: "easeOutExpo" })),
        seq(wait(0.3), tween("wordmark", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
        seq(wait(0.45), tween("tagline", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" })),
      ),
      wait(CH.logoOut - 1.6),
      par(
        tween("lockup", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
        tween("lockup", { scale: 0.96 }, { duration: 0.5, ease: "easeInCubic" }),
      ),
    )]),

    // ----- chapter 2: AI writes the scene -----
    beat("ch2-code", {}, [seq(
      wait(CH.ch2),
      tween("g2", { opacity: 1, y: 0 }, { duration: 0.5, ease: "easeOutCubic", label: "ch2-in" }),
      stagger(0.22, ...CODE_LINES.map((_, i) => tween(`code-${i}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }))),
      wait(0.3),
      par(
        tween("card", { opacity: 1, y: 600 }, { duration: 0.7, ease: "easeOutExpo", label: "card-in" }),
      ),
      wait(CH.ch3 - CH.ch2 - 0.5 - 6 * 0.22 - 0.3 - 0.7 - 0.4),
      tween("g2", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
    )]),

    // ----- chapter 3: knobs (the card persists and reacts) -----
    beat("ch3-knobs", {}, [seq(
      wait(CH.ch3),
      tween("g3", { opacity: 1, y: 0 }, { duration: 0.5, ease: "easeOutCubic", label: "ch3-in" }),
      wait(0.4),
      par(
        // accent knob slides; the rendered card recolors live
        tween("knobAccent", { x: 590 }, { duration: 1.0, ease: "easeInOutCubic" }),
        tween("swatch", { fill: USER_ACCENT }, { duration: 1.0, ease: "easeInOutCubic" }),
        tween("miniBar", { fill: USER_ACCENT }, { duration: 1.0, ease: "easeInOutCubic" }),
      ),
      wait(0.3),
      par(
        tween("knobTiming", { x: 560 }, { duration: 0.8, ease: "easeInOutCubic" }),
        tween("valTiming", { content: "1.4s" }, { duration: 0.8 }),
      ),
      wait(0.3),
      tween("miniWm", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
      wait(CH.ch4 - CH.ch3 - 0.5 - 0.4 - 1.0 - 0.3 - 0.8 - 0.3 - 0.4 - 0.8),
      tween("g3", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
    )]),

    // ----- chapter 4: redesign + survival -----
    beat("ch4-survival", {}, [seq(
      wait(CH.ch4),
      tween("g4", { opacity: 1, y: 0 }, { duration: 0.5, ease: "easeOutCubic", label: "ch4-in" }),
      // the AI's "redesign": the card's internals rearrange…
      par(
        tween("cardBg", { fill: "#101A22" }, { duration: 0.9, ease: "easeInOutCubic" }),
        tween("miniBar", { x: -244, y: 88, width: 244, height: 5 }, { duration: 0.9, ease: "easeInOutCubic" }),
        tween("miniName", { y: 34 }, { duration: 0.9, ease: "easeInOutCubic" }),
        tween("miniRole", { y: 104 }, { duration: 0.9, ease: "easeInOutCubic" }),
      ),
      // …and the user's edits are still standing
      stagger(
        0.45,
        tween("ck1", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
        tween("ck2", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
        tween("ck3", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
        tween("ck4", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
        tween("ckNote", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
      ),
      wait(CH.ch5 - CH.ch4 - 0.5 - 0.9 - (4 * 0.45 + 0.35) - 0.9),
      par(
        tween("g4", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
        tween("card", { opacity: 0, y: 630 }, { duration: 0.5, ease: "easeInCubic" }),
      ),
    )]),

    // ----- chapter 5: batch -----
    beat("ch5-batch", {}, [seq(
      wait(CH.ch5),
      tween("g5", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "ch5-in" }),
      stagger(
        0.18,
        ...MINIS.map((m) =>
          par(
            tween(m.id, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
            tween(m.id, { scale: 1 }, { duration: 0.5, ease: "easeOutExpo" }),
          ),
        ),
      ),
      wait(CH.ch6 - CH.ch5 - 0.5 - (2 * 0.18 + 0.5) - 0.5),
      par(
        tween("g5", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
        ...MINIS.map((m) => tween(m.id, { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" })),
      ),
    )]),

    // ----- chapter 6: close -----
    beat("ch6-close", {}, [seq(
      wait(CH.ch6),
      par(
        tween("lockup", { opacity: 1, scale: 1 }, { duration: 0.7, ease: "easeOutExpo", label: "close-in" }),
        tween("tagline", { content: "deterministic · addressable · yours" }, { duration: 0.1 }),
        seq(wait(0.5), tween("url", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" })),
      ),
      wait(CH.end - CH.ch6 - 0.7 - 0.8),
      tween("lockup", { opacity: 0 }, { duration: 0.7, ease: "easeInQuad" }),
    )]),
  ),

  behaviors: [
    oscillate("lockup", "y", { amplitude: 5, frequency: 0.4 }, { from: 1.2, until: 3.2 }),
    oscillate("lockup", "y", { amplitude: 5, frequency: 0.4 }, { from: 26.4, until: 29.2 }),
  ],

  // Label-anchored score: retime any step (overlay or regeneration) and the
  // sound design follows. Code lines get real CC0 keyboard presses.
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.3, fadeIn: 1.2, fadeOut: 2.2, duck: { depth: 0.45 } },
    cues: [
      { at: "logo-in", sfx: "whoosh", gain: 0.85 },
      { at: "logo-in", offset: 0.22, sfx: "pop", gain: 0.6 },
      { at: "ch2-in", sfx: "whoosh", gain: 0.7 },
      ...CODE_LINES.map((_, i): AudioCueIR => ({
        at: "ch2-in",
        offset: 0.5 + i * 0.22, // shares the stagger constant with the timeline
        file: `keypress-${["001", "004", "007", "010", "014"][i % 5]}.wav`,
        gain: 0.5,
      })),
      { at: "card-in", sfx: "pop", gain: 0.75 },
      { at: "ch3-in", sfx: "whoosh", gain: 0.7 },
      { at: "ch3-in", offset: 0.9, sfx: "rise", gain: 0.55 },
      { at: "ch3-in", offset: 2.2, sfx: "rise", gain: 0.45 },
      { at: "ch3-in", offset: 3.3, file: "click_003.ogg", gain: 0.6 },
      { at: "ch4-in", sfx: "whoosh", gain: 0.7 },
      ...[0, 1, 2].map((i): AudioCueIR => ({ at: "ch4-in", offset: 1.4 + i * 0.45, file: "click_002.ogg", gain: 0.55 })),
      { at: "ch4-in", offset: 1.4 + 3 * 0.45, sfx: "thud", gain: 0.6 },
      { at: "ch4-in", offset: 1.4 + 4 * 0.45, file: "confirmation_001.ogg", gain: 0.5 },
      { at: "ch5-in", sfx: "whoosh", gain: 0.7 },
      ...MINIS.map((_, i): AudioCueIR => ({ at: "ch5-in", offset: 0.5 + i * 0.18, sfx: "pop", gain: 0.6 })),
      { at: "close-in", sfx: "shimmer", gain: 0.65 },
      { at: "close-in", offset: 0.15, sfx: "pop", gain: 0.45 },
    ],
  },
});
