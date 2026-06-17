import {
  scene, group, ellipse, path, text, seq, par, beat, tween, wait, motionPath, oscillate,
  type NodeIR, type BehaviorIR, type TimelineIR,
} from "@reframe/core";

// "The Solar System" — a ~50s space-documentary cut: a pale blue dot, a pull
// back to eight orbiting planets, a growing Sun, a scale analogy, a million
// Earths, and the eight-minute light. 2.5D flat-design vector: parallax stars,
// draw-on orbits (path progress), planets on true circular orbits (two
// oscillate behaviors each: x=cos, y=sin), a camera = the `system` group's
// scale. Narration is a Kokoro am_michael (American) voiceover in solar-system-vo/.

const W = 1920, H = 1080, CX = 960, CY = 540;
const BG = "#05060B";
const FG = "#FFFFFF";
const MUTED = "#8A93A6";
const SUN_CORE = "#FDB813", SUN_GLOW = "#FF8A00";

const ce = (id: string, x: number, y: number, r: number, fill: string, extra: Record<string, unknown> = {}): NodeIR =>
  ellipse({ id, x, y, anchor: "center", width: r * 2, height: r * 2, fill, ...extra });
const ring = (id: string, R: number, stroke: string, sw = 1.5, extra: Record<string, unknown> = {}): NodeIR =>
  path({ id, x: 0, y: 0, d: `M 0 ${-R} A ${R} ${R} 0 1 1 -0.01 ${-R}`, stroke, strokeWidth: sw, ...extra });
