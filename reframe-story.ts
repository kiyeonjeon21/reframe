// reframe — the full story in under a minute.
//
// The spine is reframe's thesis: a motion scene is ADDRESSABLE DATA — AI writes
// the base, a human directs it with overlays, those edits SURVIVE regeneration,
// and every render is byte-identical. Feature demos live inside that arc.
//
// Showcased: gradient-filled track-matte type, glow/blend light, kinetic type,
// the easing + motionPath motion vocabulary, the character rig (figure +
// humanoid + characterPreset), 2.5D perspective + camera push + DOF rack focus,
// liquid-glass backdrop, data-driven count-up + batch, the overlay-survives-regen
// loop, determinism — scored by autoFoley (the motion writes its own foley) plus
// a label-anchored, ducked bed.

import {
  scene, group, rect, ellipse, line, text,
  seq, par, stagger, beat, tween, wait, oscillate,
  splitText, textIn, textOut, textLoop,
  devicePreset, cameraTo, row,
  figure, humanoid, characterPreset, motionPath,
  cursor, cursorTo, cursorClick,
  linearGradient, radialGradient, conicGradient, glow, dropShadow,
} from "@reframe/core";

const W = 1920, H = 1080;

// House palette (DESIGN.md)
const BG = "#0A0C14";
const FG = "#FFFFFF";
const MUTED = "#8B93A7";
const ACCENT = "#FF4D00";
const TEAL = "#00C2A8";
const VIOLET = "#7C5CFF";
const PINK = "#FF6FA5";
const GOLD = "#FFC861";
const BLUE = "#3AA0FF";
const PANEL_FILL = "#11151F";
const PANEL_STROKE = "#222A3C";

// Pinned-HUD headline baseline.
const HY = 150;

