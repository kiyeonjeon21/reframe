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

// NOVA — app launch teaser (~10s, dark & modern).
// A lone star ignites in the void and charges, goes supernova (flash +
// shockwave rings), and the NOVA wordmark condenses out of the light.
// An underline draws, a tagline lands, then everything settles into
// COMING SOON and fades to black.

// deterministic hash (pure function of index — no Math.random)
const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) =>
  fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

// --- starfield -------------------------------------------------------------
const STAR_COUNT = 20;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: `star-${i}`,
  x: 80 + rand(i, 1) * 1760,
  y: 60 + rand(i, 2) * 960,
  size: 2 + rand(i, 3) * 4,
  opacity: 0.2 + rand(i, 4) * 0.4,
}));

// --- wordmark letters (relative to the wordmark group at 960,520) ----------
const LETTERS = [
  { ch: "N", x: -248 },
  { ch: "O", x: -76 },
  { ch: "V", x: 92 },
  { ch: "A", x: 252 },
];

const letterNode = (l: { ch: string; x: number }, i: number): NodeIR =>
  text({
    id: `letter-${l.ch.toLowerCase()}`,
    x: l.x,
    y: 46,
    anchor: "center",
    content: l.ch,
    fontFamily: "Inter",
    fontSize: 200,
    fontWeight: 800,
    fill: "#F2F4FF",
    opacity: 0,
    scale: 0.4,
    rotation: (rand(i, 5) - 0.5) * 24,
  });