const tx = (id: string, x: number, y: number, s: string, size: number, weight: number, fill: string, anchor: "center" | "center-left" = "center"): NodeIR =>
  text({ id, x, y, anchor, content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

// deterministic PRNG (no Math.random) for star + swarm placement
const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ── parallax starfield ──
const sr = rng(1337);
const STAR_N = 96;
const stars: NodeIR[] = Array.from({ length: STAR_N }, (_, i) =>
  ce(`star-${i}`, sr() * W, sr() * H, sr() * 1.5 + 0.5, FG, { opacity: sr() * 0.5 + 0.35 }),
);
const starTwinkle: BehaviorIR[] = stars
  .filter((_, i) => i % 6 === 0)
  .map((s, k) => oscillate(s.id, "opacity", { amplitude: 0.35, frequency: 0.25 + (k % 5) * 0.08, phase: k }));

// ── planets ──
interface Planet { name: string; R: number; r: number; color: string; freq: number; phase: number }
const PLANETS: Planet[] = [
  { name: "mercury", R: 112, r: 6, color: "#9A8B7A", freq: 0.10, phase: 0.4 },
  { name: "venus", R: 166, r: 10, color: "#E0B06A", freq: 0.075, phase: 2.1 },
  { name: "earth", R: 236, r: 11, color: "#3B82F6", freq: 0.06, phase: 4.0 },
  { name: "mars", R: 306, r: 8, color: "#C1440E", freq: 0.05, phase: 1.0 },
  { name: "jupiter", R: 452, r: 30, color: "#C9A06A", freq: 0.032, phase: 5.0 },
  { name: "saturn", R: 600, r: 25, color: "#E3C98B", freq: 0.026, phase: 3.0 },
  { name: "uranus", R: 720, r: 17, color: "#8FD3E0", freq: 0.02, phase: 0.7 },
  { name: "neptune", R: 830, r: 16, color: "#5B7BDB", freq: 0.017, phase: 2.7 },
];

const orbitRings: NodeIR[] = PLANETS.map((p) => ring(`orbit-${p.name}`, p.R, "#243049", 1.5, { progress: 0 }));
const planetNodes: NodeIR[] = PLANETS.map((p) =>
  group({ id: p.name, x: 0, y: 0 }, [
    ...(p.name === "saturn"
      ? [path({ id: "saturn-ring", x: 0, y: 0, d: `M ${-p.r * 1.9} 0 A ${p.r * 1.9} ${p.r * 0.6} 0 1 1 ${p.r * 1.9} 0 A ${p.r * 1.9} ${p.r * 0.6} 0 1 1 ${-p.r * 1.9} 0`, stroke: "#C9B98B", strokeWidth: 3 })]
      : []),
    ce(`${p.name}-body`, 0, 0, p.r, p.color),
  ]),
);
// two oscillate behaviors per planet → a circular orbit of radius R about the Sun
const orbitBehaviors: BehaviorIR[] = PLANETS.flatMap((p) => [
  oscillate(p.name, "x", { amplitude: p.R, frequency: p.freq, phase: p.phase + Math.PI / 2 }),
  oscillate(p.name, "y", { amplitude: p.R, frequency: p.freq, phase: p.phase }),
]);

// ── the Sun (glow layers + a breathing pulse, inside a grow wrapper) ──
const sun = group({ id: "sun-grow", x: 0, y: 0, scale: 1 }, [
  group({ id: "sun-pulse", x: 0, y: 0 }, [
    ce("sun-glow3", 0, 0, 150, SUN_GLOW, { opacity: 0.1 }),
    ce("sun-glow2", 0, 0, 108, SUN_GLOW, { opacity: 0.18 }),
    ce("sun-glow1", 0, 0, 84, SUN_CORE, { opacity: 0.4 }),
    ce("sun-core", 0, 0, 64, SUN_CORE),
  ]),
]);
const sunPulse: BehaviorIR = oscillate("sun-pulse", "scale", { amplitude: 0.05, frequency: 0.25, phase: 0 });

const system = group({ id: "system", x: CX, y: CY, scale: 1.3, opacity: 0 }, [
  ...orbitRings, sun, ...planetNodes,
]);

// ── beat 1 / 8 · the pale blue dot (a lone Earth) ──
const hero = group({ id: "hero", x: CX, y: CY, scale: 0.7, opacity: 0 }, [
  ce("hero-glow", 0, 0, 120, "#3B82F6", { opacity: 0.12 }),
  ce("hero-earth", 0, 0, 58, "#2B6FE0"),
  ce("hero-land1", -16, -10, 22, "#3FA66A", { opacity: 0.85 }),
  ce("hero-land2", 20, 18, 16, "#3FA66A", { opacity: 0.8 }),
  ce("hero-cloud", 6, -24, 14, FG, { opacity: 0.25 }),
  group({ id: "hero-moon", x: 0, y: 0 }, [ce("moon-body", 112, 0, 10, "#B9BEC9")]),
]);

// ── beat 5 · scale analogy ──
const analogy = group({ id: "analogy", x: CX, y: CY, opacity: 0 }, [
  tx("anly-h", 0, -250, "If the Sun were a basketball…", 38, 800, FG),
  ce("anly-ball", -460, 30, 96, SUN_CORE),
  tx("anly-ball-l", -460, 170, "Sun = basketball", 22, 600, MUTED),
  path({ id: "anly-line", x: 0, y: 30, d: "M -350 0 L 470 0", stroke: "#3A4760", strokeWidth: 2 }),
  ce("anly-pep", 500, 30, 4, "#3B82F6"),
  tx("anly-pep-l", 500, 170, "Earth = peppercorn", 22, 600, MUTED),
  tx("anly-dist", 70, -16, "26 meters apart", 26, 700, "#7CC4FF"),
]);

// ── beat 6 · a million Earths ──
const swr = rng(98765);
const swarm: NodeIR[] = [];
for (let i = 0; i < 150; i++) {
  const a = swr() * Math.PI * 2;
  const rad = Math.sqrt(swr()) * 248;
  swarm.push(ce(`earthdot-${i}`, Math.cos(a) * rad, Math.sin(a) * rad + 10, 4.5, "#3B82F6", { opacity: 0.9 }));
}
const sizeGrp = group({ id: "size", x: CX, y: CY, opacity: 0 }, [
  ce("size-sun", 0, 10, 280, SUN_GLOW, { opacity: 0.12 }),
  ...swarm,
  tx("size-n", 0, -330, "1,000,000+ Earths", 64, 800, FG),
  tx("size-sub", 0, 330, "would fit inside the Sun", 26, 500, MUTED),
]);

// ── beat 7 · the eight-minute light ──
const light = group({ id: "light", x: CX, y: CY, opacity: 0 }, [
  ce("li-sun", -660, 0, 66, SUN_CORE),
  ce("li-sun-glow", -660, 0, 96, SUN_GLOW, { opacity: 0.18 }),
  ce("li-earth", 660, 0, 26, "#3B82F6"),
  path({ id: "beam", x: 0, y: 0, d: "M -590 0 L 632 0", stroke: "#FFD36A", strokeWidth: 3, progress: 0 }),
  ce("photon", -590, 0, 8, FG),
  tx("li-l", 0, -90, "8 light-minutes", 40, 800, FG),
  tx("li-sub", 0, 96, "the sunlight on your skin left the Sun 8 minutes ago", 22, 500, MUTED),
]);

const endtitle = group({ id: "endtitle", x: CX, y: CY, opacity: 0 }, [
  tx("end-t", 0, 250, "THE SOLAR SYSTEM", 30, 800, FG),
  tx("end-home", 0, 150, "you are here", 20, 500, "#7CC4FF"),
]);

const behaviors: BehaviorIR[] = [...orbitBehaviors, ...starTwinkle, sunPulse];

const drawOrbits: TimelineIR = par(
  ...PLANETS.map((p, i) => seq(wait(i * 0.12), tween(`orbit-${p.name}`, { progress: 1 }, { duration: 0.9, ease: "easeOutCubic" }))),
);

export default scene({
  id: "solar-system",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  behaviors,
  nodes: [
    group({ id: "stars", x: 0, y: 0 }, stars),
    system,
    hero,
    analogy,
    sizeGrp,
    light,
    endtitle,
    tx("wm", 1840, 1044, "reframe", 18, 700, "#2A3140", "center"),
  ],
  timeline: seq(
    // 1 · pale blue dot
    beat("intro", { nodes: ["hero"] }, [
      seq(par(tween("hero", { opacity: 1 }, { duration: 1.2, ease: "easeOutCubic", label: "b-intro" }), tween("hero", { scale: 1 }, { duration: 1.8, ease: "easeOutCubic" })), wait(3.2)),
    ]),
    // 2 · one of eight
    beat("neighbors", {}, [
      seq(par(tween("hero", { opacity: 0, scale: 0.28 }, { duration: 1.2, ease: "easeInCubic", label: "b-neighbors" }), tween("system", { opacity: 1, scale: 1.3 }, { duration: 1.4, ease: "easeOutCubic" })), wait(3.4)),
    ]),
    // 3 · the planets
    beat("planets", {}, [
      seq(tween("system", { scale: 0.62 }, { duration: 1.8, ease: "easeInOutCubic", label: "b-planets" }), drawOrbits, wait(3.2)),
    ]),
    // 4 · the Sun
    beat("sun", {}, [
      seq(par(tween("system", { scale: 1.45 }, { duration: 1.9, ease: "easeInOutCubic", label: "b-sun" }), tween("sun-grow", { scale: 1.4 }, { duration: 1.9, ease: "easeOutCubic" })), wait(3.4)),
    ]),
    // 5 · scale analogy
    beat("analogy", {}, [
      seq(par(tween("system", { opacity: 0 }, { duration: 0.8, ease: "easeInCubic", label: "b-analogy" }), tween("analogy", { opacity: 1 }, { duration: 0.9, ease: "easeOutCubic" })), wait(4.4), tween("analogy", { opacity: 0 }, { duration: 0.6, ease: "easeInCubic" })),
    ]),
    // 6 · a million Earths
    beat("size", {}, [
      seq(tween("size", { opacity: 1 }, { duration: 0.8, ease: "easeOutCubic", label: "b-size" }), wait(3.0), tween("size", { opacity: 0 }, { duration: 0.6, ease: "easeInCubic" })),
    ]),
    // 7 · the eight-minute light
    beat("light", {}, [
      seq(
        tween("light", { opacity: 1 }, { duration: 0.7, ease: "easeOutCubic", label: "b-light" }),
        par(tween("beam", { progress: 1 }, { duration: 2.2, ease: "easeInOutCubic" }), motionPath("photon", [[-590, 0], [632, 0]], { duration: 2.2, ease: "linear" })),
        wait(3.0),
        tween("light", { opacity: 0 }, { duration: 0.6, ease: "easeInCubic" }),
      ),
    ]),
    // 8 · home
    beat("finale", { nodes: ["hero"] }, [
      seq(par(tween("hero", { opacity: 1, scale: 1 }, { duration: 1.2, ease: "easeOutCubic", label: "b-finale" }), tween("endtitle", { opacity: 1 }, { duration: 1.2, ease: "easeOutCubic" })), wait(4.8)),
    ]),
  ),
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.22, fadeIn: 2, fadeOut: 2.5, duck: { depth: 0.4 } },
    cues: [
      { at: "b-intro", offset: 0.3, file: "solar-system-vo/intro.wav", gain: 1.2 },
      { at: "b-neighbors", offset: 0.1, file: "solar-system-vo/neighbors.wav", gain: 1.2 },
      { at: "b-planets", offset: 0.1, file: "solar-system-vo/planets.wav", gain: 1.2 },
      { at: "b-sun", offset: 0.1, file: "solar-system-vo/sun.wav", gain: 1.2 },
      { at: "b-analogy", offset: 0.2, file: "solar-system-vo/analogy.wav", gain: 1.2 },
      { at: "b-size", offset: 0.2, file: "solar-system-vo/size.wav", gain: 1.2 },
      { at: "b-light", offset: 0.2, file: "solar-system-vo/light.wav", gain: 1.2 },
      { at: "b-finale", offset: 0.2, file: "solar-system-vo/finale.wav", gain: 1.2 },
      // sparse atmospheric accents
      { at: "b-neighbors", file: "maximize_009.ogg", gain: 0.3 },
      { at: "b-sun", file: "maximize_005.ogg", gain: 0.32 },
      { at: "b-size", file: "bong_001.ogg", gain: 0.4 },
      { at: "b-finale", file: "glass_001.ogg", gain: 0.3 },
    ],
  },
});
