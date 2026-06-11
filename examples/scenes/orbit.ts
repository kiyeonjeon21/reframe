import {
  scene,
  group,
  ellipse,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  oscillate,
  type BehaviorIR,
  type NodeIR,
} from "@reframe/core";

// "Orbit" — nested transform composition. Moons orbit planets that orbit a
// sun, each on its own rotating group; the whole system tilts and breathes.
// In absolute-positioned HTML this is trigonometry on every frame; here it
// is three nested groups and three linear rotation tweens.

const CX = 960;
const CY = 520;

// deterministic star field (host-side seeded hash, no Math.random)
const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) => fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);
const STARS = Array.from({ length: 70 }, (_, i) => ({
  id: `star-${i}`,
  x: 60 + rand(i, 1) * 1800,
  y: 40 + rand(i, 2) * 1000,
  size: 1.5 + rand(i, 3) * 2.5,
}));

const PLANETS = [
  { id: "p1", radius: 180, size: 22, color: "#7EE0B8", year: 6.5, moons: 1, start: 20 },
  { id: "p2", radius: 295, size: 34, color: "#5B8CFF", year: 11, moons: 2, start: 160 },
  { id: "p3", radius: 415, size: 26, color: "#C81D5E", year: 17, moons: 1, start: 290 },
];

const DURATION = 13;

const planetNode = (p: (typeof PLANETS)[number]): NodeIR =>
  // orbit group rotates around the sun; the planet sits at (radius, 0) inside
  group({ id: `${p.id}-orbit`, x: 0, y: 0, rotation: p.start }, [
    group({ id: p.id, x: p.radius, y: 0 }, [
      ellipse({ id: `${p.id}-body`, x: 0, y: 0, width: p.size, height: p.size, anchor: "center", fill: p.color, opacity: 0, scale: 0 }),
      ...(p.id === "p2"
        ? [ellipse({ id: "p2-ring", x: 0, y: 0, width: 72, height: 22, anchor: "center", stroke: "#9FB6FF", strokeWidth: 2.5, opacity: 0, rotation: -18 })]
        : []),
      ...Array.from({ length: p.moons }, (_, m) =>
        group({ id: `${p.id}-moonorbit-${m}`, x: 0, y: 0, rotation: m * 180 }, [
          ellipse({ id: `${p.id}-moon-${m}`, x: p.size * 1.4 + 14 + m * 14, y: 0, width: 8, height: 8, anchor: "center", fill: "#E7EAF0", opacity: 0 }),
        ]),
      ),
    ]),
  ]);

export default scene({
  id: "orbit",
  size: { width: 1920, height: 1080 },
  fps: 30,
  duration: DURATION,
  background: "#05060A",
  nodes: [
    ...STARS.map((s) =>
      ellipse({ id: s.id, x: s.x, y: s.y, width: s.size, height: s.size, anchor: "center", fill: "#8B93A7", opacity: 0 }),
    ),
    group({ id: "system", x: CX, y: CY, scale: 0.96 }, [
      // faux glow: layered translucent discs (no blur in the IR — fake it)
      ellipse({ id: "glow2", x: 0, y: 0, width: 360, height: 360, anchor: "center", fill: "#FFD166", opacity: 0 }),
      ellipse({ id: "glow1", x: 0, y: 0, width: 200, height: 200, anchor: "center", fill: "#FFD166", opacity: 0 }),
      ellipse({ id: "sun", x: 0, y: 0, width: 96, height: 96, anchor: "center", fill: "#FFD166", opacity: 0, scale: 0 }),
      ...PLANETS.map((p) =>
        ellipse({ id: `ring-${p.id}`, x: 0, y: 0, width: p.radius * 2, height: p.radius * 2, anchor: "center", stroke: "#242C3B", strokeWidth: 1.5, opacity: 0 }),
      ),
      ...PLANETS.map(planetNode),
    ]),
    text({ id: "title", x: CX, y: 1000, anchor: "center", content: "nested transforms — moons orbit planets orbit suns, declared", fontFamily: "Inter", fontSize: 24, fill: "#8B93A7", opacity: 0 }),
  ],

  timeline: par(
    // entrance
    seq(
      wait(0.2),
      par(
        tween("sun", { opacity: 1, scale: 1 }, { duration: 0.8, ease: "easeOutExpo" }),
        seq(wait(0.2), tween("glow1", { opacity: 0.16 }, { duration: 1.0, ease: "easeOutQuad" })),
        seq(wait(0.3), tween("glow2", { opacity: 0.07 }, { duration: 1.2, ease: "easeOutQuad" })),
        stagger(0.015, ...STARS.map((s) => tween(s.id, { opacity: 0.3 + rand(STARS.indexOf(s), 4) * 0.5 }, { duration: 0.04 }))),
      ),
      stagger(0.25, ...PLANETS.map((p) => tween(`ring-${p.id}`, { opacity: 1 }, { duration: 0.6, ease: "easeOutQuad" }))),
      stagger(
        0.3,
        ...PLANETS.map((p) =>
          par(
            tween(`${p.id}-body`, { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutExpo" }),
            ...(p.id === "p2" ? [seq(wait(0.2), tween("p2-ring", { opacity: 0.8 }, { duration: 0.4 }))] : []),
            ...Array.from({ length: p.moons }, (_, m) =>
              seq(wait(0.3), tween(`${p.id}-moon-${m}`, { opacity: 0.95 }, { duration: 0.3 })),
            ),
          ),
        ),
      ),
      tween("title", { opacity: 1 }, { duration: 0.6, ease: "easeOutQuad", label: "title-in" }),
    ),

    // celestial mechanics: linear rotations, one tween each
    ...PLANETS.map((p) =>
      tween(`${p.id}-orbit`, { rotation: p.start + (360 * DURATION) / p.year }, { duration: DURATION, ease: "linear" }),
    ),
    ...PLANETS.flatMap((p) =>
      Array.from({ length: p.moons }, (_, m) =>
        tween(`${p.id}-moonorbit-${m}`, { rotation: m * 180 + (360 * DURATION) / 2.4 }, { duration: DURATION, ease: "linear" }),
      ),
    ),
    // the whole system slowly tilts — every orbit composes through it
    tween("system", { rotation: -10 }, { duration: DURATION, ease: "easeInOutQuad" }),

    // exit
    seq(
      wait(DURATION - 1.0),
      par(
        tween("system", { opacity: 0 }, { duration: 0.9, ease: "easeInQuad" }),
        tween("title", { opacity: 0 }, { duration: 0.9, ease: "easeInQuad" }),
        ...STARS.map((s) => tween(s.id, { opacity: 0 }, { duration: 0.9, ease: "easeInQuad" })),
      ),
    ),
  ),

  behaviors: [
    oscillate("sun", "scale", { amplitude: 0.05, frequency: 0.5 }, { from: 1.2, until: DURATION - 1 }),
    oscillate("glow1", "scale", { amplitude: 0.1, frequency: 0.5, phase: 0.6 }, { from: 1.2, until: DURATION - 1 }),
    // star twinkle: phase-scattered opacity flicker
    ...STARS.map(
      (s, i): BehaviorIR =>
        oscillate(s.id, "opacity", { amplitude: 0.2, frequency: 0.5 + rand(i, 5) * 0.8, phase: rand(i, 6) * 6.28 }, { from: 2, until: DURATION - 1.2 }),
    ),
  ],
});
