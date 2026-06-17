// "Leaving Earth" — a continuous powers-of-ten zoom-out from a single point on
// the ground, up through the atmosphere and past orbital milestones, with a live
// altitude (km) readout climbing the whole way. The trick: ONE stage group scales
// down about the city pivot (fixed at screen centre) through exponential segments;
// a fixed starfield is revealed as Earth shrinks; the counter + callouts sync to
// the zoom. Pure primitives, deterministic.

import {
  scene, group, rect, text, path, ellipse, line,
  seq, par, tween, wait, oscillate,
} from "@reframe/core";
import { LAND_PATHS } from "./lib/world-earth.js";

const W = 1920, H = 1080, CX = W / 2, CY = 540;
const OCEAN = "#16447E", LAND = "#3E7A52", LAND2 = "#5C8B4A";
const ATMO = "#2E6BC0", WHITE = "#FFFFFF", HUD = "#8FB4E8", DIM = "#5C6B86";

const EARTH_R = 760;               // stage-local Earth radius
const EC: [number, number] = [0, 0]; // top-down: Earth centre = city = pivot at screen centre
const ringR = (km: number) => EARTH_R + km * (EARTH_R / 6371); // orbit radius for an altitude

// deterministic stars (fixed layer; revealed as Earth shrinks)
const rng = (s: number) => () => { let t = (s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sr = rng(42);
const stars = Array.from({ length: 160 }, (_, i) =>
  ellipse({ id: `star-${i}`, x: sr() * W, y: sr() * H, width: sr() * 2.2 + 0.5, height: sr() * 2.2 + 0.5, fill: WHITE, opacity: sr() * 0.5 + 0.2, anchor: "center" }),
);
const ce = (id: string, cx: number, cy: number, r: number, fill: string, opacity = 1) =>
  ellipse({ id, x: cx, y: cy, width: r * 2, height: r * 2, fill, opacity, anchor: "center" });

// a labelled orbit ring (stroke circle at an altitude)
const orbit = (id: string, km: number, col: string) =>
  ellipse({ id, x: EC[0], y: EC[1], width: ringR(km) * 2, height: ringR(km) * 2, fill: "none", stroke: col, strokeWidth: 2.5, opacity: 0.0, anchor: "center" });

// an aerial city block grid on the land around the pin (coast runs ~+7 below origin,
// so the city stays above it). Tiny in stage units → vanishes once Earth shrinks.
const crng = rng(7);
const SHADES = ["#C7CDBC", "#B9C0AE", "#D2D7C8", "#AEB6A2", "#CBD0C0"];
const blocks: ReturnType<typeof rect>[] = [];
// the shore here runs along the lower-right; keep the blocks on the land (above origin)
for (const cx of [-12, -8, -4, 0, 4, 8]) {
  for (const cy of [-14, -10, -6, -2]) {
    if (crng() < 0.84) {
      const w = 2.3 + crng() * 1.1, h = 2.3 + crng() * 1.1;
      const jx = (crng() - 0.5) * 0.9, jy = (crng() - 0.5) * 0.9;
      blocks.push(rect({ id: `cy-b${cx}_${cy}`, x: cx + jx, y: cy + jy, width: w, height: h, radius: 0.25, fill: SHADES[Math.floor(crng() * SHADES.length)]!, anchor: "center" }));
    }
  }
}

// the city at the pivot (0,0) — sits on the real coastline; a location pin marks it
const city = group({ id: "city", x: 0, y: 0 }, [
  // two paved avenues crossing near the marker, then the building blocks
  rect({ id: "cy-ave-h", x: -3, y: -8, width: 26, height: 0.9, fill: "#5E6759", anchor: "center" }),
  rect({ id: "cy-ave-v", x: 0, y: -8, width: 0.9, height: 16, fill: "#5E6759", anchor: "center" }),
  ...blocks,
  // location pin — tip anchored at the marked point (0,0), bulb rising above it
  path({ id: "pin", d: "M0 0 C-3.4 -5.6 -3.4 -10.5 0 -10.5 C3.4 -10.5 3.4 -5.6 0 0 Z", x: 0, y: 0, fill: "#FF4D4D", originX: 0, originY: 0 }),
  ce("pin-dot", 0, -7.4, 1.3, "#9A1B1B"),
]);

// segments: [targetScale, targetAltKm, duration, calloutTitle?, calloutSub?]
type Seg = [number, number, number, string?, string?];
const SEGS: Seg[] = [
  [12, 8, 1.4],
  [2.2, 100, 1.4, "KÁRMÁN LINE", "100 km · space begins"],
  [0.6, 420, 1.7, "ISS ORBIT", "420 km"],
  [0.16, 3000, 1.4],
  [0.05, 35786, 1.7, "GEOSTATIONARY", "35,786 km"],
  [0.026, 120000, 1.6],
  [0.014, 384400, 2.1, "MOON'S ORBIT", "384,400 km"],
];
const START_SCALE = 48;

// build the zoom timeline + the orbit-ring reveals
const steps: ReturnType<typeof par>[] = [];
let revealedISS = false, revealedGEO = false, revealedMoon = false;
for (const [sc, alt, dur, title, sub] of SEGS) {
  const kids: import("@reframe/core").TimelineIR[] = [
    tween("stage", { scale: sc }, { duration: dur, ease: "linear", label: `to-${alt}` }),
    tween("alt-n", { content: alt }, { duration: dur, ease: "linear" }),
  ];
  // fade orbit rings in as we approach them
  if (alt >= 420 && !revealedISS) { kids.push(tween("o-iss", { opacity: 0.5 }, { duration: dur })); revealedISS = true; }
  if (alt >= 35786 && !revealedGEO) { kids.push(tween("o-geo", { opacity: 0.5 }, { duration: dur })); revealedGEO = true; }
  if (alt >= 384400 && !revealedMoon) { kids.push(tween("o-moon", { opacity: 0.55 }, { duration: dur })); revealedMoon = true; }
  if (title) {
    kids.push(seq(
      tween("cal-t", { content: title, opacity: 0 }, { duration: 0.001 }),
      tween("cal-s", { content: sub!, opacity: 0 }, { duration: 0.001 }),
      par(tween("cal-t", { opacity: 1 }, { duration: 0.4 }), tween("cal-s", { opacity: 1 }, { duration: 0.4 })),
      wait(Math.max(0.3, dur - 1.1)),
      par(tween("cal-t", { opacity: 0 }, { duration: 0.4 }), tween("cal-s", { opacity: 0 }, { duration: 0.4 })),
    ));
  }
  steps.push(par(...kids));
}

export default scene({
  id: "zoom-to-space",
  size: { width: W, height: H },
  fps: 30,
  background: "#04060D",
  nodes: [
    ...stars,

    // the world — one group, scaled about the city pivot at screen centre
    group({ id: "stage", x: CX, y: CY, scale: START_SCALE, anchor: "center" }, [
      // atmosphere halo (faded concentric blue, behind the globe)
      ...Array.from({ length: 7 }, (_, i) => { const t = i / 6; return ce(`atmo-${i}`, EC[0], EC[1], EARTH_R + 8 + t * 70, ATMO, 0.06); }),
      // ocean disc
      ce("ocean", EC[0], EC[1], EARTH_R, OCEAN),
      // land + clouds, clipped to the globe
      group({ id: "surface", x: 0, y: 0, clip: { kind: "ellipse", x: EC[0] - EARTH_R, y: EC[1] - EARTH_R, width: EARTH_R * 2, height: EARTH_R * 2 } }, [
        // real coastlines: Natural Earth land, orthographically projected so the camera
        // centre (the city, origin) sits on the US East Coast (≈ New York) — North America
        // fills the globe, and zooming in lands on that same shoreline. (see lib/world-earth.ts)
        ...LAND_PATHS.map((d, i) => path({ id: `land-${i}`, d, x: 0, y: 0, fill: i === 0 ? LAND : LAND2, originX: 0, originY: 0 })),
        city,
      ]),
      // orbital rings (revealed as we pass them)
      orbit("o-iss", 420, "#7FB0FF"),
      orbit("o-geo", 35786, "#9C7CFF"),
      orbit("o-moon", 384400, "#C9D2E0"),
    ]),

    // HUD — altitude readout (fixed)
    group({ id: "hud", x: 120, y: 840, opacity: 0 }, [
      text({ id: "hud-l", x: 0, y: 0, content: "ALTITUDE FROM SURFACE", fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: HUD, letterSpacing: 3, anchor: "center-left" }),
      text({ id: "alt-n", x: 0, y: 64, content: 0, contentDecimals: 0, contentThousands: true, fontFamily: "Inter", fontSize: 84, fontWeight: 800, fill: WHITE, anchor: "center-left" }),
      text({ id: "alt-u", x: 430, y: 72, content: "km", fontFamily: "Inter", fontSize: 38, fontWeight: 700, fill: HUD, anchor: "center-left" }),
    ]),

    // milestone callout (fixed, reused per milestone)
    group({ id: "cal", x: CX, y: 200 }, [
      text({ id: "cal-t", x: 0, y: 0, content: "", fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: WHITE, letterSpacing: 2, anchor: "center", opacity: 0 }),
      text({ id: "cal-s", x: 0, y: 46, content: "", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: HUD, anchor: "center", opacity: 0 }),
    ]),

    text({ id: "foot", x: CX, y: 1030, content: "every frame a reframe render", fontFamily: "Inter", fontSize: 20, fontWeight: 600, fill: "#46506A", anchor: "center", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.5),
    tween("hud", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    ...steps,
    par(
      tween("cal-t", { content: "YOU WERE HERE", opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
      tween("cal-s", { content: "a pale blue dot, 384,400 km below", opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
      tween("foot", { opacity: 1 }, { duration: 0.6 }),
    ),
    wait(2.2),
  ),

  behaviors: [
    ...stars.map((_, i) => oscillate(`star-${i}`, "opacity", { amplitude: 0.22, frequency: 0.3 + sr() * 0.5, phase: i }, { from: 3 })),
    oscillate("pin", "scale", { amplitude: 0.06, frequency: 1.2 }, { from: 0.5, until: 2.5 }),
  ],

  // an awe-ascent bed: rising whooshes that soften with altitude, a chime at each
  // milestone, a deep bong at the Moon's orbit, a shimmer as we settle on the dot.
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.2, fadeIn: 1.5, fadeOut: 2.5, duck: { depth: 0.22 } },
    cues: [
      { at: "to-8", sfx: "rise", gain: 0.34 },
      { at: "to-8", offset: 0.02, sfx: "whoosh", gain: 0.4 },
      { at: "to-100", sfx: "whoosh", gain: 0.42 },
      { at: "to-100", offset: 0.05, file: "select_001.ogg", gain: 0.34 },   // Kármán line
      { at: "to-420", sfx: "whoosh", gain: 0.4 },
      { at: "to-420", offset: 0.05, file: "pluck_001.ogg", gain: 0.42 },    // ISS orbit
      { at: "to-3000", sfx: "whoosh", gain: 0.34 },
      { at: "to-35786", sfx: "whoosh", gain: 0.32 },
      { at: "to-35786", offset: 0.05, file: "pluck_002.ogg", gain: 0.44 },  // geostationary
      { at: "to-120000", sfx: "whoosh", gain: 0.26 },
      { at: "to-384400", sfx: "rise", gain: 0.34 },
      { at: "to-384400", offset: 0.05, file: "bong_001.ogg", gain: 0.62 },  // Moon's orbit
      { at: "to-384400", offset: 2.1, sfx: "shimmer", gain: 0.44 },          // you were here
      { at: "to-384400", offset: 2.18, file: "confirmation_003.ogg", gain: 0.4 },
    ],
  },
});
