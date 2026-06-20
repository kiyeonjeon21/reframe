// One continuous line that draws itself into a human figure.
// Proof: reframe can render a "person" that reads as designed, not crude —
// the trick is a single symmetric silhouette outline (mirrored in code,
// smoothed with Catmull-Rom) drawn on via `progress`, never a pile of shapes.

import {
  scene, group, rect, text, path,
  seq, par, tween, wait, oscillate,
} from "@reframe/core";

// --- geometry -------------------------------------------------------------
// Right half of a standing figure, top-of-head -> crotch (x >= 0, y down).
// Symmetry (the thing that separates "intentional" from "crude") is free:
// the left half is this list, mirrored and reversed, in pure code.
const RIGHT: [number, number][] = [
  [0, -220], [34, -200], [41, -171], [24, -146], [16, -128],
  [42, -112], [71, -103], [78, -58], [80, -8], [73, 19],
  [57, 12], [50, -30], [46, -86], [39, -38], [33, 2],
  [47, 31], [49, 92], [42, 161], [40, 210], [42, 223],
  [9, 223], [13, 201], [17, 120], [10, 60], [2, 41],
];

// Build the closed ring: right side top->crotch, then the mirror crotch->top
// (drop the two on-axis endpoints so they aren't duplicated at the seam).
const LEFT = RIGHT.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number]);
const RING = [...RIGHT, ...LEFT];

// Closed Catmull-Rom -> cubic beziers. Pure math, deterministic.
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length;
  const at = (i: number): [number, number] => pts[((i % n) + n) % n]!;
  let d = `M ${at(0)[0].toFixed(1)} ${at(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0x, p0y] = at(i - 1);
    const [p1x, p1y] = at(i);
    const [p2x, p2y] = at(i + 1);
    const [p3x, p3y] = at(i + 2);
    const c1x = p1x + (p2x - p0x) / 6, c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6, c2y = p2y - (p3y - p1y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
  }
  return d + " Z";
}

const FIGURE_D = smoothClosed(RING);

const BG = "#0A0E1A";
const ACC = "#FF5A1F";
const CX = 960, CY = 560;

// glow copy (thick, soft) + crisp line copy — both share the same draw-on
const figure = (id: string, stroke: string, w: number, opacity: number) =>
  path({
    id, d: FIGURE_D, x: CX, y: CY, originX: 0, originY: 0, scale: 1.65,
    fill: "none", stroke, strokeWidth: w, opacity, progress: 0,
  });

export default scene({
  id: "one-line-figure",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    // faint radial-ish wash so the figure sits in atmosphere, not a void
    rect({ id: "wash", x: CX, y: CY - 40, width: 1400, height: 1400, radius: 700, fill: "#121A30", opacity: 0.5, anchor: "center" }),
    rect({ id: "wash2", x: CX, y: CY - 40, width: 820, height: 820, radius: 410, fill: "#17213B", opacity: 0.5, anchor: "center" }),
    figure("glow", ACC, 22, 0.16),
    figure("line", "#FFE3D2", 5, 1),
    rect({ id: "ground", x: CX, y: CY + 384, width: 0, height: 3, radius: 2, fill: "#2A3550", anchor: "center" }),
    group({ id: "cap", x: CX, y: 1000, opacity: 0 }, [
      text({ id: "cap-t", x: 0, y: 0, content: "one path. drawn on.", fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: "#7E8AA8", anchor: "center" }),
    ]),
  ],
  timeline: seq(
    wait(0.3),
    par(
      tween("glow", { progress: 1 }, { duration: 2.4, ease: "easeInOutCubic" }),
      tween("line", { progress: 1 }, { duration: 2.4, ease: "easeInOutCubic" }),
      seq(wait(0.5), tween("ground", { width: 520 }, { duration: 1.1, ease: "easeOutCubic" })),
    ),
    par(
      tween("cap", { opacity: 1, y: 968 }, { duration: 0.7, ease: "easeOutCubic" }),
    ),
    wait(1.6),
  ),
  behaviors: [
    // a slow breath once it's drawn, so it feels alive, not a static logo
    oscillate("line", "scale", { amplitude: 0.012, frequency: 0.3 }, { from: 2.9, ramp: 0.6 }),
    oscillate("glow", "scale", { amplitude: 0.012, frequency: 0.3 }, { from: 2.9, ramp: 0.6 }),
    oscillate("glow", "opacity", { amplitude: 0.05, frequency: 0.5 }, { from: 2.9, ramp: 0.6 }),
  ],
});
