// "running Claude Code" — a faithful ~1 min session: launch `claude`, the real
// v2.1 welcome screen boots (account card + mascot + Tips/What's new), a prompt is
// typed, then the full agent run STREAMS into a scrolling transcript: read the
// guide, write the scene, a code panel, render (with an error → fix → re-render),
// the result, and a done checklist. Box-drawing/special glyphs are DRAWN (Inter
// only). The camera frames the welcome, then pushes into each key beat.

import {
  scene, group, rect, text, line, path, ellipse,
  seq, par, tween, wait, oscillate,
  devicePreset, deviceScreenPoint,
  splitText, textIn, textTypeCues, cameraTo,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#08080A", SCREEN = "#17150F";
const CORAL = "#D9775A", FG = "#E7E3DA", MUTED = "#9A958B", DIM = "#6A655C", GREEN = "#7FB069", RED = "#E5705A", CODE = "#A9B0C0", GOLD = "#E9B949";

const TOPTS = { id: "term", x: W / 2, y: H / 2 + 6, scale: 1.46, screen: SCREEN, url: "zsh — ~/dev/reframe" } as const;
const sp = (lx: number, ly: number): [number, number] => deviceScreenPoint("terminal", TOPTS, [lx, ly]);

// screen-LOCAL coords (origin = screen centre; 900x560)
const t = (id: string, x: number, y: number, s: string, fill: string, size: number, weight = 500, anchor: "center" | "center-left" = "center-left", opacity = 1): NodeIR =>
  text({ id, x, y, anchor, content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill, opacity });
const hrule = (id: string, x1: number, x2: number, y: number, stroke: string, opacity = 1): NodeIR =>
  line({ id, x1, y1: y, x2, y2: y, stroke, strokeWidth: 1.4, opacity });
const dotR = (id: string, x: number, y: number, fill: string): NodeIR =>
  rect({ id, x, y, anchor: "center", width: 9, height: 9, radius: 4.5, fill });
const elbow = (id: string, x: number, y: number): NodeIR[] => [
  rect({ id: `${id}v`, x, y: y - 5, anchor: "center", width: 2, height: 14, radius: 1, fill: DIM }),
  rect({ id: `${id}h`, x, y: y + 2, anchor: "center-left", width: 11, height: 2, radius: 1, fill: DIM }),
];
const check = (id: string, x: number, y: number): NodeIR =>
  path({ id, d: "M0 4 L4 9 L11 -2", x, y, stroke: GREEN, strokeWidth: 2.2, originX: 0, originY: 0 });

// transcript row builders (feed-local coords; opacity 0 until streamed)
const DX = -424, TX = -408, EX = -416, SX = -396;
const userRow = (id: string, y: number, s: string): NodeIR =>
  group({ id, x: 0, y: 0, opacity: 0 }, [t(`${id}t`, -432, y, s, FG, 18, 600)]);
const msgRow = (id: string, y: number, s: string): NodeIR =>
  group({ id, x: 0, y: 0, opacity: 0 }, [dotR(`${id}d`, DX, y, CORAL), t(`${id}t`, TX, y, s, FG, 17, 500)]);
const toolRow = (id: string, y: number, s: string): NodeIR =>
  group({ id, x: 0, y: 0, opacity: 0 }, [dotR(`${id}d`, DX, y, CORAL), t(`${id}t`, TX, y, s, FG, 17, 600)]);
const subRow = (id: string, y: number, s: string, fill = DIM): NodeIR =>
  group({ id, x: 0, y: 0, opacity: 0 }, [...elbow(`${id}e`, EX, y), t(`${id}t`, SX, y, s, fill, 15, 500)]);

// the typed shell command and the typed prompt
const cmd = splitText("claude", { id: "cmd", x: -406, y: -262, fontSize: 18, fontWeight: 700, fill: FG, align: "left", opacity: 0 });
const ask = splitText("make a bouncing logo sting", { id: "ask", x: -406, y: 30, fontSize: 17, fontWeight: 400, fill: FG, align: "left", opacity: 0 });
const ask2 = splitText("now make the mark gold and 9:16", { id: "ask2", x: -406, y: 30, fontSize: 17, fontWeight: 400, fill: FG, align: "left", opacity: 0 });

// the Claude mark — the blocky coral mascot (stepped-top head, ears, eyes, feet)
const EYE = "#100C08";
const mark = (cx: number, cy: number): NodeIR[] => [
  rect({ id: "mk-top", x: cx, y: cy - 18, anchor: "center", width: 36, height: 11, radius: 2, fill: CORAL }),
  rect({ id: "mk-body", x: cx, y: cy - 1, anchor: "center", width: 46, height: 28, radius: 2, fill: CORAL }),
  rect({ id: "mk-earL", x: cx - 26, y: cy - 2, anchor: "center", width: 6, height: 11, radius: 1, fill: CORAL }),
  rect({ id: "mk-earR", x: cx + 26, y: cy - 2, anchor: "center", width: 6, height: 11, radius: 1, fill: CORAL }),
  rect({ id: "mk-eL", x: cx - 10, y: cy - 4, anchor: "center", width: 9, height: 11, radius: 1, fill: EYE }),
  rect({ id: "mk-eR", x: cx + 10, y: cy - 4, anchor: "center", width: 9, height: 11, radius: 1, fill: EYE }),
  ...[-12, -5, 5, 12].map((dx, i) =>
    rect({ id: `mk-f${i}`, x: cx + dx, y: cy + 19, anchor: "center", width: 5, height: 9, radius: 1, fill: CORAL })),
];

// the scrolling session transcript (feed-local y; revealed + scrolled in the timeline)
const CODE_LINES = [
  'export default scene({',
  '  nodes: [ logo({ id: "mark" }), wordmark({ id: "word" }) ],',
  '  timeline: seq(',
  '    motionPreset("punch-in",    { target: "mark", energy: .9 }),',
  '    motionPreset("rise-settle", { target: "word" }) ) })',
];
const TODO_LINES = ["read the eDSL guide", "write the scene", "fix the ellipse radius", "render to mp4"];

const feed: NodeIR[] = [
  userRow("u0", 0, "> make a bouncing logo sting"),
  msgRow("a1", 44, "I'll read the guide, then build and render a logo sting."),
  toolRow("r2", 90, "Read(docs/guides/edsl-guide.md)"),
  subRow("r2s", 114, "read 284 lines"),
  toolRow("w4", 152, "Write(logo-sting.ts)"),
  subRow("w4s", 176, "created  ·  96 lines"),
  // code panel
  group({ id: "code", x: 0, y: 0, opacity: 0 }, [
    rect({ id: "code-bg", x: -52, y: 256, anchor: "center", width: 740, height: 132, radius: 8, fill: "#0E1119", stroke: "#262D3B", strokeWidth: 1.4 }),
    ...CODE_LINES.map((s, i) => t(`code-${i}`, -410, 212 + i * 22, s, i === 0 || s.includes("seq") ? CODE : CODE, 14, 500)),
  ]),
  toolRow("b7", 344, "Bash(pnpm reframe render logo-sting.ts)"),
  subRow("spin", 368, "rendering frames…"),
  subRow("err", 368, 'Error: ellipse "glow" has no prop "radius"', RED),
  msgRow("fix", 410, "I set `radius` on an ellipse. Removing it."),
  toolRow("e11", 454, "Edit(logo-sting.ts)"),
  subRow("e11s", 478, "updated  ·  1 change"),
  toolRow("b13", 516, "Bash(pnpm reframe render logo-sting.ts)"),
  subRow("res", 540, "out/logo-sting.mp4  ·  120 frames @ 30fps", GREEN),
  msgRow("done", 584, "Done. The mark punches in, overshoots, then settles."),
  // done checklist
  group({ id: "todo", x: 0, y: 0, opacity: 0 }, [
    rect({ id: "todo-bg", x: -150, y: 670, anchor: "center", width: 540, height: 132, radius: 8, fill: "#0E140F", stroke: "#243325", strokeWidth: 1.4 }),
    ...TODO_LINES.map((s, i) => [
      check(`todo-c${i}`, -402, 624 + i * 26),
      t(`todo-${i}`, -384, 624 + i * 26, s, MUTED, 14, 500),
    ]).flat(),
  ]),

  // ── second turn: a follow-up edit ──
  userRow("u1", 778, "> now make the mark gold and 9:16"),
  msgRow("a2", 822, "I'll recolor the mark gold and switch to a 9:16 canvas."),
  toolRow("e2", 866, "Edit(logo-sting.ts)"),
  subRow("e2s", 890, "updated  ·  2 changes"),
  toolRow("b2", 928, "Bash(pnpm reframe render logo-sting.ts)"),
  subRow("res2", 952, "out/logo-sting.mp4  ·  1080×1920  ·  120 frames", GREEN),
  msgRow("done2", 996, "Done. Gold mark, vertical 9:16."),
];

const SCREEN_NODES: NodeIR[] = [
  // shell command line (slides away on submit)
  group({ id: "cmdline", x: 0, y: 0 }, [t("pct", -432, -262, "%", GREEN, 18, 700), ...cmd.nodes]),

  // the scrolling transcript
  group({ id: "feed", x: 0, y: 110 }, feed),

  // ── the welcome banner (drawn box, blooms in; slides away on submit) ─────────
  group({ id: "welcome", x: 0, y: 0, opacity: 0 }, [
    rect({ id: "wbox", x: 0, y: -134, anchor: "center", width: 896, height: 204, fill: "none", stroke: CORAL, strokeWidth: 1.6, radius: 12 }),
    rect({ id: "wtitle-bg", x: -312, y: -236, anchor: "center", width: 232, height: 16, fill: SCREEN }),
    t("wtitle", -432, -236, "Claude Code v2.1.179", CORAL, 14, 600),
    line({ id: "wdiv", x1: -34, y1: -214, x2: -34, y2: -54, stroke: "#3A342B", strokeWidth: 1.4 }),
    t("l-hi", -242, -204, "Welcome back Kiyeon Jeon!", FG, 16, 600, "center"),
    ...mark(-242, -150),
    t("l-model", -242, -100, "Opus 4.8 (1M context)  ·  Claude Max  ·", MUTED, 13, 500, "center"),
    t("l-org", -242, -78, "kiyeon.jeon.21@gmail.com's Organization", MUTED, 13, 500, "center"),
    t("l-cwd", -242, -56, "~/dev/reframe", DIM, 13, 500, "center"),
    t("r-tips", -16, -212, "Tips for getting started", CORAL, 14, 700),
    t("r-tip1", -16, -190, "Run /init to create a CLAUDE.md file with instructions for Cla…", FG, 12.5, 500),
    hrule("r-rule", -16, 430, -172, "#332E26"),
    t("r-new", -16, -154, "What's new", CORAL, 14, 700),
    t("r-n1", -16, -132, "Fixed mid-stream connection drops: partial responses are now p…", MUTED, 12.5, 500),
    t("r-n2", -16, -110, "Fixed mouse-wheel scrolling in WSL2 under Windows Terminal and…", MUTED, 12.5, 500),
    t("r-n3", -16, -88, "Fixed a sandbox denyRead/allowRead glob over a large direc…", MUTED, 12.5, 500),
    t("r-rel", -16, -62, "/release-notes for more", DIM, 12.5, 500),
  ]),

  // ── input box + auto-mode line (pinned at the bottom; masks the scroll) ──────
  group({ id: "inputzone", x: 0, y: 0, opacity: 0 }, [
    rect({ id: "in-mask", x: 0, y: 48, anchor: "center", width: 904, height: 130, fill: SCREEN }), // hides scrolled content under the input (moves with it)
    hrule("in-top", -448, 448, 4, "#2A251D"),
    path({ id: "chev", d: "M0 0 L8 7 L0 14", x: -432, y: 23, stroke: CORAL, strokeWidth: 2.4, originX: 0, originY: 0 }),
    t("ph", -406, 30, 'Try "edit a scene to add a wiggle…"', DIM, 17, 400),
    group({ id: "askg", x: 0, y: 0 }, ask.nodes),
    group({ id: "askg2", x: 0, y: 0 }, ask2.nodes),
    rect({ id: "caret", x: -406, y: 30, anchor: "center", width: 10, height: 22, fill: FG, opacity: 0 }),
    hrule("in-bot", -448, 448, 56, "#2A251D"),
    path({ id: "pp", d: "M0 0 L9 5.5 L0 11 Z M11 0 L20 5.5 L11 11 Z", x: -440, y: 74, fill: CORAL, originX: 0, originY: 0 }),
    t("auto", -410, 80, "auto mode on (shift+tab to cycle)  ·  ← for agents", MUTED, 13, 500),
  ]),
];

// the rendered logo sting, shown in a 9:16 "player" at the end (the file the run made)
const SF = { w: 432, h: 768 };
const playerNode: NodeIR = group({ id: "player", x: W / 2, y: H / 2, scale: 0.9, opacity: 0, fixed: true }, [
  rect({ id: "pl-frame", x: 0, y: 0, anchor: "center", width: SF.w, height: SF.h, radius: 22, fill: "#0A0C16", stroke: "#232A3E", strokeWidth: 1.6 }),
  group({ id: "sting", x: 0, y: 0, clip: { kind: "rect", x: -SF.w / 2, y: -SF.h / 2, width: SF.w, height: SF.h, radius: 22 } }, [
    ...Array.from({ length: 5 }, (_, i) => { const tt = i / 4; return ellipse({ id: `pl-glow${i}`, x: 0, y: -70, anchor: "center", width: 380 - tt * 240, height: 380 - tt * 240, fill: GOLD, opacity: 0.05 }); }),
    group({ id: "sting-mark", x: 0, y: -70, scale: 0, rotation: -10, opacity: 0 }, [
      rect({ id: "sm-sq", x: 0, y: 0, anchor: "center", width: 134, height: 134, radius: 32, fill: GOLD }),
      path({ id: "sm-tri", d: "M-20 -28 L30 0 L-20 28 Z", x: 0, y: 0, fill: "#1A1407", originX: 0, originY: 0 }),
    ]),
    text({ id: "sting-word", x: 0, y: 132, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 54, fontWeight: 800, fill: "#F2EEE6", opacity: 0 }),
    text({ id: "sting-tag", x: 0, y: 178, anchor: "center", content: "every frame is code", fontFamily: "Inter", fontSize: 19, fontWeight: 500, fill: GOLD, opacity: 0 }),
    rect({ id: "pl-track", x: 0, y: 332, anchor: "center", width: 388, height: 4, radius: 2, fill: "#222A3C" }),
    rect({ id: "bar-fill", x: -194, y: 332, anchor: "center-left", width: 0, height: 4, radius: 2, fill: GOLD }),
    rect({ id: "sting-flash", x: 0, y: 0, anchor: "center", width: SF.w, height: SF.h, fill: "#FFFFFF", opacity: 0 }),
  ]),
  text({ id: "pl-cap", x: 0, y: SF.h / 2 + 34, anchor: "center", content: "out/logo-sting.mp4  ·  1080×1920  ·  120 frames", fontFamily: "Inter", fontSize: 18, fontWeight: 500, fill: "#5A6076" }),
]);

// camera helper: focal at screen-local (0, ly), vary zoom (scroll provides the motion)
const cam = (zoom: number, d: number, label?: string, ly = 0) =>
  cameraTo({ x: sp(0, ly)[0], y: sp(0, ly)[1], zoom }, { duration: d, ease: "easeInOutCubic", ...(label ? { label } : {}) });
const scroll = (y: number, d = 0.6) => tween("feed", { y }, { duration: d, ease: "easeInOutCubic" });
const show = (id: string, d = 0.3, label?: string) => tween(id, { opacity: 1 }, { duration: d, ease: "easeOutCubic", ...(label ? { label } : {}) });
// scroll the feed so a line at local `lineY` sits just above the bottom input box
const sY = (lineY: number) => 110 - lineY;

export default scene({
  id: "terminal-claude",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: sp(-360, -262)[0], y: sp(-360, -262)[1], zoom: 1.5, rotation: 0 },
  nodes: [
    devicePreset("terminal", { ...TOPTS, content: SCREEN_NODES }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#39435C", fixed: true }),
    playerNode,
  ],

  timeline: seq(
    // ── launch ──
    wait(0.5),
    textIn("typewriter", cmd, { label: "type-cmd" }),
    wait(0.45),
    par(
      tween("welcome", { opacity: 1 }, { duration: 0.55, ease: "easeOutCubic", label: "boot" }),
      seq(wait(0.2), tween("inputzone", { opacity: 1 }, { duration: 0.45, ease: "easeOutCubic" })),
      cam(0.96, 1.1),
    ),
    wait(0.6),
    // ── tour the welcome ──
    cameraTo({ x: sp(-242, -110)[0], y: sp(-242, -110)[1], zoom: 1.5 }, { duration: 1.0, ease: "easeInOutCubic", label: "to-card" }),
    wait(0.7),
    cameraTo({ x: sp(170, -118)[0], y: sp(170, -118)[1], zoom: 1.42 }, { duration: 1.1, ease: "easeInOutCubic", label: "to-news" }),
    wait(0.7),
    // ── type the prompt ──
    cameraTo({ x: sp(-80, 30)[0], y: sp(-80, 30)[1], zoom: 1.34 }, { duration: 0.9, ease: "easeInOutCubic", label: "to-input" }),
    tween("ph", { opacity: 0 }, { duration: 0.2 }),
    textIn("typewriter", ask, { label: "type-ask", speed: 1.1 }),
    wait(0.35),
    // ── submit: banner + command slide away, the input DROPS to the bottom ──
    par(
      tween("welcome", { y: -150, opacity: 0 }, { duration: 0.6, ease: "easeInCubic", label: "submit" }),
      tween("cmdline", { y: -150, opacity: 0 }, { duration: 0.6, ease: "easeInCubic" }),
      tween("askg", { opacity: 0 }, { duration: 0.3 }),
      tween("inputzone", { y: 180 }, { duration: 0.7, ease: "easeInOutCubic" }), // input slides to the bottom
      cam(1.0, 0.9),
    ),
    wait(0.3),
    // ── the run streams in, bottom-anchored just above the input (scroll up) ──
    par(scroll(sY(0)), show("u0")), wait(0.35),
    par(scroll(sY(44)), show("a1", 0.35)), wait(0.5),
    par(scroll(sY(114)), show("r2"), seq(wait(0.15), show("r2s", 0.3))), wait(0.6),
    par(scroll(sY(176)), show("w4"), seq(wait(0.15), show("w4s", 0.3))), wait(0.4),
    // code panel — push in to "read" it
    par(scroll(sY(322), 0.8), show("code", 0.5), cam(1.2, 0.9, "to-code", 44)),
    wait(2.6),
    cam(1.0, 0.8),
    // render → error
    par(scroll(sY(344), 0.7), show("b7")), wait(0.4),
    show("spin", 0.3), wait(2.1),
    par(tween("spin", { opacity: 0 }, { duration: 0.2 }), show("err", 0.3, "err"), scroll(sY(368), 0.5), cam(1.16, 0.7, "to-err", 80)),
    wait(2.0),
    cam(1.0, 0.7),
    // fix → re-render
    show("fix", 0.35), wait(0.5),
    par(scroll(sY(478), 0.7), show("e11"), seq(wait(0.15), show("e11s", 0.3))), wait(0.6),
    par(scroll(sY(516), 0.6), show("b13")), wait(2.0), // re-rendering…
    // the result — push in
    par(show("res", 0.4, "result"), scroll(sY(540), 0.6), cam(1.2, 0.8, "to-result", 80)),
    wait(1.8),
    cam(1.0, 0.8),
    // done + checklist
    par(scroll(sY(584), 0.7), show("done", 0.35)), wait(0.5),
    par(show("todo", 0.5), scroll(sY(736), 0.9), cam(1.16, 0.9, "to-todo", 44)),
    wait(2.4),

    // ── second turn: a follow-up edit (typed into the bottom input) ──
    cam(1.0, 0.7),
    cameraTo({ x: sp(-80, 210)[0], y: sp(-80, 210)[1], zoom: 1.3 }, { duration: 0.9, ease: "easeInOutCubic", label: "to-input2" }),
    textIn("typewriter", ask2, { label: "type-ask2", speed: 1.1 }),
    wait(0.4),
    par(
      tween("askg2", { opacity: 0 }, { duration: 0.3 }),
      cam(1.0, 0.9),
      seq(
        wait(0.3),
        par(scroll(sY(778), 0.7), show("u1")), wait(0.3),
        par(scroll(sY(822)), show("a2", 0.35)), wait(0.6),
        par(scroll(sY(890), 0.7), show("e2"), seq(wait(0.15), show("e2s", 0.3))), wait(0.6),
        par(scroll(sY(928), 0.6), show("b2")), wait(2.0),
        par(show("res2", 0.4, "result2"), scroll(sY(952), 0.6), cam(1.2, 0.8, "to-result2", 80)),
        wait(1.6),
        cam(1.0, 0.8),
        par(scroll(sY(996), 0.6), show("done2", 0.35)),
      ),
    ),
    wait(1.0),
    // ── reveal the rendered logo sting in a 9:16 player ──
    cam(1.0, 0.6),
    par(
      tween("term", { opacity: 0 }, { duration: 0.7, ease: "easeInCubic", label: "reveal" }),
      tween("wm", { opacity: 0 }, { duration: 0.5 }),
      tween("player", { opacity: 1, scale: 1 }, { duration: 0.7, ease: "easeOutBack" }),
    ),
    wait(0.3),
    // play it: the mark punches in (overshoot), the wordmark rises and settles
    par(
      seq(
        tween("sting-mark", { opacity: 1, scale: 1.12, rotation: 0 }, { duration: 0.42, ease: "easeOutBack", label: "sting" }),
        tween("sting-mark", { scale: 1 }, { duration: 0.22, ease: "easeOutCubic" }),
      ),
      seq(wait(0.14), tween("sting-flash", { opacity: 0.5 }, { duration: 0.08 }), tween("sting-flash", { opacity: 0 }, { duration: 0.5 })),
      seq(wait(0.32), tween("sting-word", { opacity: 1, y: 98 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.55), tween("sting-tag", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
      tween("bar-fill", { width: 388 }, { duration: 2.6, ease: "linear" }),
    ),
    wait(2.2),
  ),

  behaviors: [
    oscillate("caret", "opacity", { amplitude: 0.8, frequency: 1.6, phase: 0 }, { from: 7.4, until: 10.3 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.1, fadeIn: 1.2, fadeOut: 2.0, duck: { depth: 0.3 } },
    cues: [
      ...textTypeCues(cmd, { at: "type-cmd", gain: 0.32 }),
      { at: "boot", file: "maximize_001.ogg", gain: 0.34 },
      { at: "to-card", file: "select_001.ogg", gain: 0.22 },
      { at: "to-news", file: "select_002.ogg", gain: 0.22 },
      ...textTypeCues(ask, { at: "type-ask", interval: 0.065 / 1.1, gain: 0.32 }),
      { at: "submit", file: "select_003.ogg", gain: 0.34 },
      { at: "to-code", file: "pluck_001.ogg", gain: 0.34 },
      { at: "err", file: "glass_001.ogg", gain: 0.42 },
      { at: "result", file: "confirmation_003.ogg", gain: 0.5 },
      { at: "result", offset: 0.05, sfx: "shimmer", gain: 0.32 },
      { at: "to-todo", file: "pluck_002.ogg", gain: 0.3 },
      ...textTypeCues(ask2, { at: "type-ask2", interval: 0.065 / 1.1, gain: 0.32 }),
      { at: "result2", file: "confirmation_004.ogg", gain: 0.5 },
      { at: "result2", offset: 0.05, sfx: "shimmer", gain: 0.32 },
      { at: "reveal", file: "maximize_009.ogg", gain: 0.4 },
      { at: "sting", file: "bong_001.ogg", gain: 0.55 },
      { at: "sting", offset: 0.02, sfx: "thud", gain: 0.34 },
      { at: "sting", offset: 0.32, sfx: "shimmer", gain: 0.36 },
    ],
  },
});
