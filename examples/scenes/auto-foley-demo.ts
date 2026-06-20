import {
  scene, rect, text,
  seq, par, stagger, tween, wait,
  row,
} from "@reframe/core";

// autoFoley — the animation scores ITSELF. There is NOT a single manual audio cue
// in this scene: `audio: { autoFoley: true }` watches the motion and emits the
// sound. The panel slides in and lands (whoosh → thud), three cards pop in across
// the frame (pops, panned L→R), and a chip swipes past (swish). Retime any of it
// and the sound follows, because the cues are re-derived from the motion.

const W = 1920, H = 1080;
const cardX = row(3, { center: 960, span: 760 });

export default scene({
  id: "auto-foley-demo",
  size: { width: W, height: H },
  fps: 30,
  background: "#0B0E16",
  nodes: [
    text({ id: "title", x: 120, y: 110, anchor: "top-left", content: "autoFoley — the motion scores itself", fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: "#EAF0FF", letterSpacing: 1, opacity: 0 }),
    // a big panel that slides in from the left and settles
    rect({ id: "panel", x: -400, y: 380, width: 680, height: 200, radius: 20, anchor: "center", fill: "#19223A", stroke: "#2A3550", strokeWidth: 2 }),
    text({ id: "panel-t", x: -400, y: 380, anchor: "center", content: "slide + settle", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: "#7FB6FF", opacity: 0 }),
    // three cards that pop in across the frame (panned left → centre → right)
    ...cardX.flatMap((x, i) => [
      rect({ id: `card-${i}`, x, y: 700, width: 220, height: 260, radius: 18, anchor: "center", fill: ["#54D6C0", "#7C5CFF", "#FFC861"][i]!, scale: 0 }),
    ]),
    // a small chip that swipes fast across the bottom
    rect({ id: "chip", x: -120, y: 980, width: 80, height: 48, radius: 24, anchor: "center", fill: "#FF6FA5", opacity: 0 }),
    text({ id: "wm", x: W - 40, y: H - 36, anchor: "center-right", content: "made with reframe · no manual cues", fontFamily: "Inter", fontSize: 19, fontWeight: 600, fill: "#2A3550", fixed: true }),
  ],

  timeline: seq(
    tween("title", { opacity: 1 }, { duration: 0.5 }),
    wait(0.3),
    // slide in + land
    par(
      tween("panel", { x: 520 }, { duration: 0.6, ease: "easeOutCubic" }),
      tween("panel-t", { x: 520, opacity: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
    ),
    wait(0.6),
    // cards pop in, staggered across the frame
    stagger(0.32, ...cardX.map((_, i) => tween(`card-${i}`, { scale: 1 }, { duration: 0.3, ease: "easeOutBack" }))),
    wait(0.5),
    // a fast swipe
    par(
      tween("chip", { opacity: 1 }, { duration: 0.05 }),
      tween("chip", { x: 2040 }, { duration: 0.22, ease: "easeInQuad" }),
    ),
    wait(1.2),
  ),

  audio: {
    autoFoley: true,
    bgm: { synth: "lofi", gain: 0.1, fadeIn: 1.0, fadeOut: 1.2, duck: { depth: 0.4 } },
  },
});
