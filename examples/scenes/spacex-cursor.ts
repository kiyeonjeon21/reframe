// "SpaceX acquires Cursor (Anysphere) — $60B all-stock" — a news motion piece
// with the REAL brand logos (SpaceX X+swoosh, Cursor cube — simple-icons paths).
// Hero motion: the Cursor cube SPINS along a curved motionPath and slams into the
// SpaceX mark — a shockwave acquisition. Brand marks are trademarks of their owners.

import {
  scene, group, rect, text, path, ellipse,
  seq, par, stagger, tween, wait,
  motionPath, oscillate,
  splitText, textIn, textOut,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#05060B";
const WHITE = "#FFFFFF", SILVER = "#C9D2E0", MUTED = "#7E8AA8";
const BLUE = "#5B9CFF", GREEN = "#26D07C";
const CX = W / 2, DOCK_Y = 450;

const SPACEX_D = "M24 7.417C8.882 8.287 1.89 14.75.321 16.28L0 16.583h2.797C10.356 9.005 21.222 7.663 24 7.417zm-17.046 6.35c-.472.321-.945.68-1.398 1.02l2.457 1.796h2.778zM2.948 10.8H.189l3.25 2.381c.473-.321 1.02-.661 1.512-.945Z";
const CURSOR_D = "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23";
const ROCKET_D = "M0 -46 C10 -34 14 -16 14 4 L14 24 L7 18 L7 30 L-7 30 L-7 18 L-14 24 L-14 4 C-14 -16 -10 -34 0 -46 Z";

const spxMark = (id: string, x: number, y: number, scale: number, opacity = 1, rotation = 0) =>
  path({ id, d: SPACEX_D, x, y, originX: 12, originY: 12, scale, rotation, fill: WHITE, opacity });
const curCube = (id: string, x: number, y: number, scale: number, opacity = 1, rotation = 0) =>
  path({ id, d: CURSOR_D, x, y, originX: 12, originY: 12, scale, rotation, fill: BLUE, opacity });
const ringNode = (id: string, x: number, y: number, stroke: string) =>
  ellipse({ id, x, y, width: 60, height: 60, fill: "none", stroke, strokeWidth: 6, opacity: 0, scale: 0, anchor: "center" });

const rng = (s: number) => () => { let t = (s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sr = rng(7);
const stars = Array.from({ length: 130 }, (_, i) =>
  ellipse({ id: `star-${i}`, x: sr() * W, y: sr() * H, width: sr() * 2.4 + 0.6, height: sr() * 2.4 + 0.6, fill: WHITE, opacity: sr() * 0.5 + 0.2, anchor: "center" }),
);
const starTwinkle = stars.map((_, i) => oscillate(`star-${i}`, "opacity", { amplitude: 0.25, frequency: 0.3 + sr() * 0.6, phase: i }, { from: 0.5 }));

const HEAD = splitText("SpaceX acquires Cursor", { id: "head", x: CX, y: 470, fontSize: 78, fontWeight: 800, fill: WHITE });

const stat = (id: string, y: number, value: string, label: string, col: string) =>
  group({ id, x: CX - 70, y, opacity: 0 }, [
    text({ id: `${id}-v`, x: -10, y: 0, content: value, fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: col, anchor: "center-right" }),
    text({ id: `${id}-l`, x: 20, y: 0, content: label, fontFamily: "Inter", fontSize: 28, fontWeight: 500, fill: SILVER, anchor: "center-left" }),
  ]);

export default scene({
  id: "spacex-cursor",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    ...stars,
    ellipse({ id: "wash", x: CX, y: 540, width: 1700, height: 1700, fill: "#0B1226", opacity: 0.45, anchor: "center" }),

    group({ id: "tag", x: CX, y: 290, opacity: 0 }, [
      rect({ id: "tag-bg", x: 0, y: 0, width: 168, height: 44, radius: 22, fill: "#E0242B", anchor: "center" }),
      text({ id: "tag-t", x: 0, y: 0, content: "BREAKING", fontFamily: "Inter", fontSize: 22, fontWeight: 800, fill: WHITE, anchor: "center" }),
    ]),
    ...HEAD.nodes,

    group({ id: "spx", x: CX - 300, y: DOCK_Y, opacity: 0 }, [
      spxMark("spx-mark", 0, 0, 0, 1, -360),  // spins + scales in
      text({ id: "spx-word", x: 0, y: 120, content: "SPACEX", fontFamily: "Inter", fontSize: 44, fontWeight: 800, fill: WHITE, letterSpacing: 6, anchor: "center", opacity: 0 }),
    ]),

    curCube("cur-cube", CX + 360, 440, 6, 0),
    text({ id: "cur-word", x: CX + 360, y: 540, content: "Cursor", fontFamily: "Inter", fontSize: 44, fontWeight: 800, fill: BLUE, anchor: "center", opacity: 0 }),

    group({ id: "deal", x: CX, y: 470, opacity: 0, scale: 0.5 }, [
      text({ id: "deal-cur", x: -150, y: 0, content: "$", fontFamily: "Inter", fontSize: 96, fontWeight: 800, fill: GREEN, anchor: "center-right" }),
      text({ id: "deal-n", x: -140, y: 0, content: 0, contentDecimals: 0, fontFamily: "Inter", fontSize: 150, fontWeight: 800, fill: GREEN, anchor: "center-left" }),
      text({ id: "deal-b", x: 64, y: 0, content: "B", fontFamily: "Inter", fontSize: 110, fontWeight: 800, fill: GREEN, anchor: "center-left" }),
    ]),
    text({ id: "deal-sub", x: CX, y: 600, content: "all-stock deal", fontFamily: "Inter", fontSize: 34, fontWeight: 600, fill: MUTED, anchor: "center", opacity: 0 }),

    // rocket with a flickering flame + glow, banked along its arc
    group({ id: "rocket", x: -160, y: 980, opacity: 0 }, [
      ellipse({ id: "rk-flame", x: 0, y: 40, width: 22, height: 50, fill: "#FF8A3A", opacity: 0.9, anchor: "center" }),
      ellipse({ id: "rk-flame2", x: 0, y: 34, width: 12, height: 30, fill: "#FFE08A", anchor: "center" }),
      path({ id: "rk-body", d: ROCKET_D, x: 0, y: 0, fill: SILVER, stroke: "#7E8AA8", strokeWidth: 1.5 }),
    ]),

    // impact fx
    rect({ id: "screenflash", x: 0, y: 0, width: W, height: H, fill: WHITE, opacity: 0 }),
    ellipse({ id: "flash", x: CX, y: DOCK_Y, width: 40, height: 40, fill: BLUE, opacity: 0, scale: 0, anchor: "center" }),
    ringNode("ring1", CX, DOCK_Y, WHITE),
    ringNode("ring2", CX, DOCK_Y, BLUE),

    group({ id: "merge", x: CX, y: DOCK_Y, opacity: 0 }, [
      spxMark("m-spx", -180, 0, 5),
      text({ id: "m-x", x: -10, y: 0, content: "×", fontFamily: "Inter", fontSize: 68, fontWeight: 700, fill: MUTED, anchor: "center" }),
      curCube("m-cur", 150, 0, 4),
    ]),

    stat("st1", 400, "millions of", "users", SILVER),
    stat("st2", 470, "billions in", "run-rate revenue", SILVER),
    stat("st3", 540, "shares +8%", "on the news ↑", GREEN),
    stat("st4", 610, "Colossus", "supercomputer pairing", BLUE),

    text({ id: "foot", x: CX, y: 980, content: "filed with the SEC · all-stock · every frame a reframe render", fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: "#5C6477", anchor: "center", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    tween("tag", { opacity: 1 }, { duration: 0.4, ease: "easeOutBack" }),
    textIn("decode", HEAD, { speed: 1.1, label: "head-in" }),
    wait(1.6),
    par(tween("tag", { opacity: 0 }, { duration: 0.4 }), textOut("dissolve", HEAD, { label: "head-out" })),

    // brands enter — SpaceX mark SPINS + scales in; Cursor cube SPINS along its arc
    par(
      seq(
        tween("spx", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic", label: "spx-in" }),
        par(
          tween("spx-mark", { scale: 7.5, rotation: 0 }, { duration: 0.8, ease: "easeOutBack" }),
          seq(wait(0.4), tween("spx-word", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" })),
        ),
      ),
      seq(
        wait(0.4),
        par(
          tween("cur-cube", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic" }),
          tween("cur-cube", { rotation: 360 }, { duration: 1.0, ease: "easeOutCubic", label: "cur-in" }),
          motionPath("cur-cube", [[CX + 980, 140], [CX + 700, 620], [CX + 360, 440]], { duration: 1.0, ease: "easeOutCubic", curviness: 1.3 }),
        ),
        tween("cur-word", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" }),
      ),
    ),
    wait(1.0),

    // $60B — slams in (scale overshoot), counts up; rocket roars across with a flame
    par(
      tween("spx", { y: 250, scale: 0.6, opacity: 0.5 }, { duration: 0.6, ease: "easeInOutCubic" }),
      tween("cur-cube", { y: 250, scale: 4 }, { duration: 0.6, ease: "easeInOutCubic" }),
      tween("cur-word", { y: 320, opacity: 0.5 }, { duration: 0.6, ease: "easeInOutCubic" }),
      seq(
        par(tween("deal", { opacity: 1, scale: 1.12 }, { duration: 0.3, ease: "easeOutCubic" })),
        tween("deal", { scale: 1 }, { duration: 0.3, ease: "easeOutBack" }),
      ),
      seq(wait(0.3), par(tween("deal-n", { content: 60 }, { duration: 1.1, ease: "easeOutCubic", label: "count" }), tween("deal-sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }))),
    ),
    par(
      motionPath("rocket", [[-160, 980], [CX - 200, 200], [W + 200, 700]], { duration: 1.5, ease: "easeInOutCubic", autoRotate: true, rotateOffset: -90, curviness: 1.2, label: "launch" }),
      seq(tween("rocket", { opacity: 1 }, { duration: 0.2 }), wait(1.1), tween("rocket", { opacity: 0 }, { duration: 0.2 })),
    ),
    wait(0.3),

    // THE ACQUISITION — the Cursor cube spins hard and slams into the SpaceX mark
    par(tween("deal", { opacity: 0, scale: 0.6 }, { duration: 0.5 }), tween("deal-sub", { opacity: 0 }, { duration: 0.4 }), tween("cur-word", { opacity: 0 }, { duration: 0.3 })),
    tween("spx", { x: CX, y: DOCK_Y, scale: 1, opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    par(
      motionPath("cur-cube", [[CX + 380, 250], [CX + 260, 250], [CX, DOCK_Y]], { duration: 0.85, ease: "easeInCubic", curviness: 1.6, label: "acquire" }),
      tween("cur-cube", { rotation: 1080, scale: 2.2 }, { duration: 0.85, ease: "easeInCubic" }),
    ),
    par(
      tween("cur-cube", { scale: 0.2, opacity: 0 }, { duration: 0.25, ease: "easeInQuad", label: "dock" }),
      // screen flash
      seq(tween("screenflash", { opacity: 0.28 }, { duration: 0.04 }), tween("screenflash", { opacity: 0 }, { duration: 0.4, ease: "easeOutQuad" })),
      // blue core flash
      seq(tween("flash", { opacity: 0.9, scale: 1 }, { duration: 0.01 }), par(tween("flash", { scale: 34 }, { duration: 0.5, ease: "easeOutCubic" }), tween("flash", { opacity: 0 }, { duration: 0.5, ease: "easeOutQuad" }))),
      // two shockwave rings
      seq(tween("ring1", { opacity: 0.85, scale: 1 }, { duration: 0.01 }), par(tween("ring1", { scale: 22 }, { duration: 0.6, ease: "easeOutCubic" }), tween("ring1", { opacity: 0 }, { duration: 0.6, ease: "easeOutQuad" }))),
      seq(wait(0.08), tween("ring2", { opacity: 0.7, scale: 1 }, { duration: 0.01 }), par(tween("ring2", { scale: 16 }, { duration: 0.55, ease: "easeOutCubic" }), tween("ring2", { opacity: 0 }, { duration: 0.55, ease: "easeOutQuad" }))),
      // SpaceX mark takes the hit (punch)
      seq(tween("spx-mark", { scale: 9 }, { duration: 0.1, ease: "easeOutQuad" }), tween("spx-mark", { scale: 7.5 }, { duration: 0.35, ease: "easeOutBack" })),
    ),
    // resolve to the merged lockup — the cube spins into place
    par(
      tween("spx", { opacity: 0 }, { duration: 0.3 }),
      seq(tween("m-cur", { rotation: -180, scale: 0 }, { duration: 0.001 }), par(tween("merge", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "merge-in" }), tween("m-cur", { rotation: 0, scale: 4 }, { duration: 0.6, ease: "easeOutBack" }))),
    ),
    wait(0.6),

    // stats slide in + endcard
    tween("merge", { y: 240, scale: 0.72 }, { duration: 0.6, ease: "easeInOutCubic" }),
    stagger(0.18, ...["st1", "st2", "st3", "st4"].map((id) => par(tween(id, { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: `${id}-in` }), tween(id, { x: CX }, { duration: 0.5, ease: "easeOutBack" })))),
    tween("foot", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "foot-in" }),
    wait(2.0),
  ),

  behaviors: [
    ...starTwinkle,
    oscillate("rk-flame", "scaleY", { amplitude: 0.3, frequency: 18 }, { from: 7.5, until: 9.4 }),
    oscillate("rk-flame2", "scaleY", { amplitude: 0.35, frequency: 22 }, { from: 7.5, until: 9.4 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.15, fadeIn: 1.2, fadeOut: 2, duck: { depth: 0.35 } },
    cues: [
      { at: "head-in", sfx: "rise", gain: 0.36 },
      { at: "spx-in", file: "maximize_001.ogg", gain: 0.3 },
      { at: "cur-in", sfx: "whoosh", gain: 0.5 },
      { at: "count", sfx: "rise", gain: 0.4 },
      { at: "count", offset: 1.05, file: "confirmation_002.ogg", gain: 0.5 },
      { at: "count", offset: 1.05, sfx: "pop", gain: 0.28 },
      { at: "launch", sfx: "whoosh", gain: 0.66 },
      { at: "launch", offset: 0.08, sfx: "thud", gain: 0.26 },
      { at: "acquire", sfx: "rise", gain: 0.5 },
      { at: "acquire", offset: 0.4, sfx: "whoosh", gain: 0.58 },
      { at: "dock", file: "bong_001.ogg", gain: 0.82 },
      { at: "dock", sfx: "thud", gain: 0.5 },
      { at: "dock", offset: 0.04, file: "glass_001.ogg", gain: 0.4 },
      { at: "merge-in", file: "confirmation_004.ogg", gain: 0.55 },
      { at: "st1-in", file: "pluck_001.ogg", gain: 0.42 },
      { at: "st2-in", file: "pluck_002.ogg", gain: 0.42 },
      { at: "st3-in", file: "confirmation_001.ogg", gain: 0.5 },
      { at: "st4-in", file: "pluck_001.ogg", gain: 0.42 },
      { at: "foot-in", sfx: "shimmer", gain: 0.42 },
    ],
  },
});
