import {
  scene,
  group,
  rect,
  text,
  seq,
  par,
  tween,
  wait,
  wiggle,
  oscillate,
  type NodeIR,
  type BehaviorIR,
} from "@reframe/core";

// "SIGNAL LOST" — an analog/VHS glitch title built only from blend modes + wiggle.
// Chromatic aberration = three RGB copies of the wordmark on `blend:"screen"`
// (they fuse to white where aligned, fringe where offset). Scanlines on a dark
// `multiply` overlay, a bright tracking band sweeping down on `screen`, and
// seeded `wiggle` x-jitter + `blur` flicker sell the broken-tape feel.
// Probes: creative blend stacking, object-level wiggle, analog aesthetic (genre = 0 scenes).

const CX = 960;
const CY = 470;
const WORD = "SIGNAL";
const FS = 200;

// three colour channels, each its own node so we can offset them independently
const channel = (id: string, fill: string, dx: number): NodeIR =>
  text({
    id,
    x: CX + dx,
    y: CY,
    anchor: "center",
    content: WORD,
    fontFamily: "Inter",
    fontSize: FS,
    fontWeight: 800,
    fill,
    blend: "screen",
    opacity: 0,
  });

// scanlines — many thin dark bars, multiplied over everything
const SCAN = Array.from({ length: 68 }, (_, i) =>
  rect({
    id: `scan-${i}`,
    x: 0,
    y: i * 16,
    width: 1920,
    height: 8,
    anchor: "top-left",
    fill: "#000000",
    blend: "multiply",
    opacity: 0.35,
  }),
);

export default scene({
  id: "glitch-vhs",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0A0410",
  nodes: [
    // faint magenta/cyan wash so screen-blend has something to bite
    rect({ id: "wash", x: 0, y: 0, width: 1920, height: 1080, anchor: "top-left", fill: "#140A2A" }),
    group({ id: "title", x: 0, y: 0 }, [
      channel("ch-r", "#FF0033", -6),
      channel("ch-g", "#00FF66", 0),
      channel("ch-b", "#2266FF", 6),
    ]),
    text({
      id: "sub",
      x: CX,
      y: 600,
      anchor: "center",
      content: "▚ TRACKING  ◦  NO SIGNAL  ◦  PLAY ▶",
      fontFamily: "Inter",
      fontSize: 30,
      fontWeight: 700,
      fill: "#9A6CFF",
      letterSpacing: 8,
      blend: "screen",
      opacity: 0,
    }),
    ...SCAN,
    // tracking band that sweeps down the frame
    rect({
      id: "track",
      x: 0,
      y: -80,
      width: 1920,
      height: 70,
      anchor: "top-left",
      fill: "#FFFFFF",
      blend: "screen",
      opacity: 0.10,
    }),
  ],

  timeline: seq(
    wait(0.2),
    // power-on: channels snap in, slightly mis-registered
    par(
      tween("ch-r", { opacity: 0.9 }, { duration: 0.18, ease: "easeOutQuad", label: "on" }),
      tween("ch-g", { opacity: 0.9 }, { duration: 0.22, ease: "easeOutQuad" }),
      tween("ch-b", { opacity: 0.9 }, { duration: 0.26, ease: "easeOutQuad" }),
    ),
    wait(0.5),
    // a hard glitch: channels jolt apart then snap back
    seq(
      par(
        tween("ch-r", { x: CX - 34 }, { duration: 0.08, ease: "easeOutQuad", label: "tear" }),
        tween("ch-b", { x: CX + 30 }, { duration: 0.08, ease: "easeOutQuad" }),
      ),
      par(
        tween("ch-r", { x: CX - 6 }, { duration: 0.12, ease: "easeOutBack" }),
        tween("ch-b", { x: CX + 6 }, { duration: 0.12, ease: "easeOutBack" }),
      ),
    ),
    tween("sub", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "sub" }),
    wait(2.0, "hold"),
    // settle: channels converge to clean white (all three overlap)
    par(
      tween("ch-r", { x: CX }, { duration: 0.6, ease: "easeInOutCubic", label: "lock" }),
      tween("ch-b", { x: CX }, { duration: 0.6, ease: "easeInOutCubic" }),
    ),
    wait(1.2, "clean"),
    par(
      tween("title", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
      tween("sub", { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" }),
    ),
  ),

  behaviors: [
    // per-channel horizontal jitter (broken tracking) — seeded, different per channel
    wiggle("ch-r", "x", { amplitude: 7, frequency: 9, seed: 11 }, { from: 0.5, until: 4.4, ramp: 0.2 }),
    wiggle("ch-b", "x", { amplitude: 7, frequency: 11, seed: 23 }, { from: 0.5, until: 4.4, ramp: 0.2 }),
    // whole title vertical roll + blur flicker
    wiggle("title", "y", { amplitude: 5, frequency: 6, seed: 7 }, { from: 0.5, until: 4.4, ramp: 0.3 }),
    wiggle("title", "blur", { amplitude: 2.4, frequency: 12, seed: 41 }, { from: 0.5, until: 4.4, ramp: 0.3 }),
    // tracking band sweeps down on a slow loop
    oscillate("track", "y", { amplitude: 560, frequency: 0.22, phase: -1.57 }, { from: 0.0, until: 6.0 }),
  ] as BehaviorIR[],
});
