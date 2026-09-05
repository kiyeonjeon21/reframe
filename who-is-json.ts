// "who is json" — the Day-1-of-vibecoding meme as motion graphic.
//
// The joke is deadpan irony: a non-technical person vibecoding for the first
// time types "who is json" (JSON is a data format, not a person). That basic
// question never gets answered. Meanwhile the assistant asks for FULL ACCESS to
// the machine, and the user clicks Allow without a second of hesitation.
// Punchline holds on "FULL ACCESS GRANTED" while "who is json" is still spinning.

import {
  scene, group, rect, ellipse, line, text,
  seq, par, beat, tween, wait, oscillate,
  splitText, textIn, textTypeCues,
  cursor, cursorTo, cursorClick,
} from "@reframe/core";

const W = 1920, H = 1080;

// dark chat UI palette
const BG = "#08080C";
const WIN = "#15151B";
const WINSTROKE = "#2A2A33";
const URLPILL = "#0E0E13";
const TXT = "#E6E8EE";
const MUTED = "#7E8696";
const USER = "#2B6CF6";
const AI = "#20202A";
const DOT = "#8A90A0";
const WARN = "#FFB020";
const DENY = "#2A2A33";
const ALLOW = "#FF3B30";
const GRANTED = "#22C55E";

// the user's question, typed letter by letter in the input bar.
// NOTE: these glyphs live INSIDE the `win` group (centered at 960,600), so their
// coords are win-LOCAL, not scene. weight must be 400/700/800 — the bundled Inter
// metrics only cover those, and an unmetered weight (e.g. 500) yields NaN advances
// that collapse every glyph onto one point.
const Q = splitText("who is json", {
  id: "q", x: -520, y: 308, fontSize: 34, fontWeight: 400, fill: TXT, align: "left",
});

