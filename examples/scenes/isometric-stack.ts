import {
  scene,
  group,
  path,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  oscillate,
  type NodeIR,
} from "@reframe/core";

// "Uptime" — an isometric skyline built from plain 2D polygons. There's no 3D
// engine: each prism is three `path` faces whose corners are the iso projection
// `(x,y,h) → ( (gx-gy)·TW , (gx+gy)·TH − h )`, shaded top/left/right for a fixed
// light. Blocks drop in back-to-front with an `easeOutBack` overshoot, then idle
// on a slow `oscillate`. Probes: skew-free pseudo-3D iso layout (genre = 0 scenes).

const CX = 960;
const CY = 430;
const TW = 84; // half tile width
const TH = 42; // half tile height
const GRID = 5;

// data-driven heights: a smooth bump so it reads as a landscape/skyline
const heightAt = (gx: number, gy: number) => {
  const dx = gx - (GRID - 1) / 2;
  const dy = gy - (GRID - 1) / 2;
  const d = Math.sqrt(dx * dx + dy * dy);
  return 40 + Math.max(0, 230 - d * 70);
};

const poly = (pts: [number, number][]) =>
  "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";

type Block = { gx: number; gy: number; nodes: NodeIR[]; id: string };
const blocks: Block[] = [];
for (let gx = 0; gx < GRID; gx++) {
  for (let gy = 0; gy < GRID; gy++) {
    const h = heightAt(gx, gy);
    const bx = CX + (gx - gy) * TW;
    const by = CY + (gx + gy) * TH;
    const top = by - h; // top-face centre y
    // hue ramps with height (cool low → warm high)
    const u = Math.min(1, (h - 40) / 230);
    const topC = u > 0.55 ? "#FFC861" : "#6EA8FF";
    const id = `b-${gx}-${gy}`;
    blocks.push({
      gx,
      gy,
      id,
      nodes: [
        // left face (darkest)
        path({ id: `${id}-l`, x: 0, y: 0, d: poly([[bx - TW, by], [bx, by + TH], [bx, top + TH], [bx - TW, top]]), fill: "#243049", originX: bx, originY: by }),
        // right face (mid)
        path({ id: `${id}-r`, x: 0, y: 0, d: poly([[bx, by + TH], [bx + TW, by], [bx + TW, top], [bx, top + TH]]), fill: "#33476B", originX: bx, originY: by }),
        // top face (lightest, hue by height)
        path({ id: `${id}-t`, x: 0, y: 0, d: poly([[bx, top - TH], [bx + TW, top], [bx, top + TH], [bx - TW, top]]), fill: topC, originX: bx, originY: by }),
      ],
    });
  }
}
// painter's order: back (small gx+gy) first so nearer blocks occlude farther
blocks.sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

export default scene({
  id: "isometric-stack",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#0B1020",
  nodes: [
    ...blocks.map((b) => group({ id: b.id, x: 0, y: -380, opacity: 0 }, b.nodes)),
    text({ id: "title", x: 120, y: 110, anchor: "top-left", content: "UPTIME", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#EAF0FF", opacity: 0 }),
    text({ id: "sub", x: 122, y: 188, anchor: "top-left", content: "isometric · 75 polygons · pure 2D projection", fontFamily: "Inter", fontSize: 24, fill: "#7E88A8", opacity: 0 }),
  ],

  timeline: seq(
    wait(0.3),
    par(
      tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "title" }),
      seq(wait(0.2), tween("sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" })),
    ),
    // build the city back-to-front, each block dropping in with overshoot
    stagger(
      0.05,
      ...blocks.map((b) =>
        tween(b.id, { y: 0, opacity: 1 }, { duration: 0.55, ease: "easeOutBack", label: `drop-${b.gx}-${b.gy}` }),
      ),
    ),
    wait(2.4, "idle"),
    par(...blocks.map((b) => tween(b.id, { opacity: 0, y: -120 }, { duration: 0.5, ease: "easeInQuad" }))),
  ),

  behaviors: [
    // gentle staggered float during the hold — the skyline breathes
    ...blocks.map((b) =>
      oscillate(b.id, "y", { amplitude: 5, frequency: 0.4, phase: (b.gx + b.gy) * 0.5 }, { from: 4.0, until: 6.4, ramp: 0.5 }),
    ),
  ],
});
