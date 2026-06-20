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
  wiggle,
  oscillate,
  radialGradient,
  type BehaviorIR,
} from "@reframe/core";

// "Swarm" — a procedural particle emitter as plain data. ~280 sparks burst from
// the centre along seeded radial trajectories, each one drifting on its own
// seeded `wiggle`, accumulating into glow where they overlap via `blend:"add"`.
// Probes: object-level `wiggle` at scale, additive compositing, deterministic
// emission (no Math.random — every spark is a pure function of its index).

const N = 280;
const CX = 960;
const CY = 540;

// build-time deterministic hash → [0,1) (NOT runtime randomness; folded into IR)
const hash = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PALETTE: string[] = ["#FFD166", "#FF7A00", "#FF3D81", "#7C5CFF", "#5BE0FF"];

const sparks = Array.from({ length: N }, (_, i) => {
  const ang = hash(i, 1) * Math.PI * 2;
  const dist = 180 + hash(i, 2) * 620; // how far it flies
  const size = 4 + hash(i, 3) * 16;
  return {
    id: `spark-${i}`,
    ex: Math.cos(ang) * dist, // endpoint, relative to the emitter group
    ey: Math.sin(ang) * dist,
    size,
    color: PALETTE[Math.floor(hash(i, 4) * PALETTE.length)]!,
    delay: hash(i, 5) * 0.9,
    seed: i + 1,
    dur: 1.1 + hash(i, 6) * 1.4,
  };
});

export default scene({
  id: "particle-swarm",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#05060B",
  nodes: [
    // a soft core glow the sparks erupt from
    ellipse({
      id: "core",
      x: CX,
      y: CY,
      width: 240,
      height: 240,
      anchor: "center",
      fill: radialGradient(["#FFE9B0", "#FF7A0033", "#FF7A0000"]),
      blend: "screen",
      opacity: 0,
    }),
    group(
      { id: "swarm", x: CX, y: CY },
      sparks.map((s) =>
        ellipse({
          id: s.id,
          x: 0,
          y: 0,
          width: s.size,
          height: s.size,
          anchor: "center",
          fill: s.color,
          blend: "add", // overlaps accumulate into glow
          opacity: 0,
          scale: 0.2,
        }),
      ),
    ),
    text({
      id: "cap",
      x: CX,
      y: 1010,
      anchor: "center",
      content: "280 sparks · seeded wiggle · additive blend · zero randomness",
      fontFamily: "Inter",
      fontSize: 24,
      fill: "#7E88A8",
      opacity: 0,
    }),
  ],

  timeline: seq(
    wait(0.2),
    par(
      tween("core", { opacity: 1, scale: 1.4 }, { duration: 0.5, ease: "easeOutCubic", label: "ignite" }),
      // emit: each spark flies to its seeded endpoint, popping in as it goes
      stagger(
        0.003,
        ...sparks.map((s) =>
          seq(
            wait(s.delay),
            par(
              tween(s.id, { opacity: 1, scale: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
              tween(s.id, { x: s.ex, y: s.ey }, { duration: s.dur, ease: "easeOutExpo" }),
            ),
          ),
        ),
      ),
    ),
    wait(1.6, "drift"),
    // dim the core, let the swarm breathe and fade
    par(
      tween("core", { opacity: 0.3, scale: 1.0 }, { duration: 1.2, ease: "easeInOutCubic" }),
      tween("cap", { opacity: 1 }, { duration: 0.6, ease: "easeOutQuad" }),
      tween("swarm", { rotation: 14 }, { duration: 2.4, ease: "easeInOutCubic" }),
    ),
    wait(1.6, "hold"),
    par(
      ...sparks.map((s) =>
        tween(s.id, { opacity: 0, scale: 0.3 }, { duration: 0.8 + hash(s.seed, 7) * 0.6, ease: "easeInQuad" }),
      ),
      tween("core", { opacity: 0 }, { duration: 1.0, ease: "easeInQuad" }),
      tween("cap", { opacity: 0 }, { duration: 0.8, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // every spark drifts on its own seeded noise once it has launched — organic,
    // deterministic, addressable per particle
    ...sparks.flatMap((s): BehaviorIR[] => [
      wiggle(s.id, "x", { amplitude: 26, frequency: 0.5, seed: s.seed }, { from: 0.6, until: 6.0, ramp: 0.5 }),
      wiggle(s.id, "y", { amplitude: 26, frequency: 0.5, seed: s.seed + 999 }, { from: 0.6, until: 6.0, ramp: 0.5 }),
    ]),
    // the core pulses
    oscillate("core", "scale", { amplitude: 0.08, frequency: 0.7 }, { from: 0.6, until: 4.4, ramp: 0.4 }),
  ],
});
