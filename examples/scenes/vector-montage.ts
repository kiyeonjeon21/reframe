// Vector montage: a pure-vector slideshow (gradient "cards", NO image assets) that
// mirrors `photoMontage`'s addressing contract — so STRUCTURAL overlay edits work and
// it renders standalone from the npm package. Each card is a SELF-CONTAINED named beat
// `shot-${i}`: its group starts at opacity 0, then fades in ∥ scales (a vector Ken
// Burns) ∥ fades out. All the shot beats are flattened under one `montage` beat, so an
// overlay can reorder a card (beat `order`), drop one (`removeTimeline`), or insert one
// (`insertNodes` + `insertTimeline`) and survive an AI regeneration of the base.
//
// Pure + deterministic (no Math.random / Date). The structural-edit overlays live in
// examples/overlays/vector-montage-restructure.json (reorder + remove) and
// vector-montage-insert.json (insert). See docs/guides/regen-contract.md.

import {
  scene, group, rect, text,
  beat, seq, tween, wait,
  linearGradient, radialGradient,
  type Gradient, type NodeIR, type TimelineIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const HOLD = 2.6;   // seconds each card holds on screen
const CROSS = 0.6;  // crossfade seconds (also each card's fade-in / fade-out)

interface Card { word: string; fill: Gradient; }
const CARDS: Card[] = [
  { word: "CAPTURE", fill: linearGradient(["#FF5C3A", "#FFC24B"], { angle: 60 }) },
  { word: "COMPOSE", fill: linearGradient(["#9B7CFF", "#2A1E5C"], { angle: 120 }) },
  { word: "REFRAME", fill: linearGradient(["#00C2A8", "#3AA0FF"], { angle: 60 }) },
  { word: "RENDER",  fill: linearGradient(["#FF4D6D", "#7C5CFF"], { angle: 90 }) },
];
const n = CARDS.length;

// One card = a group `shot-${i}` (full-frame gradient rect + the word), centred on the
// frame and hidden (opacity 0) until its beat plays. Scaling the group scales about the
// frame centre, so the 1.06 Ken Burns never reveals an edge.
const cardNode = (i: number, c: Card): NodeIR =>
  group({ id: `shot-${i}`, x: W / 2, y: H / 2, opacity: 0, scale: 1 }, [
    rect({ id: `shot-${i}-rect`, x: 0, y: 0, width: W, height: H, anchor: "center", fill: c.fill }),
    text({ id: `shot-${i}-title`, x: 0, y: 0, anchor: "center", content: c.word,
      fontFamily: "Inter", fontSize: 200, fontWeight: 800, fill: "#FFFFFF", letterSpacing: 6 }),
  ]);

// One card's motion: a self-contained named beat. Its NAME is the stable `shot-${i}`
// address; every interior tween is labelled, so the motion is fully addressable and
// lint-clean. Adjacent cards overlap by `gap: -CROSS` so the outgoing fade-out and the
// incoming fade-in cross.
const cardBeat = (i: number): TimelineIR =>
  beat(`shot-${i}`, { nodes: [`shot-${i}`], parallel: true, ...(i > 0 && { gap: -CROSS }) }, [
    tween(`shot-${i}`, { opacity: 1 }, { duration: CROSS, ease: "linear", label: `shot-${i}-in` }),
    tween(`shot-${i}`, { scale: 1.06 }, { duration: HOLD, ease: "easeInOutQuad", label: `shot-${i}-kb` }),
    seq(
      wait(HOLD - CROSS),
      tween(`shot-${i}`, { opacity: 0 }, { duration: CROSS, ease: "linear",
        label: i < n - 1 ? `cross-${i + 1}` : `shot-${i}-out` }),
    ),
  ]);

export default scene({
  id: "vector-montage",
  size: { width: W, height: H },
  fps: 30,
  background: "#06070C",
  nodes: [
    ...CARDS.map((c, i) => cardNode(i, c)),
    // static cinematic vignette on top (no motion — purely a grade)
    rect({ id: "vignette", x: 0, y: 0, width: W, height: H,
      fill: radialGradient([{ offset: 0.55, color: "#FFFFFF" }, { offset: 1, color: "#5A5A5A" }],
        { cx: 0.5, cy: 0.5, r: 0.75 }),
      blend: "multiply" }),
  ],
  // The shots are the DIRECT children of the "montage" beat (a beat groups its children
  // as a seq), so the play-order list is addressable as the beat "montage": an overlay
  // can `insertTimeline { into: "montage", ... }`, and reorder / removeTimeline operate
  // on these same `shot-${i}` beats.
  timeline: seq(beat("montage", { nodes: CARDS.map((_, i) => `shot-${i}`) }, CARDS.map((_, i) => cardBeat(i)))),
});
