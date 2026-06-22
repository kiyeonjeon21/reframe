// figure() — one rig, swappable skins. Clean (corporate-flat / undraw) and cute
// (mascot), plus a one-line palette re-skin, each driven by the SAME
// characterPreset("wave"). The art is a skin; the rig + motion are the asset.

import {
  scene, ellipse, text,
  seq, par, tween, wait, oscillate,
  figure, characterPreset,
} from "@reframe/core";

const BG = "#0E1424";
const Y = 470, S = 1.35;

const ce = (id: string, x: number, y: number, d: number, fill: string, opacity = 1) =>
  ellipse({ id, x, y, width: d, height: d, fill, opacity, anchor: "center" });
const shadow = (id: string, x: number) => ellipse({ id, x, y: 828, width: 170, height: 26, fill: "#000000", opacity: 0.26, anchor: "center" });
const label = (id: string, x: number, s: string) => text({ id, x, y: 900, content: s, fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: "#8A94AC", anchor: "center" });

const COLS = [
  { id: "clean", x: 480, scene_label: "clean" },
  { id: "blue", x: 960, scene_label: "clean · re-skinned" },
  { id: "cute", x: 1440, scene_label: "cute" },
];

export default scene({
  id: "figure-styles",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    ce("wash", 960, 450, 1700, "#15203A", 0.4),
    ...COLS.map((c) => shadow(`sh-${c.id}`, c.x)),
    figure({ id: "clean", style: "clean", x: 480, y: Y, scale: S, opacity: 0 }),
    figure({ id: "blue", style: "clean", x: 960, y: Y, scale: S, opacity: 0, palette: { accent: "#3B82F6" } }),
    figure({ id: "cute", style: "cute", x: 1440, y: Y, scale: S, opacity: 0 }),
    ...COLS.map((c) => label(`lb-${c.id}`, c.x, c.scene_label)),
  ],
  timeline: seq(
    wait(0.2),
    par(...COLS.map((c, i) => seq(wait(i * 0.12), tween(c.id, { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })))),
    wait(0.2),
    par(...COLS.map((c, i) => seq(wait(i * 0.15), characterPreset("wave", { target: c.id, label: `wave-${c.id}` })))),
    wait(1.4),
  ),
  behaviors: COLS.map((c) => oscillate(`${c.id}-chest`, "scaleY", { amplitude: 0.012, frequency: 0.65 }, { from: 0.8, ramp: 0.6 })),
});