export default scene({
  id: "who-is-json",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    text({ id: "caption", x: 960, y: 120, anchor: "center", content: "Day 1 of vibecoding", fontFamily: "Inter", fontSize: 44, fontWeight: 700, fill: TXT, letterSpacing: 1, opacity: 0 }),

    group({ id: "win", x: 960, y: 600, scale: 0.92, opacity: 0 }, [
      // window body
      rect({ id: "win-card", x: 0, y: 0, width: 1200, height: 760, radius: 22, anchor: "center", fill: WIN, stroke: WINSTROKE, strokeWidth: 2, shadowColor: "#000000", shadowBlur: 70, shadowY: 36 }),

      // everything inside the window, clipped to its rounded rect (local coords = group-local)
      group({ id: "screen", x: 0, y: 0, clip: { kind: "rect", x: -600, y: -380, width: 1200, height: 760, radius: 22 } }, [
        // title bar
        ellipse({ id: "tl-r", x: -552, y: -332, width: 18, height: 18, anchor: "center", fill: "#FF5F57" }),
        ellipse({ id: "tl-y", x: -522, y: -332, width: 18, height: 18, anchor: "center", fill: "#FEBC2E" }),
        ellipse({ id: "tl-g", x: -492, y: -332, width: 18, height: 18, anchor: "center", fill: "#28C840" }),
        rect({ id: "urlpill", x: 0, y: -332, width: 360, height: 38, radius: 19, anchor: "center", fill: URLPILL }),
        text({ id: "url", x: 0, y: -332, anchor: "center", content: "grok.com", fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: MUTED }),
        line({ id: "divider", x1: -600, y1: -304, x2: 600, y2: -304, stroke: "#1F1F27", strokeWidth: 2 }),

        // user bubble (right) — appears on send, holds the unanswered question
        group({ id: "ubble", x: 380, y: -180, scale: 0.9, opacity: 0 }, [
          rect({ id: "ubble-bg", x: 0, y: 0, width: 320, height: 84, radius: 20, anchor: "center", fill: USER }),
          text({ id: "ubble-tx", x: 0, y: 1, anchor: "center", content: "who is json", fontFamily: "Inter", fontSize: 34, fontWeight: 600, fill: "#FFFFFF" }),
        ]),

        // assistant row (left) — perpetually "thinking", never answers
        group({ id: "airow", x: 0, y: 0, opacity: 0 }, [
          ellipse({ id: "ai-av", x: -540, y: -40, width: 56, height: 56, anchor: "center", fill: "#2A2A36" }),
          text({ id: "ai-star", x: -540, y: -42, anchor: "center", content: "✦", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: WARN }),
          rect({ id: "ai-bub", x: -380, y: -40, width: 150, height: 72, radius: 20, anchor: "center", fill: AI }),
          ellipse({ id: "dot0", x: -418, y: -40, width: 16, height: 16, anchor: "center", fill: DOT }),
          ellipse({ id: "dot1", x: -380, y: -40, width: 16, height: 16, anchor: "center", fill: DOT }),
          ellipse({ id: "dot2", x: -342, y: -40, width: 16, height: 16, anchor: "center", fill: DOT }),
        ]),

        // input bar
        group({ id: "inputbar", x: 0, y: 0, opacity: 0 }, [
          rect({ id: "input-bg", x: 0, y: 312, width: 1120, height: 72, radius: 36, anchor: "center", fill: URLPILL, stroke: "#26262F", strokeWidth: 2 }),
          ellipse({ id: "send-btn", x: 512, y: 312, width: 52, height: 52, anchor: "center", fill: USER }),
          text({ id: "send-ar", x: 512, y: 308, anchor: "center", content: "↑", fontFamily: "Inter", fontSize: 30, fontWeight: 800, fill: "#FFFFFF" }),
        ]),
        // typed query lives in the input bar (scene coords; inside the clip)
        ...Q.nodes,

        // permission modal layer
        rect({ id: "scrim", x: 0, y: 0, width: 1200, height: 760, anchor: "center", fill: "#000000", opacity: 0 }),
        group({ id: "modal", x: 0, y: 660, opacity: 1 }, [
          rect({ id: "modal-card", x: 0, y: 0, width: 820, height: 380, radius: 22, anchor: "center", fill: "#1B1B22", stroke: "#33333E", strokeWidth: 2, shadowColor: "#000000", shadowBlur: 50, shadowY: 20 }),
          ellipse({ id: "warn-ic", x: 0, y: -118, width: 72, height: 72, anchor: "center", fill: "#3A2A12", stroke: WARN, strokeWidth: 3 }),
          text({ id: "warn-x", x: 0, y: -121, anchor: "center", content: "!", fontFamily: "Inter", fontSize: 44, fontWeight: 800, fill: WARN }),
          text({ id: "modal-title", x: 0, y: -32, anchor: "center", content: "Allow full access?", fontFamily: "Inter", fontSize: 42, fontWeight: 800, fill: TXT }),
          text({ id: "modal-sub", x: 0, y: 22, anchor: "center", content: "This app wants full access to your computer.", fontFamily: "Inter", fontSize: 26, fontWeight: 400, fill: MUTED }),
          rect({ id: "deny-btn", x: -200, y: 112, width: 240, height: 66, radius: 16, anchor: "center", fill: DENY }),
          text({ id: "deny-tx", x: -200, y: 110, anchor: "center", content: "Deny", fontFamily: "Inter", fontSize: 28, fontWeight: 600, fill: "#AEB4C0" }),
          rect({ id: "allow-btn", x: 160, y: 112, width: 330, height: 66, radius: 16, anchor: "center", fill: ALLOW }),
          text({ id: "allow-tx", x: 160, y: 110, anchor: "center", content: "Allow full access", fontFamily: "Inter", fontSize: 28, fontWeight: 700, fill: "#FFFFFF" }),
        ]),

        // white flash on grant
        rect({ id: "flash", x: 0, y: 0, width: 1200, height: 760, anchor: "center", fill: "#FFFFFF", opacity: 0 }),
      ]),
    ]),

    // cursor (above the window)
    cursor({ id: "cur", x: 1740, y: 1040, opacity: 0, accent: "#FFFFFF" }),

    // punchline stamp (above everything)
    group({ id: "stamp", x: 960, y: 600, scale: 0.6, opacity: 0 }, [
      text({ id: "stamp-tx", x: 0, y: -34, anchor: "center", content: "FULL ACCESS GRANTED", fontFamily: "Inter", fontSize: 92, fontWeight: 800, fill: GRANTED, letterSpacing: 1 }),
      text({ id: "stamp-sub", x: 0, y: 52, anchor: "center", content: "(still has no idea what JSON is)", fontFamily: "Inter", fontSize: 34, fontWeight: 400, fill: MUTED, opacity: 0 }),
    ]),

    // Musk's reaction. Emoji renders via the system color-emoji font (chromium
    // fallback) — not part of the golden contract, but fine for a meme.
    text({ id: "lol", x: 960, y: 808, anchor: "center", content: "😂", fontFamily: "Inter", fontSize: 150, opacity: 0, scale: 0.4 }),
  ],

  timeline: seq(
    // window in
    beat("intro", {}, [seq(
      par(
        tween("win", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack" }),
        tween("caption", { opacity: 1 }, { duration: 0.5 }),
      ),
      tween("inputbar", { opacity: 1 }, { duration: 0.3 }),
    )]),

    // type "who is json"
    beat("ask", {}, [seq(
      textIn("typewriter", Q, { label: "type", speed: 0.85 }),
      wait(0.35, "typed"),
      // send: clear input, pop the user bubble
      par(
        ...Q.ids.map((id) => tween(id, { opacity: 0 }, { duration: 0.18 })),
        seq(
          par(
            tween("ubble", { opacity: 1 }, { duration: 0.22, label: "send" }),
            tween("ubble", { scale: 1.08, y: -210 }, { duration: 0.26, ease: "easeOutBack" }),
          ),
          tween("ubble", { scale: 1 }, { duration: 0.12 }),
        ),
      ),
      // assistant starts "thinking" and never stops
      tween("airow", { opacity: 1 }, { duration: 0.3, label: "think" }),
      wait(1.3, "hang"),
    )]),

    // permission modal slides up
    beat("warn", {}, [seq(
      par(
        tween("scrim", { opacity: 0.66 }, { duration: 0.4 }),
        tween("modal", { y: 60 }, { duration: 0.5, ease: "easeOutBack", label: "warnup" }),
      ),
      wait(0.5, "beat2"),
    )]),

    // cursor clicks Allow with zero hesitation
    beat("act", {}, [seq(
      tween("cur", { opacity: 1 }, { duration: 0.2 }),
      cursorTo("cur", [1740, 1040], [760, 772], { duration: 0.6, label: "to-deny" }), // drifts past Deny
      wait(0.22),
      cursorTo("cur", [760, 772], [1120, 772], { duration: 0.4, label: "to-allow" }), // straight to Allow
      cursorClick("cur", { press: "allow-btn", label: "click" }),
      // grant: flash + dismiss modal
      par(
        seq(
          tween("flash", { opacity: 0.75 }, { duration: 0.08, label: "grant" }),
          tween("flash", { opacity: 0 }, { duration: 0.3 }),
        ),
        tween("scrim", { opacity: 0 }, { duration: 0.3 }),
        tween("modal", { y: 660, opacity: 0 }, { duration: 0.3 }),
        tween("cur", { opacity: 0 }, { duration: 0.2 }),
      ),
    )]),

    // punchline stamp
    beat("punch", {}, [seq(
      par(
        tween("scrim", { opacity: 0.55 }, { duration: 0.2 }), // dim the chat so the banner reads clean
        tween("stamp", { opacity: 1 }, { duration: 0.14 }),
        tween("stamp", { scale: 1.16 }, { duration: 0.3, ease: "easeOutBack", label: "stamp" }),
      ),
      tween("stamp", { scale: 1 }, { duration: 0.12 }),
      tween("stamp-sub", { opacity: 1 }, { duration: 0.4, label: "sub" }),
      // Musk's "😂" pops in to button the joke
      par(
        tween("lol", { opacity: 1 }, { duration: 0.16 }),
        tween("lol", { scale: 1.18 }, { duration: 0.42, ease: "easeOutBack", label: "lol" }),
      ),
      tween("lol", { scale: 1.05 }, { duration: 0.16 }),
      wait(1.9, "end"),
    )]),
  ),

  behaviors: [
    // the "thinking" dots bob the whole time the question is unanswered
    oscillate("dot0", "y", { amplitude: 7, frequency: 2.4, phase: 0 }, { from: 2.3, until: 4.4 }),
    oscillate("dot1", "y", { amplitude: 7, frequency: 2.4, phase: 0.6 }, { from: 2.3, until: 4.4 }),
    oscillate("dot2", "y", { amplitude: 7, frequency: 2.4, phase: 1.2 }, { from: 2.3, until: 4.4 }),
    // the laughing emoji shakes like it's actually laughing (invisible until the end)
    oscillate("lol", "rotation", { amplitude: 6, frequency: 2.6 }),
  ],

  audio: {
    bgm: { synth: "tension", gain: 0.14, fadeIn: 0.6, fadeOut: 1.6, duck: { depth: 0.5 } },
    cues: [
      ...textTypeCues(Q, { at: "type", interval: 0.09, gain: 0.5 }),
      { at: "send", sfx: "swoosh", gain: 0.5 },
      { at: "think", sfx: "blip", gain: 0.35, pan: -0.3 },
      { at: "warnup", sfx: "rise", gain: 0.55 },
      { at: "warnup", offset: 0.12, sfx: "sub", gain: 0.4 },
      { at: "to-allow", sfx: "tick", gain: 0.3 },
      { at: "click", sfx: "click", gain: 0.75 },
      { at: "grant", sfx: "powerup", gain: 0.5 },
      { at: "stamp", sfx: "boom", gain: 0.6 },
      { at: "stamp", offset: 0.18, sfx: "success", gain: 0.4 },
      { at: "lol", sfx: "coin", gain: 0.45 },
    ],
  },
});
