import {
  scene,
  group,
  ellipse,
  rect,
  line,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  oscillate,
  wiggle,
  type BehaviorIR,
  type NodeIR,
  type TimelineIR,
} from "@reframe/core";

// NOVA — app launch teaser (~7.5s, dark & modern).
// A star ignites in a waking field, spins up an accretion disc while the
// camera presses in and the frame rumbles, then detonates: double-strobe
// flash, camera punch, three shockwave rings, radial spark streaks, hard
// screen shake. Then the energy resolves: the NOVA wordmark condenses out
// of the light in a slow, graceful fade-and-rise, an underline draws in,
// and everything settles into COMING SOON with a small nova.app URL
// beneath it as the camera keeps pushing — then cut to black.

// deterministic hash (pure function of index — no Math.random)
const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) =>
  fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

// --- starfield (denser than before; star-0..19 keep their positions) -------
const STAR_COUNT = 30;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: `star-${i}`,
  x: 80 + rand(i, 1) * 1760,
  y: 60 + rand(i, 2) * 960,
  size: 2 + rand(i, 3) * 4,
  opacity: 0.2 + rand(i, 4) * 0.4,
}));

// --- burst spark streaks (radial debris at the supernova) -------------------
const SPARK_COUNT = 14;
const SPARK_COLORS = ["#FFFFFF", "#9DA9FF", "#6D7CFF"];
const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
  const angle = (i / SPARK_COUNT) * Math.PI * 2 + (rand(i, 8) - 0.5) * 0.5;
  const dist = 420 + rand(i, 9) * 480;
  return {
    id: `spark-${i}`,
    tx: 960 + Math.cos(angle) * dist,
    ty: 540 + Math.sin(angle) * dist,
    len: 36 + rand(i, 10) * 58,
    deg: (angle * 180) / Math.PI,
    color: SPARK_COLORS[i % 3] ?? "#FFFFFF",
  };
});

// --- wordmark letters (relative to the wordmark group at 960,520) ----------
const LETTERS = [
  { ch: "N", x: -248 },
  { ch: "O", x: -76 },
  { ch: "V", x: 92 },
  { ch: "A", x: 252 },
];

const letterNode = (l: { ch: string; x: number }): NodeIR =>
  text({
    id: `letter-${l.ch.toLowerCase()}`,
    x: l.x,
    y: 24,
    anchor: "center",
    content: l.ch,
    fontFamily: "Inter",
    fontSize: 200,
    fontWeight: 800,
    fill: "#F2F4FF",
    opacity: 0,
    scale: 1.12,
  });

// each letter condenses out of the light: a slow fade with a gentle rise
// and settle — no slam, no spin
const letterIn = (l: { ch: string; x: number }, i: number): TimelineIR =>
  par(
    tween(
      `letter-${l.ch.toLowerCase()}`,
      { y: 0, scale: 1 },
      { duration: 0.8, ease: "easeOutCubic", ...(i === 0 && { label: "title" }) },
    ),
    tween(`letter-${l.ch.toLowerCase()}`, { opacity: 1 }, { duration: 0.7, ease: "easeOutQuad" }),
  );

