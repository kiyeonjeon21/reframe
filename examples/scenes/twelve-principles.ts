/**
 * twelve-principles — the 12 principles of animation (Thomas & Johnston, "The
 * Illusion of Life"), each demonstrated live and mapped to its web-motion use.
 * An educational showcase: the principles whose difference only reads in MOTION
 * (slow in/out, arc, timing) are shown wrong-vs-right side by side; the rest are
 * a single polished demo. House style, deterministic, one data file.
 *   pnpm reframe render examples/scenes/twelve-principles.ts -o out/twelve-principles.mp4
 */
import {
  scene, seq, par, stagger, wait, tween, motionPath,
  rect, ellipse, text, path, group, title,
  linearGradient, radialGradient, textWidth, type FontWeight,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", FG = "#EAF0FF", MUTED = "#7C859B";
const ACCENT = "#FF4D00", SECOND = "#00C2A8";
const BLUE = "#6EA8FF", VIOLET = "#8C7BFF", GOLD = "#FFC861", PINK = "#FF8FB0", TEAL = "#54D6C0";
const TRK = "#1E2637"; // track / ground line
const FW6: FontWeight = 400, FW7: FontWeight = 700, FW8: FontWeight = 800;

// largest size <= ideal whose rendered width fits maxW (textWidth is linear in size)
const fit = (t: string, w: FontWeight, maxW: number, ideal: number) =>
  ideal * Math.min(1, maxW / textWidth(t, ideal, w));

// ---- left rail: number + name + one-line descriptor (+ "core web" marker) ----
const RAILX = 120, RAILW = 560;
type P = { n: string; name: string; desc: string; web: string; key?: boolean };
const PRINCIPLES: P[] = [
  { n: "01", name: "Squash & Stretch", desc: "flex and stretch, but keep the volume", web: "button press, loaders (keep it subtle)" },
  { n: "02", name: "Anticipation", desc: "wind up before the main action", web: "dip a modal before it opens" },
  { n: "03", name: "Staging", desc: "one idea, one focus", web: "animate one thing; guide the eye", key: true },
  { n: "04", name: "Straight Ahead & Pose to Pose", desc: "draw in order, or key poses then fill", web: "keyframes + easing is tweening" },
  { n: "05", name: "Follow Through & Overlapping", desc: "parts drag, overlap, then settle late", web: "stagger children 40–120ms", key: true },
  { n: "06", name: "Slow In & Slow Out", desc: "nothing moves at a constant speed", web: "ease-out to enter, ease-in to exit", key: true },
  { n: "07", name: "Arc", desc: "natural motion travels in curves", web: "curved paths over straight tweens" },
  { n: "08", name: "Secondary Action", desc: "supporting motion, never distracting", web: "shadow / color shift with the move" },
  { n: "09", name: "Timing", desc: "frames are weight: heavy is slow", web: "200–500ms; heavier = longer", key: true },
  { n: "10", name: "Exaggeration", desc: "push past real to read the intent", web: "success pops, delete whooshes" },
  { n: "11", name: "Solid Drawing", desc: "volume, weight, dimension", web: "depth via 3D, shadow, perspective" },
  { n: "12", name: "Appeal", desc: "the sum, refined and worth watching", web: "polished, purposeful, delightful" },
];

const chromeIds = (k: number, key?: boolean) =>
  [`n${k}`, `nm${k}`, `ds${k}`, `wb${k}`, ...(key ? [`kb${k}`] : [])];

const chromeNodes = PRINCIPLES.flatMap((p, i) => {
  const k = i + 1;
  return [
    text({ id: `n${k}`, x: RAILX, y: 316, content: p.n, fontFamily: "Inter", fontSize: 132, fontWeight: FW8, fill: ACCENT, anchor: "center-left", opacity: 0 }),
    text({ id: `nm${k}`, x: RAILX, y: 466, content: p.name, fontFamily: "Inter", fontSize: fit(p.name, FW8, RAILW, 56), fontWeight: FW8, fill: FG, anchor: "center-left", opacity: 0 }),
    text({ id: `ds${k}`, x: RAILX, y: 542, content: p.desc, fontFamily: "Inter", fontSize: fit(p.desc, FW6, RAILW, 28), fontWeight: FW6, fill: MUTED, anchor: "center-left", opacity: 0 }),
    text({ id: `wb${k}`, x: RAILX, y: 594, content: `web  →  ${p.web}`, fontFamily: "Inter", fontSize: fit(`web  →  ${p.web}`, FW7, RAILW, 22), fontWeight: FW7, fill: "#5E6B86", anchor: "center-left", opacity: 0 }),
    ...(p.key ? [text({ id: `kb${k}`, x: RAILX, y: 646, content: "● core on the web", fontFamily: "Inter", fontSize: 20, fontWeight: FW7, fill: SECOND, letterSpacing: 2, anchor: "center-left", opacity: 0 })] : []),
  ];
});

// ---- fade helpers (opacity only; first tween can carry a label for an sfx cue) ----
const fadeIn = (ids: string[], d = 0.4, label?: string) =>
  par(...ids.map((id, i) => tween(id, { opacity: 1 }, i === 0 && label ? { duration: d, ease: "easeOutCubic", label } : { duration: d, ease: "easeOutCubic" })));
const fadeOut = (ids: string[], d = 0.4) =>
  par(...ids.map((id) => tween(id, { opacity: 0 }, { duration: d, ease: "easeInQuad" })));

// ============================ intro / outro ============================
const introHead = title({ text: "THE 12 PRINCIPLES", id: "intro", x: 960, y: 452, fontSize: 96, fontWeight: 800, fill: FG, entrance: "rise", seed: 3 });
const outroHead = title({ text: "THE ILLUSION OF LIFE", id: "outro", x: 960, y: 470, fontSize: 84, fontWeight: 800, fill: FG, entrance: "rise", seed: 5 });

// stage center for the demos (right ~60% of the frame)
const SX = 1240, SY = 560;

export default scene({
  id: "twelve-principles",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: W / 2, y: H / 2, perspective: 1400 }, // z:0 everywhere except the seg-11 flip → other beats unchanged
  nodes: [
    // intro / outro
    ...introHead.nodes,
    text({ id: "isub", x: 960, y: 560, content: "OF ANIMATION", fontFamily: "Inter", fontSize: 54, fontWeight: FW8, fill: ACCENT, letterSpacing: 6, anchor: "center", opacity: 0 }),
    text({ id: "isub2", x: 960, y: 646, content: "Disney's rules of motion, demonstrated in code", fontFamily: "Inter", fontSize: 28, fontWeight: FW6, fill: MUTED, anchor: "center", opacity: 0 }),
    ...outroHead.nodes,
    text({ id: "ocredit", x: 960, y: 556, content: "Ollie Johnston & Frank Thomas · 1981", fontFamily: "Inter", fontSize: 26, fontWeight: 600, fill: "#5E6B86", anchor: "center", opacity: 0 }),
    text({ id: "osub", x: 960, y: 612, content: "12 principles · one deterministic render", fontFamily: "Inter", fontSize: 32, fontWeight: 600, fill: MUTED, anchor: "center", opacity: 0 }),
    text({ id: "onpx", x: 960, y: 684, content: "npx reframe-video", fontFamily: "Inter", fontSize: 30, fontWeight: FW7, fill: ACCENT, letterSpacing: 2, anchor: "center", opacity: 0 }),

    // left-rail chrome for all 12
    ...chromeNodes,

    // 01 squash & stretch
    rect({ id: "d1-ground", x: 900, y: 772, width: 680, height: 6, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    ellipse({ id: "d1-ball", x: SX, y: 420, width: 132, height: 132, anchor: "bottom-center", fill: linearGradient([PINK, "#B23A6B"], { angle: 90 }), opacity: 0 }),

    // 02 anticipation
    rect({ id: "d2-floor", x: 900, y: 724, width: 680, height: 6, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    rect({ id: "d2-box", x: 1010, y: 724, width: 128, height: 128, radius: 20, anchor: "bottom-center", fill: linearGradient([BLUE, "#2B4E9E"], { angle: 90 }), opacity: 0 }),

    // 03 staging
    ...[0, 1, 2, 3, 4].map((i) =>
      ellipse({ id: `d3-${i}`, x: 940 + i * 150, y: 560, width: 104, height: 104, anchor: "center", fill: i === 2 ? linearGradient([ACCENT, "#B23600"], { angle: 90 }) : "#39435A", ...(i === 2 ? { shadowColor: ACCENT, shadowBlur: 0 } : {}), opacity: 0 })),

    // 04 straight ahead (top row, dots drawn in order) + pose to pose (bottom row)
    text({ id: "d4-ls", x: 1250, y: 356, content: "straight ahead · drawn in order", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: BLUE, anchor: "center", opacity: 0 }),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
      ellipse({ id: `d4s-${i}`, x: 880 + i * 106, y: 452 + [0, -34, 22, -28, 16, -24, 30, -6][i]!, width: 46, height: 46, anchor: "center", fill: BLUE, opacity: 0, scale: 0.4 })),
    ellipse({ id: "d4-a", x: 940, y: 692, width: 118, height: 118, anchor: "center", fill: "none", stroke: MUTED, strokeWidth: 3, opacity: 0 }),
    ellipse({ id: "d4-b", x: 1560, y: 692, width: 118, height: 118, anchor: "center", fill: "none", stroke: MUTED, strokeWidth: 3, opacity: 0 }),
    ellipse({ id: "d4-m", x: 940, y: 692, width: 118, height: 118, anchor: "center", fill: linearGradient([TEAL, "#1E7D6E"], { angle: 90 }), opacity: 0 }),
    text({ id: "d4-lp", x: 1250, y: 806, content: "pose to pose · keys, then fill between", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: TEAL, anchor: "center", opacity: 0 }),

    // 05 follow through + overlapping + drag: a head with a tapered trailing tail
    ...[3, 2, 1, 0].map((i) => // draw far tail first so the head sits on top
      ellipse({ id: `d5-t${i}`, x: 820 - 98 * (i + 1), y: 560, width: [66, 54, 44, 34][i]!, height: [66, 54, 44, 34][i]!, anchor: "center", fill: ["#7C6BEA", "#665AC0", "#524999", "#403A78"][i]!, opacity: 0 })),
    rect({ id: "d5-head", x: 820, y: 560, width: 150, height: 150, radius: 22, anchor: "center", fill: linearGradient([VIOLET, "#4B3A9E"], { angle: 90 }), opacity: 0 }),

    // 06 slow in / slow out (linear vs eased)
    rect({ id: "d6-trkA", x: 850, y: 470, width: 760, height: 5, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    rect({ id: "d6-trkB", x: 850, y: 650, width: 760, height: 5, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    ellipse({ id: "d6-dotA", x: 850, y: 470, width: 56, height: 56, anchor: "center", fill: MUTED, opacity: 0 }),
    ellipse({ id: "d6-dotB", x: 850, y: 650, width: 56, height: 56, anchor: "center", fill: SECOND, opacity: 0 }),
    text({ id: "d6-lA", x: 1150, y: 428, content: "linear", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: MUTED, anchor: "center", opacity: 0 }),
    text({ id: "d6-lB", x: 1150, y: 608, content: "easeInOutCubic", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: SECOND, anchor: "center", opacity: 0 }),

    // 07 arc (straight vs curve)
    rect({ id: "d7-trk", x: 850, y: 432, width: 760, height: 5, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    path({ id: "d7-arc", x: 0, y: 0, d: "M 850 726 Q 1230 394 1610 726", stroke: SECOND, strokeWidth: 4, fill: "none", progress: 0, opacity: 0 }),
    ellipse({ id: "d7-dotS", x: 850, y: 432, width: 52, height: 52, anchor: "center", fill: MUTED, opacity: 0 }),
    ellipse({ id: "d7-dotA", x: 850, y: 726, width: 52, height: 52, anchor: "center", fill: SECOND, opacity: 0 }),
    text({ id: "d7-lS", x: 1230, y: 392, content: "straight", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: MUTED, anchor: "center", opacity: 0 }),
    text({ id: "d7-lA", x: 1230, y: 792, content: "arc", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: SECOND, anchor: "center", opacity: 0 }),

    // 08 secondary action — "main only" vs "main + secondary" (contrast)
    group({ id: "d8L", x: 1080, y: 640, scale: 0.94, opacity: 0 }, [
      rect({ id: "d8L-card", x: 0, y: 0, width: 300, height: 200, radius: 22, anchor: "center", fill: linearGradient([BLUE, "#26407F"], { angle: 120 }) }),
    ]),
    text({ id: "d8-lL", x: 1080, y: 766, content: "main only", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: MUTED, anchor: "center", opacity: 0 }),
    group({ id: "d8R", x: 1560, y: 640, scale: 0.94, opacity: 0 }, [
      rect({ id: "d8R-card", x: 0, y: 0, width: 300, height: 200, radius: 22, anchor: "center", fill: linearGradient([BLUE, "#26407F"], { angle: 120 }), shadowColor: SECOND, shadowBlur: 0, shadowY: 18 }),
      rect({ id: "d8R-bar", x: 0, y: 62, width: 0, height: 12, radius: 6, anchor: "center", fill: SECOND }),
      ellipse({ id: "d8R-dot", x: -104, y: -58, width: 40, height: 40, anchor: "center", fill: GOLD, scale: 0, opacity: 0 }),
    ]),
    text({ id: "d8-lR", x: 1560, y: 766, content: "main + secondary", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: SECOND, anchor: "center", opacity: 0 }),

    // 09 timing (heavy/slow vs light/fast)
    rect({ id: "d9-trkH", x: 850, y: 462, width: 770, height: 5, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    rect({ id: "d9-trkL", x: 850, y: 662, width: 770, height: 5, radius: 3, anchor: "center-left", fill: TRK, opacity: 0 }),
    ellipse({ id: "d9-heavy", x: 850, y: 462, width: 122, height: 122, anchor: "center", fill: linearGradient([GOLD, "#B8862F"], { angle: 90 }), opacity: 0 }),
    ellipse({ id: "d9-light", x: 850, y: 662, width: 56, height: 56, anchor: "center", fill: linearGradient([PINK, "#B23A6B"], { angle: 90 }), opacity: 0 }),
    text({ id: "d9-lH", x: 1150, y: 388, content: "heavy · slow", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: GOLD, anchor: "center", opacity: 0 }),
    text({ id: "d9-lL", x: 1150, y: 730, content: "light · fast", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: PINK, anchor: "center", opacity: 0 }),

    // 10 exaggeration (checkmark pops with elastic overshoot)
    group({ id: "d10-mark", x: SX, y: 560, scale: 0, opacity: 0 }, [
      ellipse({ id: "d10-circ", x: 0, y: 0, width: 240, height: 240, anchor: "center", fill: linearGradient([SECOND, "#0A5C50"], { angle: 120 }) }),
      path({ id: "d10-check", x: 0, y: 0, d: "M -58 6 L -12 54 L 64 -50", stroke: FG, strokeWidth: 24, fill: "none", progress: 0 }),
    ]),

    // 11 solid drawing — flat disc vs shaded solid sphere (contrast: volume, weight, light)
    ellipse({ id: "d11-flat", x: 1080, y: 540, width: 212, height: 212, anchor: "center", fill: "#566089", opacity: 0 }),
    text({ id: "d11-lL", x: 1080, y: 720, content: "flat", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: MUTED, anchor: "center", opacity: 0 }),
    ellipse({ id: "d11-csh", x: 1560, y: 676, width: 210, height: 40, anchor: "center", fill: "#04050A", blur: 16, opacity: 0 }),
    ellipse({ id: "d11-sph", x: 1560, y: 540, width: 212, height: 212, anchor: "center", fill: radialGradient(["#CDBBFF", "#8C7BFF", "#2E2456"], { cx: 0.36, cy: 0.32, r: 0.72 }), shadowColor: "#05070C", shadowBlur: 34, shadowY: 22, opacity: 0 }),
    ellipse({ id: "d11-hl", x: 1518, y: 502, width: 58, height: 40, anchor: "center", fill: "#FFFFFF", opacity: 0 }),
    text({ id: "d11-lR", x: 1560, y: 720, content: "solid", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: VIOLET, anchor: "center", opacity: 0 }),

    // 12 appeal — bland vs appealing (same shape, but one has personality)
    group({ id: "d12L", x: 1080, y: 600, opacity: 0 }, [
      rect({ id: "d12L-body", x: 0, y: 0, width: 180, height: 180, radius: 28, anchor: "center", fill: "#49516A" }),
    ]),
    text({ id: "d12-lL", x: 1080, y: 730, content: "bland", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: MUTED, anchor: "center", opacity: 0 }),
    group({ id: "d12R", x: 1560, y: 540, scale: 0, rotation: 0, opacity: 0 }, [
      rect({ id: "d12R-body", x: 0, y: 0, width: 180, height: 180, radius: 40, anchor: "center", fill: linearGradient([ACCENT, "#C23A00"], { angle: 120 }), shadowColor: ACCENT, shadowBlur: 30 }),
      ellipse({ id: "d12R-eyeL", x: -38, y: -16, width: 26, height: 32, anchor: "center", fill: "#0A0C14" }),
      ellipse({ id: "d12R-eyeR", x: 38, y: -16, width: 26, height: 32, anchor: "center", fill: "#0A0C14" }),
      path({ id: "d12R-smile", x: 0, y: 0, d: "M -34 28 Q 0 62 34 28", stroke: "#0A0C14", strokeWidth: 9, fill: "none" }),
    ]),
    text({ id: "d12-lR", x: 1560, y: 730, content: "appealing", fontFamily: "Inter", fontSize: 26, fontWeight: FW7, fill: ACCENT, anchor: "center", opacity: 0 }),
  ],

  timeline: seq(
    // ---------- intro ----------
    par(introHead.timeline, seq(wait(0.3), fadeIn(["isub", "isub2"], 0.5, "introGo"))),
    wait(1.5),
    fadeOut(["intro", "isub", "isub2"], 0.5),

    // ---------- 01 squash & stretch ----------
    par(fadeIn(chromeIds(1), 0.4, "p1"), tween("d1-ground", { opacity: 1 }, { duration: 0.4 }), tween("d1-ball", { opacity: 1 }, { duration: 0.3 })),
    tween("d1-ball", { y: 772 }, { duration: 0.5, ease: "easeInQuad", label: "sq-hit" }),
    tween("d1-ball", { scaleX: 1.45, scaleY: 0.55 }, { duration: 0.09, ease: "easeOutQuad" }),
    par(tween("d1-ball", { y: 560 }, { duration: 0.42, ease: "easeOutQuad" }), tween("d1-ball", { scaleX: 0.85, scaleY: 1.2 }, { duration: 0.2, ease: "easeOutQuad" })),
    tween("d1-ball", { scaleX: 1, scaleY: 1 }, { duration: 0.2, ease: "easeInOutQuad" }),
    tween("d1-ball", { y: 772 }, { duration: 0.34, ease: "easeInQuad", label: "sq-hit2" }),
    tween("d1-ball", { scaleX: 1.3, scaleY: 0.7 }, { duration: 0.08, ease: "easeOutQuad" }),
    tween("d1-ball", { scaleX: 1, scaleY: 1 }, { duration: 0.28, ease: "easeOutBack" }),
    wait(0.5),
    par(fadeOut(chromeIds(1)), fadeOut(["d1-ground", "d1-ball"])),

    // ---------- 02 anticipation ----------
    par(fadeIn(chromeIds(2), 0.4, "p2"), tween("d2-floor", { opacity: 1 }, { duration: 0.4 }), tween("d2-box", { opacity: 1 }, { duration: 0.3 })),
    tween("d2-box", { scaleY: 0.6, scaleX: 1.25 }, { duration: 0.36, ease: "easeOutQuad", label: "antic" }),
    wait(0.18),
    par(
      motionPath("d2-box", [[1010, 724], [1240, 470], [1470, 724]], { duration: 0.55, ease: "easeOutQuad", label: "launch" }),
      seq(tween("d2-box", { scaleY: 1.2, scaleX: 0.85 }, { duration: 0.22, ease: "easeOutQuad" }), tween("d2-box", { scaleY: 1, scaleX: 1 }, { duration: 0.18 })),
    ),
    tween("d2-box", { scaleY: 0.72, scaleX: 1.2 }, { duration: 0.08, ease: "easeOutQuad", label: "land2" }),
    tween("d2-box", { scaleY: 1, scaleX: 1 }, { duration: 0.24, ease: "easeOutBack" }),
    wait(0.5),
    par(fadeOut(chromeIds(2)), fadeOut(["d2-floor", "d2-box"])),

    // ---------- 03 staging ----------
    par(fadeIn(chromeIds(3, true), 0.4, "p3"), stagger(0.06, ...[0, 1, 2, 3, 4].map((i) => tween(`d3-${i}`, { opacity: 1 }, { duration: 0.35, ease: "easeOutCubic" })))),
    wait(0.5),
    par(
      ...[0, 1, 3, 4].map((i) => tween(`d3-${i}`, { opacity: 0.16 }, { duration: 0.6, ease: "easeOutCubic" })),
      tween("d3-2", { scale: 1.3 }, { duration: 0.5, ease: "easeOutBack", label: "stage" }),
      tween("d3-2", { shadowColor: ACCENT, shadowBlur: 46 }, { duration: 0.6 }),
    ),
    wait(0.9),
    par(fadeOut(chromeIds(3, true)), ...[0, 1, 2, 3, 4].map((i) => tween(`d3-${i}`, { opacity: 0 }, { duration: 0.4 }))),

    // ---------- 04 straight ahead + pose to pose ----------
    fadeIn(chromeIds(4), 0.4, "p4"),
    // straight ahead: dots appear one-by-one, in order
    par(
      tween("d4-ls", { opacity: 1 }, { duration: 0.4, label: "straight" }),
      stagger(0.11, ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => par(tween(`d4s-${i}`, { opacity: 1 }, { duration: 0.22 }), tween(`d4s-${i}`, { scale: 1 }, { duration: 0.32, ease: "easeOutBack" })))),
    ),
    wait(0.3),
    // pose to pose: keys light up first, then the inbetween eases across
    par(tween("d4-a", { opacity: 1 }, { duration: 0.35 }), tween("d4-b", { opacity: 1 }, { duration: 0.35 }), tween("d4-m", { opacity: 1 }, { duration: 0.35 }), tween("d4-lp", { opacity: 1 }, { duration: 0.4, label: "poses" })),
    wait(0.25),
    tween("d4-m", { x: 1560 }, { duration: 1.0, ease: "easeInOutCubic", label: "interp" }),
    wait(0.5),
    par(fadeOut(chromeIds(4)), fadeOut(["d4-ls", "d4-lp", "d4-a", "d4-b", "d4-m", ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `d4s-${i}`)])),

    // ---------- 05 follow through + overlapping + drag ----------
    par(fadeIn(chromeIds(5, true), 0.4, "p5"), fadeIn(["d5-head", "d5-t0", "d5-t1", "d5-t2", "d5-t3"], 0.4)),
    wait(0.3),
    // head moves and stops; each tail dot DRAGS (starts later) and OVERSHOOTS + settles LATER
    par(
      tween("d5-head", { x: 1300 }, { duration: 0.7, ease: "easeOutCubic", label: "ft-stop" }),
      ...[0, 1, 2, 3].map((i) => seq(wait(0.06 * (i + 1)), tween(`d5-t${i}`, { x: 1300 - 98 * (i + 1) }, { duration: 0.72 + 0.1 * i, ease: "easeOutBack" }))),
    ),
    wait(0.6),
    par(fadeOut(chromeIds(5, true)), fadeOut(["d5-head", "d5-t0", "d5-t1", "d5-t2", "d5-t3"])),

    // ---------- 06 slow in / slow out ----------
    par(fadeIn(chromeIds(6, true), 0.4, "p6"), fadeIn(["d6-trkA", "d6-trkB", "d6-dotA", "d6-dotB", "d6-lA", "d6-lB"], 0.4)),
    par(tween("d6-dotA", { x: 1610 }, { duration: 1.5, ease: "linear", label: "race" }), tween("d6-dotB", { x: 1610 }, { duration: 1.5, ease: "easeInOutCubic" })),
    par(tween("d6-dotA", { x: 850 }, { duration: 0.5, ease: "linear" }), tween("d6-dotB", { x: 850 }, { duration: 0.5, ease: "linear" })),
    par(tween("d6-dotA", { x: 1610 }, { duration: 1.5, ease: "linear" }), tween("d6-dotB", { x: 1610 }, { duration: 1.5, ease: "easeInOutCubic" })),
    wait(0.4),
    par(fadeOut(chromeIds(6, true)), fadeOut(["d6-trkA", "d6-trkB", "d6-dotA", "d6-dotB", "d6-lA", "d6-lB"])),

    // ---------- 07 arc ----------
    par(fadeIn(chromeIds(7), 0.4, "p7"), fadeIn(["d7-trk", "d7-dotS", "d7-dotA", "d7-lS", "d7-lA"], 0.4), tween("d7-arc", { opacity: 1, progress: 1 }, { duration: 0.6, ease: "easeOutQuad" })),
    wait(0.2),
    par(
      tween("d7-dotS", { x: 1610 }, { duration: 1.3, ease: "easeInOutQuad", label: "arc" }),
      motionPath("d7-dotA", [[850, 726], [1230, 560], [1610, 726]], { duration: 1.3, ease: "easeInOutQuad" }),
    ),
    wait(0.5),
    par(fadeOut(chromeIds(7)), fadeOut(["d7-trk", "d7-arc", "d7-dotS", "d7-dotA", "d7-lS", "d7-lA"])),

    // ---------- 08 secondary action ----------
    par(fadeIn(chromeIds(8), 0.4, "p8"), fadeIn(["d8-lL", "d8-lR"], 0.4),
      // both: MAIN = rise + scale in
      tween("d8L", { opacity: 1 }, { duration: 0.4 }), tween("d8L", { y: 540, scale: 1 }, { duration: 0.6, ease: "easeOutBack" }),
      tween("d8R", { opacity: 1 }, { duration: 0.4 }), tween("d8R", { y: 540, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "sec" }),
      // right ADDS secondary: shadow deepens, accent bar grows, badge pops a beat later
      tween("d8R-card", { shadowBlur: 40 }, { duration: 0.8 }),
      seq(wait(0.3), tween("d8R-bar", { width: 200 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.45), par(tween("d8R-dot", { opacity: 1 }, { duration: 0.2 }), tween("d8R-dot", { scale: 1 }, { duration: 0.4, ease: "easeOutBack" }))),
    ),
    wait(1.1),
    par(fadeOut(chromeIds(8)), fadeOut(["d8-lL", "d8-lR"]), tween("d8L", { opacity: 0 }, { duration: 0.4 }), tween("d8R", { opacity: 0 }, { duration: 0.4 })),

    // ---------- 09 timing ----------
    par(fadeIn(chromeIds(9, true), 0.4, "p9"), fadeIn(["d9-trkH", "d9-trkL", "d9-heavy", "d9-light", "d9-lH", "d9-lL"], 0.4)),
    par(
      tween("d9-heavy", { x: 1610 }, { duration: 1.7, ease: "easeInOutCubic", label: "time" }),
      tween("d9-light", { x: 1610 }, { duration: 0.55, ease: "easeOutCubic" }),
    ),
    wait(0.6),
    par(fadeOut(chromeIds(9, true)), fadeOut(["d9-trkH", "d9-trkL", "d9-heavy", "d9-light", "d9-lH", "d9-lL"])),

    // ---------- 10 exaggeration ----------
    fadeIn(chromeIds(10), 0.4, "p10"),
    par(tween("d10-mark", { opacity: 1 }, { duration: 0.15 }), tween("d10-mark", { scale: 1 }, { duration: 0.95, ease: "easeOutElastic", label: "pop10" })),
    seq(wait(0.15), tween("d10-check", { progress: 1 }, { duration: 0.4, ease: "easeOutQuad" })),
    wait(0.8),
    par(fadeOut(chromeIds(10)), tween("d10-mark", { opacity: 0 }, { duration: 0.4 })),

    // ---------- 11 solid drawing ----------
    par(fadeIn(chromeIds(11), 0.4, "p11"), fadeIn(["d11-lL", "d11-lR"], 0.4),
      tween("d11-flat", { opacity: 1 }, { duration: 0.4 }),
      tween("d11-sph", { opacity: 1 }, { duration: 0.4 }), tween("d11-hl", { opacity: 0.55 }, { duration: 0.4 }), tween("d11-csh", { opacity: 0.5 }, { duration: 0.4 }),
    ),
    wait(0.3),
    // both bob under gravity — the solid one reads as a real volume with weight; the flat one stays lifeless
    par(
      tween("d11-flat", { y: 592 }, { duration: 0.5, ease: "easeInQuad", label: "drop11" }),
      tween("d11-sph", { y: 592 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("d11-hl", { y: 554 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("d11-csh", { scaleX: 1.3, opacity: 0.78 }, { duration: 0.5, ease: "easeInQuad" }),
    ),
    par(
      tween("d11-flat", { y: 540 }, { duration: 0.6, ease: "easeOutQuad" }),
      tween("d11-sph", { y: 540 }, { duration: 0.6, ease: "easeOutQuad" }),
      tween("d11-hl", { y: 502 }, { duration: 0.6, ease: "easeOutQuad" }),
      tween("d11-csh", { scaleX: 1, opacity: 0.5 }, { duration: 0.6, ease: "easeOutQuad" }),
    ),
    wait(0.6),
    par(fadeOut(chromeIds(11)), fadeOut(["d11-flat", "d11-lL", "d11-lR", "d11-sph", "d11-hl", "d11-csh"])),

    // ---------- 12 appeal ----------
    par(fadeIn(chromeIds(12), 0.4, "p12"), fadeIn(["d12-lL", "d12-lR"], 0.4)),
    par(
      // BLAND: stiff linear entrance, no character
      seq(tween("d12L", { opacity: 1 }, { duration: 0.25 }), tween("d12L", { y: 540 }, { duration: 0.7, ease: "linear" })),
      // APPEALING: overshoot pop, then a happy squash-bounce and wiggle = personality
      seq(
        par(tween("d12R", { opacity: 1 }, { duration: 0.15 }), tween("d12R", { scale: 1 }, { duration: 0.7, ease: "easeOutBack", label: "appeal" })),
        tween("d12R", { scaleX: 1.12, scaleY: 0.9 }, { duration: 0.14, ease: "easeOutQuad" }),
        tween("d12R", { scaleX: 0.94, scaleY: 1.08 }, { duration: 0.14, ease: "easeInOutQuad" }),
        tween("d12R", { scaleX: 1, scaleY: 1 }, { duration: 0.16, ease: "easeOutBack" }),
        tween("d12R", { rotation: 7 }, { duration: 0.16, ease: "easeInOutQuad" }),
        tween("d12R", { rotation: -5 }, { duration: 0.18, ease: "easeInOutQuad" }),
        tween("d12R", { rotation: 0 }, { duration: 0.16, ease: "easeInOutQuad" }),
      ),
    ),
    wait(0.8),
    par(fadeOut(chromeIds(12)), fadeOut(["d12-lL", "d12-lR"]), tween("d12L", { opacity: 0 }, { duration: 0.4 }), tween("d12R", { opacity: 0 }, { duration: 0.4 })),

    // ---------- outro ----------
    par(outroHead.timeline, seq(wait(0.4, "boom"), fadeIn(["ocredit"], 0.4)), seq(wait(0.7), fadeIn(["osub"], 0.4)), seq(wait(1.1), fadeIn(["onpx"], 0.4))),
    wait(2.4),
  ),

  audio: {
    bgm: { synth: "lofi", gain: 0.18, fadeIn: 1.2, fadeOut: 2.0, duck: { depth: 0.5 } },
    cues: [
      { at: "introGo", sfx: "rise", gain: 0.3 },
      { at: "p1", sfx: "tick", gain: 0.24 }, { at: "sq-hit", sfx: "thud", gain: 0.34 }, { at: "sq-hit2", sfx: "thud", gain: 0.24 },
      { at: "p2", sfx: "tick", gain: 0.24 }, { at: "launch", sfx: "whoosh", gain: 0.34 }, { at: "land2", sfx: "knock", gain: 0.26 },
      { at: "p3", sfx: "pop", gain: 0.26 }, { at: "stage", sfx: "select", gain: 0.3 },
      { at: "p4", sfx: "tick", gain: 0.24 }, { at: "interp", sfx: "swish", gain: 0.24 },
      { at: "p5", sfx: "pop", gain: 0.26 }, { at: "ft-stop", sfx: "knock", gain: 0.28 },
      { at: "p6", sfx: "tick", gain: 0.24 }, { at: "race", sfx: "swoosh", gain: 0.24 },
      { at: "p7", sfx: "pop", gain: 0.26 }, { at: "arc", sfx: "swish", gain: 0.24 },
      { at: "p8", sfx: "tick", gain: 0.24 }, { at: "sec", sfx: "pop", gain: 0.3 },
      { at: "p9", sfx: "pop", gain: 0.26 }, { at: "time", sfx: "sub", gain: 0.3 },
      { at: "p10", sfx: "tick", gain: 0.24 }, { at: "pop10", sfx: "sparkle", gain: 0.34 }, { at: "pop10", offset: 0.1, sfx: "chime", gain: 0.3 },
      { at: "p11", sfx: "tick", gain: 0.24 }, { at: "drop11", sfx: "knock", gain: 0.3 },
      { at: "p12", sfx: "pop", gain: 0.26 }, { at: "appeal", sfx: "sparkle", gain: 0.3 },
      { at: "boom", sfx: "boom", gain: 0.4 },
    ],
  },
});
