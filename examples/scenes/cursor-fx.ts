// Cursor showcase: an arrow pointer arcs between buttons and clicks each one
// (tap + ripple + the button presses). cursor() + cursorTo() + cursorClick().

import {
  scene, group, rect, text,
  seq, tween, wait,
  cursor, cursorTo, cursorClick,
  brand,
} from "@reframe/core";

const BG = brand.color.bg;
const ACC = brand.color.accent;

interface Btn { id: string; x: number; y: number; label: string }
const BTNS: Btn[] = [
  { id: "b1", x: 560, y: 380, label: "Move" },
  { id: "b2", x: 1340, y: 320, label: "Arc" },
  { id: "b3", x: 980, y: 760, label: "Click" },
];
const button = (b: Btn) =>
  group({ id: `${b.id}-g`, x: b.x, y: b.y, scale: 1 }, [
    rect({ id: b.id, x: 0, y: 0, width: 230, height: 84, radius: 16, fill: "#1A2030", stroke: "#2E3850", strokeWidth: 2, anchor: "center" }),
    text({ id: `${b.id}-t`, x: 0, y: 0, content: b.label, fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: "#E7ECF5", anchor: "center" }),
  ]);

const START: [number, number] = [300, 220];
let pos = START;
const steps = [wait(0.3), tween("cur", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic" })];
for (const b of BTNS) {
  steps.push(cursorTo("cur", pos, [b.x, b.y]));
  pos = [b.x, b.y];
  steps.push(cursorClick("cur", { press: `${b.id}-g`, label: `click-${b.id}` }));
  steps.push(wait(0.5));
}

export default scene({
  id: "cursor-fx",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    ...BTNS.map(button),
    cursor({ id: "cur", x: START[0], y: START[1], opacity: 0, accent: ACC }),
    text({ id: "sub", x: 960, y: 1010, content: "cursor() + cursorTo() + cursorClick()", fontFamily: "Inter", fontSize: 24, fontWeight: 600, fill: "#5C6477", anchor: "center" }),
  ],
  timeline: seq(...steps, wait(0.6)),
});
