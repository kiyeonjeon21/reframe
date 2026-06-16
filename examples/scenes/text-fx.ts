// Kinetic text showcase: splitText() + the textIn / textLoop / textOut library.
// Each phrase names the effect animating it. One line of code per phrase.

import {
  scene, text, seq, wait,
  splitText, textIn, textLoop, textOut,
  type BehaviorIR, type TextInName, type TextOutName, type TextLoopName, type TimelineIR,
} from "@reframe/core";

const BG = "#0B0D12";
const CX = 960, CY = 500, FS = 120;

interface Item { id: string; text: string; in: TextInName; out: TextOutName; loop?: TextLoopName }
const ITEMS: Item[] = [
  { id: "p1", text: "TYPEWRITER", in: "typewriter", out: "fly" },
  { id: "p2", text: "CASCADE WAVE", in: "cascade", out: "shatter", loop: "wave" },
  { id: "p3", text: "BOUNCE", in: "bounce", out: "fall" },
  { id: "p4", text: "ASSEMBLE", in: "assemble", out: "collapse" },
  { id: "p5", text: "DECODE", in: "decode", out: "dissolve", loop: "wobble" },
];

// exact beat durations (sp=1) so loop windows line up with the holds
const IN_DUR: Record<TextInName, [number, number]> = { // [per-glyph interval, longest glyph chain]
  typewriter: [0.065, 0.04], cascade: [0.04, 0.341], rise: [0.03, 0.401],
  bounce: [0.045, 0.701], assemble: [0.05, 0.801], decode: [0.05, 0.40],
};
const OUT_DUR: Record<TextOutName, [number, number]> = {
  fly: [0.012, 0.6], shatter: [0.02, 0.7], dissolve: [0, 0.9], fall: [0.02, 0.8], collapse: [0.02, 0.5],
};
const beatLen = ([interval, chain]: [number, number], n: number) => (n - 1) * interval + chain;

const HOLD = 1.8, GAP = 0.4;
const blocks = ITEMS.map((it) => splitText(it.text, { id: it.id, x: CX, y: CY, fontSize: FS, fontWeight: 800 }));

const steps: TimelineIR[] = [wait(0.3)];
const behaviors: BehaviorIR[] = [];
let t = 0.3;
ITEMS.forEach((it, i) => {
  const T = blocks[i]!;
  steps.push(textIn(it.in, T));
  t += beatLen(IN_DUR[it.in], T.glyphs.length);
  if (it.loop) behaviors.push(...textLoop(it.loop, T, { from: t, until: t + HOLD, ramp: 0.4 }));
  steps.push(wait(HOLD));
  t += HOLD;
  steps.push(textOut(it.out, T));
  t += beatLen(OUT_DUR[it.out], T.glyphs.length) + GAP;
  steps.push(wait(GAP));
});

export default scene({
  id: "text-fx",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    ...blocks.flatMap((b) => b.nodes),
    text({ id: "sub", x: CX, y: 940, content: "splitText() + textIn / textLoop / textOut", fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: "#5C6477", anchor: "center" }),
  ],
  timeline: seq(...steps),
  behaviors,
});
