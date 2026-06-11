import {
  scene,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  oscillate,
  type AudioCueIR,
  type BehaviorIR,
  type NodeIR,
  type TimelineIR,
} from "@reframe/core";

// "Typewave" — character-level kinetic typography. A phrase cascades in,
// rides a standing wave, shatters with spin, and a second phrase assembles
// out of the debris. Every glyph is its own node with computed metrics.

const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) => fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

// Inter ExtraBold approximate advance widths (per 100px of fontSize)
const W: Record<string, number> = {
  A: 70, B: 66, C: 70, D: 72, E: 60, F: 58, G: 74, H: 74, I: 30, J: 50,
  K: 68, L: 56, M: 92, N: 74, O: 78, P: 64, Q: 78, R: 66, S: 62, T: 64,
  U: 72, V: 70, W: 100, X: 66, Y: 64, Z: 62, " ": 36, ".": 30, ",": 30,
};

interface Glyph {
  id: string;
  ch: string;
  x: number;
  y: number;
}

function layout(phrase: string, prefix: string, cx: number, y: number, fontSize: number, track = 4): Glyph[] {
  const scaleW = fontSize / 100;
  const advances = [...phrase].map((ch) => ((W[ch] ?? 68) + track) * scaleW);
  const total = advances.reduce((a, b) => a + b, 0) - track * scaleW;
  let cursor = cx - total / 2;
  return [...phrase].map((ch, i) => {
    const g = { id: `${prefix}-${i}`, ch, x: cursor + (advances[i]! - track * scaleW) / 2, y };
    cursor += advances[i]!;
    return g;
  });
}

const P1 = layout("MOTION IS DATA", "a", 960, 470, 130);
const P2 = layout("DATA IS EDITABLE.", "b", 960, 470, 110);

const glyphNode = (g: Glyph, fontSize: number, scattered: boolean, i: number): NodeIR =>
  text({
    id: g.id,
    x: scattered ? g.x + (rand(i, 11) - 0.5) * 900 : g.x,
    y: scattered ? g.y + (rand(i, 12) - 0.5) * 600 : g.y + 90,
    anchor: "center",
    content: g.ch,
    fontFamily: "Inter",
    fontSize,
    fontWeight: 800,
    fill: "#FFFFFF",
    opacity: 0,
    rotation: scattered ? (rand(i, 13) - 0.5) * 160 : 0,
    scale: scattered ? 0.4 : 1,
  });

const shatter = (g: Glyph, i: number): TimelineIR =>
  par(
    tween(g.id, { x: g.x + (rand(i, 21) - 0.5) * 1100, y: g.y + (rand(i, 22) - 0.5) * 760 }, { duration: 0.7, ease: "easeInCubic" }),
    tween(g.id, { rotation: (rand(i, 23) - 0.5) * 300, opacity: 0 }, { duration: 0.7, ease: "easeInQuad" }),
  );

export default scene({
  id: "typewave",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0B0D12",
  nodes: [
    ...P1.map((g, i) => glyphNode(g, 130, false, i)),
    ...P2.map((g, i) => glyphNode(g, 110, true, i + 40)),
    text({ id: "accent", x: 960, y: 580, anchor: "center", content: "every glyph is a node", fontFamily: "Inter", fontSize: 22, fill: "#8B93A7", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    // 1 — cascade in from below, per character
    stagger(
      0.045,
      ...P1.map((g) =>
        par(
          tween(g.id, { opacity: 1 }, { duration: 0.25, ease: "easeOutQuad" }),
          seq(
            tween(g.id, { y: g.y - 14 }, { duration: 0.3, ease: "easeOutCubic" }),
            tween(g.id, { y: g.y }, { duration: 0.2, ease: "easeInOutQuad" }),
          ),
        ),
      ),
    ),
    tween("accent", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "accent-in" }),
    // 2 — the standing wave lives in behaviors
    wait(2.2, "ride"),
    // 3 — shatter
    par(
      tween("accent", { opacity: 0 }, { duration: 0.3, ease: "easeInQuad", label: "shatter" }),
      stagger(0.02, ...P1.map((g, i) => shatter(g, i))),
    ),
    wait(0.2),
    // 4 — second phrase assembles from the debris field
    stagger(
      0.05,
      ...P2.map((g, i) =>
        par(
          tween(
            g.id,
            { x: g.x, y: g.y, rotation: 0, scale: 1 },
            { duration: 0.8, ease: "easeOutExpo", ...(i === 0 && { label: "assemble" }) },
          ),
          tween(g.id, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
        ),
      ),
    ),
    wait(1.8, "hold"),
    par(...P2.map((g) => tween(g.id, { opacity: 0 }, { duration: 0.6, ease: "easeInQuad" }))),
  ),

  behaviors: [
    // standing wave across phrase 1 while it holds
    ...P1.map(
      (g, i): BehaviorIR =>
        oscillate(g.id, "y", { amplitude: 9, frequency: 0.9, phase: i * 0.55 }, { from: 1.6, until: 3.6, ramp: 0.4 }),
    ),
    // a gentle shimmer on phrase 2 during its hold
    ...P2.map(
      (g, i): BehaviorIR =>
        oscillate(g.id, "y", { amplitude: 4, frequency: 0.7, phase: i * 0.45 }, { from: 6.3, until: 8.2, ramp: 0.4 }),
    ),
  ],

  // The user's reference, literally: real CC0 mechanical keypresses, one per
  // glyph, cycling samples and jittering gain so it doesn't sound robotic.
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.22, fadeIn: 0.8, fadeOut: 1.2, duck: { depth: 0.3 } },
    cues: [
      ...P1.flatMap((g, i): AudioCueIR[] =>
        g.ch === " "
          ? []
          : [{
              at: 0.3 + i * 0.045, // shares the cascade constants with the timeline
              file: `keypress-${["001", "004", "007", "010", "014"][i % 5]}.wav`,
              gain: 0.4 + 0.25 * rand(i, 31),
            }],
      ),
      { at: "accent-in", sfx: "tick", gain: 0.4 },
      { at: "shatter", sfx: "whoosh", gain: 0.95 },
      { at: "shatter", offset: 0.18, sfx: "thud", gain: 0.55 },
      // The assembly is not typing — glyphs glide in and LOCK. One rise
      // carries the glide; each glyph gets a soft snap at its landing
      // (~0.35s into its easeOutExpo flight), not at launch.
      { at: "assemble", sfx: "rise", gain: 0.5 },
      ...P2.flatMap((g, i): AudioCueIR[] =>
        g.ch === " "
          ? []
          : [{
              at: "assemble" as const,
              offset: i * 0.05 + 0.35,
              file: `click_00${[2, 4, 2, 4, 2][i % 5]}.ogg`,
              gain: 0.3 + 0.15 * rand(i, 32),
            }],
      ),
      { at: "hold", sfx: "shimmer", gain: 0.55 },
    ],
  },
});