const letterIn = (l: { ch: string; x: number }, i: number): TimelineIR =>
  par(
    tween(
      `letter-${l.ch.toLowerCase()}`,
      { y: 0, scale: 1, rotation: 0 },
      { duration: 0.7, ease: "easeOutExpo", ...(i === 0 && { label: "title" }) },
    ),
    tween(`letter-${l.ch.toLowerCase()}`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad" }),
  );

export default scene({
  id: "nova-teaser",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#05060B",
  nodes: [
    group({ id: "stage", x: 0, y: 0 }, [
      // drifting starfield
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

      // the star that goes nova
      group({ id: "core", x: 960, y: 540, scale: 0.6, opacity: 0 }, [
        ellipse({ id: "core-halo", x: 0, y: 0, width: 150, height: 150, anchor: "center", fill: "#5B6CFF", opacity: 0.3 }),
        ellipse({ id: "core-glow", x: 0, y: 0, width: 72, height: 72, anchor: "center", fill: "#A9B4FF", opacity: 0.55 }),
        ellipse({ id: "core-dot", x: 0, y: 0, width: 32, height: 32, anchor: "center", fill: "#FFFFFF" }),
      ]),

      // supernova shockwaves + full-frame flash
      ellipse({ id: "ring-1", x: 960, y: 540, width: 130, height: 130, anchor: "center", stroke: "#7C8CFF", strokeWidth: 4, opacity: 0 }),
      ellipse({ id: "ring-2", x: 960, y: 540, width: 130, height: 130, anchor: "center", stroke: "#AAB4FF", strokeWidth: 2, opacity: 0 }),
      rect({ id: "flash", x: 0, y: 0, width: 1920, height: 1080, fill: "#C3CBFF", opacity: 0 }),

      // wordmark + supporting copy
      group({ id: "wordmark", x: 960, y: 520 }, LETTERS.map(letterNode)),
      line({ id: "underline", x1: 760, y1: 650, x2: 1160, y2: 650, stroke: "#6D7CFF", strokeWidth: 4, progress: 0 }),
      text({
        id: "tagline",
        x: 960,
        y: 706,
        anchor: "center",
        content: "WHERE IDEAS IGNITE",
        fontFamily: "Inter",
        fontSize: 28,
        fontWeight: 400,
        fill: "#8A93AD",
        letterSpacing: 8,
        opacity: 0,
      }),
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
        letterSpacing: 26,
        opacity: 0,
      }),
    ]),
  ],

  timeline: seq(
    wait(0.2),

    // 1 — a star ignites in a slowly waking field
    par(
      tween("core", { opacity: 1, scale: 1 }, { duration: 0.8, ease: "easeOutCubic", label: "ignite" }),
      stagger(
        0.05,
        ...stars.map((s) =>
          tween(s.id, { opacity: s.opacity }, { duration: 0.5, ease: "easeOutQuad" }),
        ),
      ),
    ),

    // 2 — it charges (pulse lives in behaviors)
    wait(1.0, "charge"),

    // 3 — supernova: flash, core blows out, two shockwave rings
    par(
      seq(
        tween("flash", { opacity: 0.35 }, { duration: 0.08, ease: "easeOutQuad", label: "burst" }),
        tween("flash", { opacity: 0 }, { duration: 0.4, ease: "easeOutQuad" }),
      ),
      par(
        tween("core", { scale: 8 }, { duration: 0.5, ease: "easeOutQuart" }),
        tween("core", { opacity: 0 }, { duration: 0.5, ease: "easeOutQuad" }),
      ),
      par(
        tween("ring-1", { scale: 9 }, { duration: 0.8, ease: "easeOutQuart" }),
        seq(
          tween("ring-1", { opacity: 0.9 }, { duration: 0.06, ease: "easeOutQuad" }),
          wait(0.2),
          tween("ring-1", { opacity: 0 }, { duration: 0.54, ease: "easeOutQuad" }),
        ),
      ),
      seq(
        wait(0.1),
        par(
          tween("ring-2", { scale: 11 }, { duration: 0.8, ease: "easeOutQuart" }),
          seq(
            tween("ring-2", { opacity: 0.7 }, { duration: 0.06, ease: "easeOutQuad" }),
            wait(0.2),
            tween("ring-2", { opacity: 0 }, { duration: 0.54, ease: "easeOutQuad" }),
          ),
        ),
      ),
    ),

    // 4 — NOVA condenses out of the light
    stagger(0.08, ...LETTERS.map(letterIn)),

    // 5 — underline draws, tagline lands
    par(
      tween("underline", { progress: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "underline" }),
      tween("tagline", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "tagline" }),
    ),

    wait(1.6, "hold"),

    // 6 — settle into the promise: COMING SOON tracks in
    par(
      tween("tagline", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      tween("underline", { opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
      tween("wordmark", { y: 500 }, { duration: 0.6, ease: "easeInOutCubic" }),
      tween("coming-soon", { opacity: 1, letterSpacing: 12 }, { duration: 0.8, ease: "easeOutCubic", label: "coming-soon" }),
    ),

    wait(1.7, "end-hold"),

    // 7 — cut to black
    tween("stage", { opacity: 0 }, { duration: 0.7, ease: "easeInQuad", label: "fade-out" }),
  ),

  behaviors: [
    // charging pulse before the burst
    oscillate("core", "scale", { amplitude: 0.09, frequency: 1.8 }, { from: 1.0, until: 2.65, ramp: 0.3 }),
    // starfield drift + twinkle, whole scene
    ...stars.flatMap((s, i): BehaviorIR[] => [
      wiggle(s.id, "x", { amplitude: 8 + rand(i, 6) * 8, frequency: 0.12, seed: i * 7 + 1 }),
      wiggle(s.id, "y", { amplitude: 6 + rand(i, 7) * 6, frequency: 0.1, seed: i * 7 + 2 }),
    ]),
    // the lockup breathes once it has assembled
    oscillate("wordmark", "y", { amplitude: 4, frequency: 0.35 }, { from: 4.6 }),
  ],

  audio: {
    bgm: { synth: "ambient-pad", gain: 0.25, fadeIn: 1, fadeOut: 1.5, duck: { depth: 0.4 } },
    cues: [
      { at: "ignite", sfx: "shimmer", gain: 0.35 },
      { at: "charge", sfx: "rise", gain: 0.55 },
      { at: "burst", sfx: "whoosh", gain: 0.95 },
      { at: "burst", offset: 0.12, sfx: "thud", gain: 0.6 },
      // one tick as each letter locks in, rising in level
      { at: "title", offset: 0.3, sfx: "tick", gain: 0.3 },
      { at: "title", offset: 0.38, sfx: "tick", gain: 0.35 },
      { at: "title", offset: 0.46, sfx: "tick", gain: 0.4 },
      { at: "title", offset: 0.54, sfx: "tick", gain: 0.45 },
      { at: "underline", sfx: "pop", gain: 0.4 },
      { at: "coming-soon", sfx: "shimmer", gain: 0.5 },
      { at: "coming-soon", offset: 0.3, sfx: "thud", gain: 0.4 },
    ],
  },
});
