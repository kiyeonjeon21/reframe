import {
  scene,
  group,
  ellipse,
  text,
  seq,
  par,
  stagger,
  to,
  tween,
  wait,
  oscillate,
  type BehaviorIR,
} from "@reframe/core";

// "Bloom" — generative choreography at scale. 300 dots on a golden-angle
// spiral bloom out, breathe as a phase-shifted traveling wave, get washed by
// a radial color ripple, then collapse into a vortex that reveals the title.
//
// The point: all of this is ~120 lines of host TypeScript generating plain
// declarative data. Every one of the 300 dots keeps a stable id — open the
// preview and tweak any single one of them by hand.

const N = 300;
const GOLDEN = (137.508 * Math.PI) / 180;
const CX = 960;
const CY = 470;
const SPREAD = 26;

// host-side color math (build time, not runtime — the IR stays plain data)
const hex = (c: [number, number, number]) =>
  `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const lerp3 = (a: [number, number, number], b: [number, number, number], u: number) =>
  a.map((v, i) => v + (b[i]! - v) * u) as [number, number, number];
const ramp = (stops: [number, number, number][], u: number) => {
  const span = (stops.length - 1) * u;
  const i = Math.min(stops.length - 2, Math.floor(span));
  return hex(lerp3(stops[i]!, stops[i + 1]!, span - i));
};

const WARM: [number, number, number][] = [[255, 209, 102], [255, 77, 0], [200, 29, 94]];
const COOL: [number, number, number][] = [[126, 224, 255], [91, 140, 255], [124, 92, 255]];

const dots = Array.from({ length: N }, (_, i) => {
  const r = SPREAD * Math.sqrt(i + 0.6);
  const theta = i * GOLDEN;
  return {
    id: `dot-${i}`,
    x: Math.cos(theta) * r,
    y: Math.sin(theta) * r,
    r,
    size: 5 + (i / N) * 13,
    warm: ramp(WARM, i / N),
    cool: ramp(COOL, i / N),
  };
});

const LETTERS = [..."reframe"];
// Inter ExtraBold advance widths at 120px (approx) — fixed advances collide
// on the wide "m". Centers computed cumulatively with a little tracking.
const GLYPH_W: Record<string, number> = { r: 52, e: 70, f: 48, a: 70, m: 108 };
const TRACK = 6;
const advances = LETTERS.map((ch) => (GLYPH_W[ch] ?? 70) + TRACK);
const totalW = advances.reduce((a, b) => a + b, 0) - TRACK;
const letterX = (i: number) => {
  const before = advances.slice(0, i).reduce((a, b) => a + b, 0);
  return CX - totalW / 2 + before + (advances[i]! - TRACK) / 2;
};

export default scene({
  id: "bloom",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#07080C",
  nodes: [
    group({ id: "field", x: CX, y: CY }, [
      ...dots.map((d) =>
        ellipse({
          id: d.id,
          x: d.x,
          y: d.y,
          width: d.size,
          height: d.size,
          anchor: "center",
          fill: d.warm,
          opacity: 0,
          scale: 0,
        }),
      ),
    ]),
    ...LETTERS.map((ch, i) =>
      text({
        id: `lt-${i}`,
        x: letterX(i),
        y: 492, // enters from below with an overshoot
        anchor: "center",
        content: ch,
        fontFamily: "Inter",
        fontSize: 120,
        fontWeight: 800,
        fill: "#FFFFFF",
        opacity: 0,
      }),
    ),
    text({
      id: "caption",
      x: CX,
      y: 590,
      anchor: "center",
      content: "300 nodes · one declarative scene · every dot still addressable",
      fontFamily: "Inter",
      fontSize: 24,
      fill: "#8B93A7",
      opacity: 0,
    }),
  ],

  // States are generated data too: 300-entry sparse overrides, synthesized
  // into motion by to() with a radial stagger (declaration order = radius).
  states: {
    bloomed: Object.fromEntries(dots.map((d) => [d.id, { scale: 1, opacity: 1 }])),
    cooled: Object.fromEntries(dots.map((d) => [d.id, { fill: d.cool }])),
  },

  timeline: seq(
    wait(0.3),
    // 1 — bloom: 300 dots pop outward, 6ms apart along the spiral
    to("bloomed", { duration: 0.8, ease: "easeOutExpo", stagger: 0.006, label: "bloom" }),
    // 2 — breathe (the traveling wave lives in behaviors below)
    wait(1.6, "breathe"),
    // 3 — chromatic ripple washes outward
    to("cooled", { duration: 0.5, ease: "easeInOutCubic", stagger: 0.005, label: "ripple" }),
    wait(1.4, "hold"),
    // 4 — vortex collapse: every dot spirals into the center
    par(
      tween("field", { rotation: 70, scale: 0.9 }, { duration: 1.6, ease: "easeInCubic", label: "vortex" }),
      stagger(
        0.002,
        ...dots.map((d) =>
          par(
            tween(d.id, { x: 0, y: 0 }, { duration: 0.9, ease: "easeInCubic" }),
            tween(d.id, { opacity: 0, scale: 0.4 }, { duration: 0.9, ease: "easeInQuad" }),
          ),
        ),
      ),
    ),
    // 5 — title: letters surf in on a wave
    par(
      stagger(
        0.07,
        ...LETTERS.map((_, i) =>
          par(
            tween(`lt-${i}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
            seq(
              tween(`lt-${i}`, { y: 458 }, { duration: 0.28, ease: "easeOutCubic" }),
              tween(`lt-${i}`, { y: 470 }, { duration: 0.22, ease: "easeInOutQuad" }),
            ),
          ),
        ),
      ),
      seq(wait(0.6), tween("caption", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" })),
    ),
    wait(1.8, "final-hold"),
    par(
      ...LETTERS.map((_, i) => tween(`lt-${i}`, { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" })),
      tween("caption", { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // breathing traveling wave: every dot pulses, phase-shifted by radius so
    // the swell rolls outward through the field
    ...dots.map(
      (d): BehaviorIR =>
        oscillate(
          d.id,
          "scale",
          { amplitude: 0.16, frequency: 0.55, phase: -d.r * 0.012 },
          { from: 2.2, until: 6.4, ramp: 0.5 },
        ),
    ),
    // the title letters keep a gentle standing wave while they hold
    ...LETTERS.map(
      (_, i): BehaviorIR =>
        oscillate(`lt-${i}`, "y", { amplitude: 4, frequency: 0.7, phase: i * 0.7 }, { from: 9.2, until: 11.6, ramp: 0.4 }),
    ),
  ],
});