// ── headline helpers (drawn LAST so the HUD always sits over the demos) ──────
const hin = (id: string) =>
  par(
    tween(id, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
    tween(id, { y: HY }, { duration: 0.5, ease: "easeOutBack" }),
  );
const hout = (id: string) =>
  par(
    tween(id, { opacity: 0 }, { duration: 0.3, ease: "easeInQuad" }),
    tween(id, { y: HY - 20 }, { duration: 0.3, ease: "easeInQuad" }),
  );
const headline = (id: string, content: string) =>
  text({
    id, x: W / 2, y: HY + 30, anchor: "center", content,
    fontFamily: "Inter", fontSize: 42, fontWeight: 700, fill: FG,
    letterSpacing: 3, opacity: 0, fixed: true,
  });
const sublabel = (id: string, content: string) =>
  text({
    id, x: W / 2, y: HY + 56, anchor: "center", content,
    fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: MUTED,
    letterSpacing: 4, opacity: 0, fixed: true,
  });

// ════════════════════════════════════════════════════════════════════════════
// NODE BUILDERS PER CHAPTER
// ════════════════════════════════════════════════════════════════════════════

// CH1 — hero: gradient-filled track-matte wordmark + glow orbs + glass strip
const hero = group({ id: "hero", x: W / 2, y: 470, opacity: 0 }, [
  ellipse({ id: "hero-o1", x: -300, y: -40, width: 460, height: 460, anchor: "center", fill: radialGradient([ACCENT, ACCENT + "00"]), blend: "screen", opacity: 0.8 }),
  ellipse({ id: "hero-o2", x: 320, y: 20, width: 520, height: 520, anchor: "center", fill: radialGradient([VIOLET, VIOLET + "00"]), blend: "screen", opacity: 0.8 }),
  group({ id: "hero-matte", x: 0, y: 0, anchor: "center", matte: "alpha" }, [
    text({ id: "hero-mtext", x: 0, y: 0, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 210, fontWeight: 800, fill: "#fff" }),
    rect({ id: "hero-mfill", x: 0, y: 0, width: 1240, height: 280, anchor: "center", fill: linearGradient([ACCENT, PINK, VIOLET, BLUE, TEAL], { angle: 20 }) }),
  ]),
]);
const heroTag = group({ id: "hero-tagwrap", x: W / 2, y: 700, opacity: 0 }, [
  rect({ id: "hero-glass", x: 0, y: 0, width: 760, height: 92, radius: 46, anchor: "center", backdrop: { blur: 18, saturate: 1.4 }, fill: linearGradient(["#FFFFFF1F", "#FFFFFF08"], { angle: 90 }), stroke: "#FFFFFF22", strokeWidth: 1.5 }),
  text({ id: "hero-tag", x: 0, y: 2, anchor: "center", content: "motion graphics, as addressable data", fontFamily: "Inter", fontSize: 30, fontWeight: 500, fill: FG, letterSpacing: 2 }),
]);

// CH2 — "scene is data": code card → kinetic type
const codeLineW = [560, 410, 470, 300];
const codeLines = codeLineW.map((w, i) =>
  rect({ id: `code-l${i}`, x: -300, y: -110 + i * 64, width: 0, height: 22, radius: 6, anchor: "center-left", fill: i === 0 ? ACCENT : i === 3 ? TEAL : "#2A3145", opacity: 0 }),
);
const codeCard = group({ id: "code", x: W / 2, y: 560, opacity: 0 }, [
  rect({ id: "code-panel", x: 0, y: 0, width: 760, height: 360, radius: 24, anchor: "center", fill: PANEL_FILL, stroke: PANEL_STROKE, strokeWidth: 2 }),
  ellipse({ id: "code-dot", x: -330, y: -140, width: 18, height: 18, anchor: "center", fill: ACCENT }),
  ...codeLines,
]);
const KT = splitText("MOTION IS DATA", { id: "kt", x: W / 2, y: 560, fontSize: 132, fontWeight: 800, fill: FG });

// CH3 — motion vocabulary: easing pills + a motionPath orbit
const EASES: { id: string; ease: string; label: string }[] = [
  { id: "ez-0", ease: "easeOutBounce", label: "bounce" },
  { id: "ez-1", ease: "easeOutElastic", label: "elastic" },
  { id: "ez-2", ease: "spring", label: "spring" },
  { id: "ez-3", ease: "easeOutBack", label: "back" },
];
const ezX = row(EASES.length, { center: 720, span: 660 });
const ezPills = EASES.flatMap((e, i) => [
  rect({ id: e.id, x: ezX[i], y: 360, width: 120, height: 120, radius: 24, anchor: "center", fill: [TEAL, VIOLET, PINK, GOLD][i], opacity: 0, ...dropShadow("#000", 30, 0, 16) }),
  text({ id: `${e.id}-cap`, x: ezX[i], y: 720, anchor: "center", content: e.label, fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: MUTED, letterSpacing: 2, opacity: 0 }),
]);
const orbitGroup = group({ id: "orbit", x: 1450, y: 560, opacity: 0 }, [
  ellipse({ id: "orbit-track", x: 0, y: 0, width: 300, height: 300, anchor: "center", fill: "none", stroke: "#2A3145", strokeWidth: 3 }),
  ellipse({ id: "orbit-hub", x: 0, y: 0, width: 70, height: 70, anchor: "center", fill: radialGradient([BLUE, "#152033"]) }),
  ellipse({ id: "orbit-dot", x: 150, y: 0, width: 46, height: 46, anchor: "center", fill: ACCENT, ...glow(ACCENT, 26) }),
]);

// CH4 — character rig
const guy = figure({ id: "guy", x: 640, y: 660, scale: 1.45, opacity: 0, palette: { accent: ACCENT } });
const bot = humanoid({ id: "bot", x: 1300, y: 660, scale: 1.45, opacity: 0, color: TEAL });

// CH5 — depth: device + perspective cards + DOF rack focus + liquid glass nav
const phone = devicePreset("phone", {
  id: "phone", x: 960, y: 600, scale: 0.9, opacity: 0,
  content: [
    rect({ id: "ui-hero", x: 0, y: -150, width: 360, height: 150, radius: 24, fill: linearGradient([ACCENT, PINK], { angle: 50 }), opacity: 0.95 }),
    rect({ id: "ui-r1", x: 0, y: 30, width: 360, height: 56, radius: 16, fill: "#1A2031" }),
    rect({ id: "ui-r2", x: 0, y: 106, width: 360, height: 56, radius: 16, fill: "#1A2031" }),
  ],
});
const glassNav = rect({ id: "glassnav", x: 960, y: 880, width: 520, height: 96, radius: 28, anchor: "center", opacity: 0, backdrop: { blur: 22, saturate: 1.6 }, fill: linearGradient(["#FFFFFF22", "#FFFFFF0A"], { angle: 90 }), stroke: "#FFFFFF2A", strokeWidth: 1.5 });

// CH6 — data chart (count-up + batch hint)
const CHART_VALUES = [42, 68, 55, 90];
const CHART_COLORS = [TEAL, VIOLET, PINK, GOLD];
const CHART_MAX = 100;
const INNER_H = 280;
const PANEL = { x: 960, y: 600, w: 980, h: 420 };
const BASE_Y = PANEL.y + PANEL.h / 2 - 70;
const barX = row(CHART_VALUES.length, { center: PANEL.x, span: 680 });
const chart = group({ id: "chart", x: 0, y: 0, opacity: 0 }, [
  // batch "ghost" copies behind, hinting one-scene-per-row
  rect({ id: "chart-ghost2", x: PANEL.x + 60, y: PANEL.y + 50, width: PANEL.w, height: PANEL.h, radius: 28, anchor: "center", fill: "#0C0F17", stroke: "#161C2A", strokeWidth: 2, opacity: 0.5 }),
  rect({ id: "chart-ghost1", x: PANEL.x + 30, y: PANEL.y + 25, width: PANEL.w, height: PANEL.h, radius: 28, anchor: "center", fill: "#0D111A", stroke: "#19202F", strokeWidth: 2, opacity: 0.7 }),
  rect({ id: "chart-panel", x: PANEL.x, y: PANEL.y, width: PANEL.w, height: PANEL.h, radius: 28, anchor: "center", fill: "#0E121C", stroke: "#1C2334", strokeWidth: 2 }),
  line({ id: "chart-base", x1: PANEL.x - 360, y1: BASE_Y, x2: PANEL.x + 360, y2: BASE_Y, stroke: "#2A3145", strokeWidth: 3 }),
  ...CHART_VALUES.map((v, i) => rect({ id: `bar-${i}`, x: barX[i], y: BASE_Y, width: 96, height: 0, radius: 6, anchor: "bottom-center", fill: CHART_COLORS[i] })),
  ...CHART_VALUES.map((v, i) => text({ id: `val-${i}`, x: barX[i], y: BASE_Y - (v / CHART_MAX) * INNER_H - 44, anchor: "center", content: 0, contentDecimals: 0, suffix: "%", fontFamily: "Inter", fontSize: 36, fontWeight: 700, fill: FG, opacity: 0 })),
]);

// CH7 — the differentiator: a generated "poster" that gets edited + regenerated
const poster = group({ id: "poster", x: W / 2, y: 580, opacity: 0 }, [
  rect({ id: "po-panel", x: 0, y: 0, width: 760, height: 460, radius: 28, anchor: "center", fill: PANEL_FILL, stroke: PANEL_STROKE, strokeWidth: 2 }),
  rect({ id: "po-bar", x: -300, y: -150, width: 360, height: 18, radius: 9, anchor: "center-left", fill: ACCENT, opacity: 0 }),
  text({ id: "po-title", x: -300, y: -90, anchor: "center-left", content: "GENERATED", fontFamily: "Inter", fontSize: 46, fontWeight: 800, fill: FG, letterSpacing: 1, opacity: 0 }),
  rect({ id: "po-b1", x: -300, y: -10, width: 520, height: 34, radius: 8, anchor: "center-left", fill: "#2A3145", opacity: 0 }),
  rect({ id: "po-b2", x: -300, y: 50, width: 400, height: 34, radius: 8, anchor: "center-left", fill: "#222A3C", opacity: 0 }),
  rect({ id: "po-b3", x: -300, y: 110, width: 460, height: 34, radius: 8, anchor: "center-left", fill: "#222A3C", opacity: 0 }),
  // the editable accent dot (top-right)
  ellipse({ id: "po-dot", x: 300, y: -150, width: 56, height: 56, anchor: "center", fill: ACCENT, opacity: 0, ...glow(ACCENT, 0) }),
  ellipse({ id: "po-ring", x: 300, y: -150, width: 56, height: 56, anchor: "center", fill: "none", stroke: TEAL, strokeWidth: 4, opacity: 0 }),
]);
const overlayChip = group({ id: "ochip", x: 1430, y: 470, opacity: 0, scale: 0.9 }, [
  rect({ id: "ochip-bg", x: 0, y: 0, width: 360, height: 84, radius: 16, anchor: "center", fill: "#13251F", stroke: TEAL, strokeWidth: 2 }),
  text({ id: "ochip-t1", x: 0, y: -14, anchor: "center", content: "overlay.json", fontFamily: "Inter", fontSize: 24, fontWeight: 700, fill: TEAL }),
  text({ id: "ochip-t2", x: 0, y: 20, anchor: "center", content: "dot.fill = teal", fontFamily: "Inter", fontSize: 20, fontWeight: 500, fill: MUTED }),
]);
const stamp = group({ id: "stamp", x: W / 2, y: 880, opacity: 0 }, [
  rect({ id: "stamp-bg", x: 0, y: 0, width: 620, height: 80, radius: 40, anchor: "center", fill: "#0E1A16", stroke: TEAL, strokeWidth: 2 }),
  text({ id: "stamp-t", x: 0, y: 2, anchor: "center", content: "every render · byte-identical", fontFamily: "Inter", fontSize: 28, fontWeight: 700, fill: TEAL, letterSpacing: 1 }),
]);
const editCursor = cursor({ id: "cur", x: 1500, y: 980, opacity: 0, accent: FG });

export default scene({
  id: "reframe-story",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, zoom: 1, rotation: 0, perspective: 1100, aperture: 0.05, focus: 0 },
  nodes: [
    hero, heroTag,
    codeCard, ...KT.nodes,
    ...ezPills, orbitGroup,
    guy, bot,
    phone, glassNav,
    rect({ id: "card-near", x: 540, y: 470, width: 280, height: 180, radius: 20, anchor: "center", fill: VIOLET, opacity: 0, z: -120, ...dropShadow("#000", 36, 0, 20) }),
    rect({ id: "card-far", x: 1400, y: 720, width: 280, height: 180, radius: 20, anchor: "center", fill: GOLD, opacity: 0, z: 420 }),
    chart,
    poster, overlayChip, stamp,
    editCursor,

    // headlines — declared LAST so the pinned HUD always draws over the demos
    headline("h2", "EVERY SCENE IS DATA"),
    headline("h3", "A MOTION VOCABULARY"),
    sublabel("h3sub", "EASES · PATHS · PRESETS"),
    headline("h4", "CHARACTERS, RIGGED"),
    headline("h5", "REAL DEPTH"),
    sublabel("h5sub", "PERSPECTIVE · CAMERA · RACK FOCUS"),
    headline("h6", "DATA-DRIVEN"),
    sublabel("h6sub", "ONE SCENE → EVERY ROW"),
    headline("h7", "AI WRITES THE BASE"),
  ],

  timeline: seq(
    // ════ CH1 — HERO ════════════════════════════════════════════
    beat("intro", {}, [seq(
      par(
        tween("hero", { opacity: 1 }, { duration: 0.6, ease: "easeOutQuad" }),
        tween("hero-matte", { scale: 1 }, { duration: 0.7, ease: "easeOutBack" }),
      ),
      par(
        tween("hero-tagwrap", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" }),
        tween("hero-tagwrap", { y: 680 }, { duration: 0.5, ease: "easeOutBack" }),
      ),
      wait(1.6, "intro-hold"),
      par(
        tween("hero", { opacity: 0 }, { duration: 0.45, ease: "easeInQuad" }),
        tween("hero", { y: 380 }, { duration: 0.45, ease: "easeInQuad" }),
        tween("hero-tagwrap", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      ),
    )]),

    // ════ CH2 — SCENE IS DATA → KINETIC TYPE ════════════════════
    beat("ch2", {}, [seq(
      hin("h2"),
      tween("code", { opacity: 1 }, { duration: 0.35, ease: "easeOutQuad" }),
      par(
        ...codeLines.map((_, i) => seq(
          wait(i * 0.1),
          par(
            tween(`code-l${i}`, { opacity: 1 }, { duration: 0.16 }),
            tween(`code-l${i}`, { width: codeLineW[i] }, { duration: 0.36, ease: "easeOutCubic" }),
          ),
        )),
      ),
      wait(0.5, "code-hold"),
      tween("code", { opacity: 0, scale: 0.92 }, { duration: 0.35, ease: "easeInQuad" }),
      textIn("cascade", KT, { label: "kt-in" }),
      wait(1.2, "kt-hold"),
      textOut("dissolve", KT, { label: "kt-out", seed: 4 }),
      hout("h2"),
    )]),

    // ════ CH3 — MOTION VOCABULARY ═══════════════════════════════
    beat("ch3", {}, [seq(
      par(hin("h3"), tween("h3sub", { opacity: 1, y: HY + 46 }, { duration: 0.5, ease: "easeOutQuad" })),
      par(tween("orbit", { opacity: 1 }, { duration: 0.4 }), ...ezPills.map((_, i) => i % 2 === 0 ? tween(EASES[i / 2].id, { opacity: 1 }, { duration: 0.3 }) : tween(`${EASES[(i - 1) / 2].id}-cap`, { opacity: 1 }, { duration: 0.3 }))),
      // each pill drops with a different ease, captions fade in — "label", at "drop-N"
      par(
        ...EASES.map((e, i) => seq(
          wait(i * 0.12, `drop-${i}`),
          tween(e.id, { y: 600 }, { duration: 0.95, ease: e.ease as any }),
        )),
        // the orbit dot circles the hub
        motionPath("orbit-dot", [[150, 0], [0, 150], [-150, 0], [0, -150]], { duration: 1.9, closed: true, label: "orbit-run" }),
      ),
      wait(0.7, "vocab-hold"),
      par(
        tween("orbit", { opacity: 0 }, { duration: 0.4 }),
        ...EASES.map((e) => tween(e.id, { opacity: 0 }, { duration: 0.35 })),
        ...EASES.map((e) => tween(`${e.id}-cap`, { opacity: 0 }, { duration: 0.35 })),
      ),
      par(hout("h3"), tween("h3sub", { opacity: 0 }, { duration: 0.3 })),
    )]),

    // ════ CH4 — CHARACTER RIG ═══════════════════════════════════
    beat("ch4", {}, [seq(
      hin("h4"),
      par(
        tween("guy", { opacity: 1 }, { duration: 0.4 }),
        tween("bot", { opacity: 1 }, { duration: 0.4 }),
      ),
      par(
        seq(
          characterPreset("walk", { target: "guy", at: [640, 660], cycles: 2, travel: 120, label: "guy-walk" }),
          characterPreset("wave", { target: "guy", at: [760, 660], label: "guy-wave" }),
        ),
        characterPreset("jump", { target: "bot", at: [1300, 660], label: "bot-jump" }),
      ),
      characterPreset("cheer", { target: "bot", at: [1300, 660], label: "bot-cheer" }),
      wait(0.3, "char-hold"),
      par(
        tween("guy", { opacity: 0 }, { duration: 0.4 }),
        tween("bot", { opacity: 0 }, { duration: 0.4 }),
      ),
      hout("h4"),
    )]),

    // ════ CH5 — REAL DEPTH (perspective + camera + rack focus) ═══
    beat("ch5", {}, [seq(
      par(hin("h5"), tween("h5sub", { opacity: 1, y: HY + 46 }, { duration: 0.5, ease: "easeOutQuad" })),
      par(
        tween("phone", { opacity: 1, scale: 1 }, { duration: 0.55, ease: "easeOutBack", label: "phone-in" }),
        seq(wait(0.2), tween("card-near", { opacity: 1 }, { duration: 0.4 })),
        seq(wait(0.3), tween("card-far", { opacity: 1 }, { duration: 0.4 })),
        seq(wait(0.4), par(tween("glassnav", { opacity: 1 }, { duration: 0.4 }), tween("glassnav", { y: 840 }, { duration: 0.45, ease: "easeOutBack" }))),
      ),
      // camera push in
      cameraTo({ x: W / 2, y: 600, zoom: 1.12 }, { duration: 0.9, ease: "easeInOutCubic", label: "push-in" }),
      // RACK FOCUS: pull focus back to the far card, then return to the phone
      tween("camera", { focus: 420 }, { duration: 0.7, ease: "easeInOutCubic", label: "rack-far" }),
      wait(0.4, "rack-hold"),
      tween("camera", { focus: 0 }, { duration: 0.7, ease: "easeInOutCubic", label: "rack-back" }),
      par(
        cameraTo({ x: W / 2, y: H / 2, zoom: 1 }, { duration: 0.6, ease: "easeInOutCubic" }),
        tween("phone", { opacity: 0 }, { duration: 0.45 }),
        tween("card-near", { opacity: 0 }, { duration: 0.4 }),
        tween("card-far", { opacity: 0 }, { duration: 0.4 }),
        tween("glassnav", { opacity: 0 }, { duration: 0.4 }),
      ),
      par(hout("h5"), tween("h5sub", { opacity: 0 }, { duration: 0.3 })),
    )]),

    // ════ CH6 — DATA-DRIVEN + BATCH ═════════════════════════════
    beat("ch6", {}, [seq(
      par(hin("h6"), tween("h6sub", { opacity: 1, y: HY + 46 }, { duration: 0.5, ease: "easeOutQuad" })),
      tween("chart", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
      par(
        ...CHART_VALUES.map((v, i) => seq(
          wait(i * 0.12, `bar-${i}-cue`),
          par(
            tween(`bar-${i}`, { height: (v / CHART_MAX) * INNER_H }, { duration: 0.65, ease: "easeOutCubic" }),
            tween(`val-${i}`, { opacity: 1 }, { duration: 0.3 }),
            tween(`val-${i}`, { content: v }, { duration: 0.65, ease: "easeOutCubic" }),
          ),
        )),
      ),
      wait(1.0, "chart-hold"),
      tween("chart", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      par(hout("h6"), tween("h6sub", { opacity: 0 }, { duration: 0.3 })),
    )]),

    // ════ CH7 — THE DIFFERENTIATOR: generate → edit → survive → identical ═══
    beat("ch7", {}, [seq(
      // (a) AI WRITES THE BASE — poster assembles from scatter
      hin("h7"),
      tween("poster", { opacity: 1 }, { duration: 0.3 }),
      stagger(0.08,
        tween("po-bar", { opacity: 1 }, { duration: 0.3, ease: "easeOutBack" }),
        tween("po-title", { opacity: 1 }, { duration: 0.3 }),
        tween("po-b1", { opacity: 1 }, { duration: 0.3 }),
        tween("po-b2", { opacity: 1 }, { duration: 0.3 }),
        tween("po-b3", { opacity: 1 }, { duration: 0.3 }),
        tween("po-dot", { opacity: 1 }, { duration: 0.3, ease: "easeOutBack" }),
      ),
      wait(0.5, "gen-hold"),

      // (b) YOU EDIT — cursor flies to the dot, clicks, accent recolors + overlay chip
      tween("h7", { opacity: 0 }, { duration: 0.25 }),
      tween("cur", { opacity: 1 }, { duration: 0.2 }),
      cursorTo("cur", [1500, 980], [W / 2 + 300, 580 - 150], { duration: 0.7, label: "cur-move" }),
      par(
        cursorClick("cur", { label: "edit-click" }),
        seq(
          tween("po-dot", { fill: TEAL }, { duration: 0.4, ease: "easeOutCubic", label: "edit-apply" }),
          // store the edit visually: glow + ring + overlay chip
        ),
      ),
      par(
        tween("po-dot", { shadowColor: TEAL, shadowBlur: 30 }, { duration: 0.3 }),
        tween("ochip", { opacity: 1, scale: 1 }, { duration: 0.4, ease: "easeOutBack" }),
      ),
      wait(0.6, "edit-hold"),

      // (c) AI REGENERATES the base — layout reshuffles, but the edit (teal dot) survives
      tween("h7", { content: "YOU EDIT. IT STICKS.", opacity: 1 }, { duration: 0.3, label: "h7-edit" }),
      par(
        tween("po-bar", { width: 200, fill: PINK }, { duration: 0.5, ease: "easeInOutCubic", label: "regen" }),
        tween("po-title", { y: -86 }, { duration: 0.5, ease: "easeInOutCubic" }),
        tween("po-b1", { width: 380 }, { duration: 0.5, ease: "easeInOutCubic" }),
        tween("po-b2", { width: 500 }, { duration: 0.5, ease: "easeInOutCubic" }),
        tween("po-b3", { width: 300 }, { duration: 0.5, ease: "easeInOutCubic" }),
        // the dot KEEPS teal — pulse a ring to call it out
        seq(
          tween("po-ring", { opacity: 1, scale: 1.6 }, { duration: 0.4, ease: "easeOutCubic" }),
          tween("po-ring", { opacity: 0 }, { duration: 0.4 }),
        ),
      ),
      tween("h7", { content: "YOUR EDIT SURVIVES REGEN" }, { duration: 0.01, label: "h7-survive" }),
      wait(0.9, "survive-hold"),

      // (d) RENDERS IDENTICAL — determinism stamp
      tween("h7", { content: "DETERMINISTIC", opacity: 1 }, { duration: 0.01, label: "h7-det" }),
      par(
        tween("stamp", { opacity: 1 }, { duration: 0.4, ease: "easeOutBack" }),
        tween("stamp", { y: 860 }, { duration: 0.45, ease: "easeOutBack" }),
        tween("cur", { opacity: 0 }, { duration: 0.3 }),
        tween("ochip", { opacity: 0 }, { duration: 0.3 }),
      ),
      wait(1.0, "det-hold"),

      // clear to the outro
      par(
        tween("poster", { opacity: 0 }, { duration: 0.45, ease: "easeInQuad" }),
        tween("stamp", { opacity: 0 }, { duration: 0.4 }),
        hout("h7"),
      ),
    )]),

    // ════ OUTRO — hero resolve ══════════════════════════════════
    beat("outro", {}, [seq(
      par(
        tween("hero", { opacity: 1, y: 470 }, { duration: 0.6, ease: "easeOutBack", label: "resolve" }),
        tween("hero-matte", { scale: 1 }, { duration: 0.01 }),
        seq(wait(0.2), par(
          tween("hero-tagwrap", { opacity: 1, y: 700 }, { duration: 0.5 }),
        )),
      ),
      wait(1.6, "end-hold"),
      par(
        tween("hero", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }),
        tween("hero-tagwrap", { opacity: 0 }, { duration: 0.5 }),
      ),
    )]),
  ),

  behaviors: [
    // kinetic-type wave during its hold (window confirmed via `labels`)
    ...textLoop("wave", KT, { from: 6.4, until: 7.55, amplitude: 10, frequency: 1.7 }),
    // hero breathing
    oscillate("hero-matte", "scale", { amplitude: 0.01, frequency: 0.7 }),
    // glow orbs drift
    oscillate("hero-o1", "x", { amplitude: 24, frequency: 0.35 }),
    oscillate("hero-o2", "x", { amplitude: -28, frequency: 0.3 }),
  ],

  audio: {
    // the motion scores its own foley (whooshes on fast moves, thuds on settles,
    // pops on scale-ins) — deterministic + retime-safe. Manual cues layer on top.
    autoFoley: { gain: 0.4, maxCues: 30, sensitivity: 0.6 },
    bgm: { synth: "uplift", gain: 0.22, fadeIn: 1.2, fadeOut: 2.4, duck: { depth: 0.4 } },
    cues: [
      { at: "intro", offset: 0.1, sfx: "rise", gain: 0.6 },
      { at: "intro-hold", sfx: "shimmer", gain: 0.45 },
      { at: "kt-in", sfx: "swoosh", gain: 0.5 },
      { at: "orbit-run", sfx: "warp", gain: 0.4, pan: 0.4 },
      { at: "guy-wave", sfx: "blip", gain: 0.4, pan: -0.3 },
      { at: "bot-jump", sfx: "boom", gain: 0.45, pan: 0.3 },
      { at: "phone-in", sfx: "select", gain: 0.45 },
      { at: "rack-far", sfx: "tick", gain: 0.4 },
      { at: "bar-3-cue", sfx: "ding", gain: 0.55 },
      { at: "edit-click", sfx: "click", gain: 0.6 },
      { at: "edit-apply", sfx: "select", gain: 0.5 },
      { at: "regen", sfx: "warp", gain: 0.5 },
      { at: "h7-det", sfx: "success", gain: 0.55 },
      { at: "det-hold", sfx: "sparkle", gain: 0.5 },
      { at: "resolve", sfx: "rise", gain: 0.6 },
      { at: "end-hold", sfx: "chime", gain: 0.6 },
    ],
  },
});