export default scene({
  id: "nova-teaser",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#05060B",
  nodes: [
    // camera: transform origin at screen center — zoom punches and push-ins
    group({ id: "camera", x: 960, y: 540 }, [
      group({ id: "stage", x: -960, y: -540 }, [
        // drifting, twinkling starfield
        ...stars.map((s) =>
          ellipse({
            id: s.id,
            x: s.x,
            y: s.y,
            width: s.size,
            height: s.size,
            anchor: "center",
            fill: "#5E6B8F",
            opacity: 0,
          }),
        ),

        // the star that goes nova (+ spinning accretion orbits)
        group({ id: "core", x: 960, y: 540, scale: 0.6, opacity: 0 }, [
          ellipse({ id: "core-halo", x: 0, y: 0, width: 150, height: 150, anchor: "center", fill: "#5B6CFF", opacity: 0.3 }),
          ellipse({ id: "orbit-1", x: 0, y: 0, width: 240, height: 70, anchor: "center", stroke: "#7C8CFF", strokeWidth: 2, opacity: 0, rotation: 20 }),
          ellipse({ id: "orbit-2", x: 0, y: 0, width: 200, height: 56, anchor: "center", stroke: "#AAB4FF", strokeWidth: 1.5, opacity: 0, rotation: -50 }),
          ellipse({ id: "core-glow", x: 0, y: 0, width: 72, height: 72, anchor: "center", fill: "#A9B4FF", opacity: 0.55 }),
          ellipse({ id: "core-dot", x: 0, y: 0, width: 32, height: 32, anchor: "center", fill: "#FFFFFF" }),
        ]),

        // supernova shockwaves, spark streaks, full-frame flash
        ellipse({ id: "ring-1", x: 960, y: 540, width: 130, height: 130, anchor: "center", stroke: "#7C8CFF", strokeWidth: 4, opacity: 0 }),
        ellipse({ id: "ring-2", x: 960, y: 540, width: 130, height: 130, anchor: "center", stroke: "#AAB4FF", strokeWidth: 2, opacity: 0 }),
        ellipse({ id: "ring-3", x: 960, y: 540, width: 130, height: 130, anchor: "center", stroke: "#FFFFFF", strokeWidth: 1.5, opacity: 0 }),
        ...sparks.map((s) =>
          rect({
            id: s.id,
            x: 960,
            y: 540,
            width: s.len,
            height: 3,
            anchor: "center",
            fill: s.color,
            rotation: s.deg,
            opacity: 0,
          }),
        ),
        // oversized so camera punch-out never reveals its edges
        rect({ id: "flash", x: -240, y: -160, width: 2400, height: 1400, fill: "#C3CBFF", opacity: 0 }),

        // wordmark + supporting copy
        group({ id: "wordmark", x: 960, y: 520 }, LETTERS.map(letterNode)),
        line({ id: "underline", x1: 760, y1: 650, x2: 1160, y2: 650, stroke: "#6D7CFF", strokeWidth: 4, progress: 0 }),
        text({
          id: "coming-soon",
          x: 960,
          y: 706,
          anchor: "center",
          content: "COMING SOON",
          fontFamily: "Inter",
          fontSize: 44,
          fontWeight: 700,
          fill: "#E8EBFF",
          letterSpacing: 40,
          opacity: 0,
        }),
        text({
          id: "url",
          x: 960,
          y: 780,
          anchor: "center",
          content: "nova.app",
          fontFamily: "Inter",
          fontSize: 24,
          fontWeight: 400,
          fill: "#8A93AD",
          letterSpacing: 4,
          opacity: 0,
        }),
      ]),
    ]),
  ],

  timeline: seq(
    wait(0.2),

    // 1 — a star snaps awake in a waking field; the accretion disc lights up
    par(
      seq(
        tween("core", { opacity: 1, scale: 1.18 }, { duration: 0.38, ease: "easeOutCubic", label: "ignite" }),
        tween("core", { scale: 1 }, { duration: 0.16, ease: "easeInOutQuad" }),
      ),
      stagger(
        0.03,
        ...stars.map((s) =>
          tween(s.id, { opacity: s.opacity }, { duration: 0.35, ease: "easeOutQuad" }),
        ),
      ),
      seq(
        wait(0.25),
        par(
          tween("orbit-1", { opacity: 0.7 }, { duration: 0.4, ease: "easeOutQuad" }),
          tween("orbit-2", { opacity: 0.5 }, { duration: 0.4, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // 2 — charge-up: the disc spins faster, the core heats white-hot,
    //     the camera presses in, the frame starts to rumble (behaviors)
    par(
      wait(1.2, "charge"),
      tween("camera", { scale: 1.15 }, { duration: 1.2, ease: "easeInCubic" }),
      tween("orbit-1", { rotation: 620 }, { duration: 1.2, ease: "easeInCubic" }),
      tween("orbit-2", { rotation: -710 }, { duration: 1.2, ease: "easeInCubic" }),
      tween("core-glow", { fill: "#FFFFFF", opacity: 0.85 }, { duration: 1.2, ease: "easeInQuad" }),
      tween("core-halo", { scale: 1.7, opacity: 0.5 }, { duration: 1.2, ease: "easeInQuad" }),
    ),

    // 3 — supernova: double-strobe flash, camera punch, core blow-out,
    //     three shockwave rings, radial spark streaks, hard shake (behavior)
    par(
      seq(
        tween("flash", { opacity: 0.85 }, { duration: 0.06, ease: "easeOutQuad", label: "burst" }),
        tween("flash", { opacity: 0.15 }, { duration: 0.08, ease: "easeOutQuad" }),
        tween("flash", { opacity: 0.5 }, { duration: 0.05, ease: "easeOutQuad" }),
        tween("flash", { opacity: 0 }, { duration: 0.45, ease: "easeOutQuad" }),
      ),
      seq(
        tween("camera", { scale: 0.94 }, { duration: 0.12, ease: "easeOutQuart" }),
        tween("camera", { scale: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      ),
      par(
        tween("core", { scale: 14 }, { duration: 0.45, ease: "easeOutQuart" }),
        tween("core", { opacity: 0 }, { duration: 0.4, ease: "easeOutQuad" }),
      ),
      par(
        tween("ring-1", { scale: 10 }, { duration: 0.7, ease: "easeOutQuart" }),
        seq(
          tween("ring-1", { opacity: 0.9 }, { duration: 0.05, ease: "easeOutQuad" }),
          wait(0.15),
          tween("ring-1", { opacity: 0 }, { duration: 0.5, ease: "easeOutQuad" }),
        ),
      ),
      seq(
        wait(0.08),
        par(
          tween("ring-2", { scale: 13 }, { duration: 0.7, ease: "easeOutQuart" }),
          seq(
            tween("ring-2", { opacity: 0.7 }, { duration: 0.05, ease: "easeOutQuad" }),
            wait(0.15),
            tween("ring-2", { opacity: 0 }, { duration: 0.5, ease: "easeOutQuad" }),
          ),
        ),
      ),
      seq(
        wait(0.16),
        par(
          tween("ring-3", { scale: 16 }, { duration: 0.75, ease: "easeOutQuart" }),
          seq(
            tween("ring-3", { opacity: 0.5 }, { duration: 0.05, ease: "easeOutQuad" }),
            wait(0.15),
            tween("ring-3", { opacity: 0 }, { duration: 0.55, ease: "easeOutQuad" }),
          ),
        ),
      ),
      ...sparks.map((s) =>
        par(
          tween(s.id, { x: s.tx, y: s.ty }, { duration: 0.7, ease: "easeOutQuart" }),
          tween(s.id, { scale: 0.2 }, { duration: 0.7, ease: "easeOutQuad" }),
          seq(
            tween(s.id, { opacity: 1 }, { duration: 0.05, ease: "easeOutQuad" }),
            wait(0.2),
            tween(s.id, { opacity: 0 }, { duration: 0.45, ease: "easeOutQuad" }),
          ),
        ),
      ),
    ),

    // 4 — NOVA condenses out of the light, letter by letter, gracefully
    stagger(0.1, ...LETTERS.map(letterIn)),

    // 5 — underline draws across
    tween("underline", { progress: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "underline" }),

    // 6 — hold while the camera keeps pushing in
    par(
      wait(0.6, "hold"),
      tween("camera", { scale: 1.05 }, { duration: 0.6, ease: "easeInOutQuad" }),
    ),

    // 7 — settle into the promise: COMING SOON tracks in hard,
    //     the URL fades in quietly beneath it
    par(
      tween("underline", { opacity: 0 }, { duration: 0.3, ease: "easeInQuad" }),
      tween("wordmark", { y: 500, scale: 0.96 }, { duration: 0.5, ease: "easeInOutCubic" }),
      tween("coming-soon", { opacity: 1, letterSpacing: 12 }, { duration: 0.6, ease: "easeOutCubic", label: "coming-soon" }),
      seq(
        wait(0.25),
        tween("url", { opacity: 0.85, y: 772 }, { duration: 0.45, ease: "easeOutCubic", label: "url" }),
      ),
    ),

    // 8 — final hold, camera still drifting forward
    par(
      wait(0.7, "end-hold"),
      tween("camera", { scale: 1.1 }, { duration: 0.7, ease: "linear" }),
    ),

    // 9 — cut to black with a last push
    par(
      tween("stage", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad", label: "fade-out" }),
      tween("camera", { scale: 1.18 }, { duration: 0.5, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // charging pulse before the burst (stronger and faster than before);
    // burst lands at t≈2.62 (ignite par 1.22 + charge 1.2 + lead-in 0.2)
    oscillate("core", "scale", { amplitude: 0.16, frequency: 3.0 }, { from: 1.4, until: 2.62, ramp: 0.3 }),
    // pre-burst rumble building under the charge
    wiggle("stage", "x", { amplitude: 5, frequency: 16, seed: 41 }, { from: 1.8, until: 2.62, ramp: 0.4 }),
    wiggle("stage", "y", { amplitude: 4, frequency: 14, seed: 42 }, { from: 1.8, until: 2.62, ramp: 0.4 }),
    // hard screen shake on detonation
    wiggle("stage", "x", { amplitude: 16, frequency: 13, seed: 43 }, { from: 2.62, until: 3.2, ramp: 0.12 }),
    wiggle("stage", "y", { amplitude: 12, frequency: 11, seed: 44 }, { from: 2.62, until: 3.2, ramp: 0.12 }),
    // starfield drift + twinkle, whole scene
    ...stars.flatMap((s, i): BehaviorIR[] => [
      wiggle(s.id, "x", { amplitude: 10 + rand(i, 6) * 8, frequency: 0.18, seed: i * 7 + 1 }),
      wiggle(s.id, "y", { amplitude: 8 + rand(i, 7) * 6, frequency: 0.15, seed: i * 7 + 2 }),
      wiggle(s.id, "opacity", { amplitude: 0.15, frequency: 0.6, seed: i * 7 + 3 }),
    ]),
    // the lockup breathes once it has assembled (assembly done at t≈4.63)
    oscillate("wordmark", "y", { amplitude: 4, frequency: 0.35 }, { from: 4.7 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.25, fadeIn: 1, fadeOut: 1.5, duck: { depth: 0.4 } },
    cues: [
      { at: "ignite", sfx: "shimmer", gain: 0.35 },
      { at: "charge", sfx: "rise", gain: 0.6 },
      { at: "burst", sfx: "whoosh", gain: 0.95 },
      { at: "burst", offset: 0.1, sfx: "thud", gain: 0.65 },
      // one soft swell as the wordmark condenses — the assembly is one
      // gesture now, not four hits
      { at: "title", sfx: "shimmer", gain: 0.4 },
      { at: "underline", sfx: "pop", gain: 0.4 },
      { at: "coming-soon", sfx: "shimmer", gain: 0.5 },
      { at: "coming-soon", offset: 0.3, sfx: "thud", gain: 0.4 },
    ],
  },
});
