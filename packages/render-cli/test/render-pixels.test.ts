/**
 * Pixel-level render correctness — the half the determinism goldens don't cover.
 *
 * `golden.test.ts` snapshots the DisplayList (compile/evaluate); `frame.test.ts`
 * only checks "valid PNG + differs over t". Neither catches a bug BELOW the
 * DisplayList line, in renderer-canvas's actual Canvas draw — a broken gradient
 * mapping, a black matte composite, or the `fill:"none"`→black backdrop regression
 * we just fixed all produce a determinism-stable but visually-wrong frame.
 *
 * These tests render a real frame through Chromium and assert *semantic* pixel
 * properties (loose inequalities / colour ranges over a node's region), NOT
 * byte-exact snapshots. That's deliberately machine-independent: transcendental
 * eases differ by a last ULP across libm and Chromium rasterizes slightly
 * differently per platform (see golden.test.ts:10-16), so an exact pixel hash
 * would have to be skipped in CI. Inequalities survive that, so these run in CI.
 *
 * Region geometry comes from `sceneGeometry` (the spatial-query primitive) so we
 * sample where a node actually is rather than hardcoding coordinates. Pixels are
 * decoded from the PNG with ffmpeg (already a system dep), avoiding a PNG-decode
 * dependency.
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  compileScene,
  sceneGeometry,
  scene,
  group,
  rect,
  ellipse,
  type Bounds,
  type SceneIR,
} from "@reframe/core";
import { renderFrameAt } from "../src/frameLoop.js";
import liquidGlass from "../../../examples/scenes/liquid-glass.js";
import gradientDemo from "../../../examples/scenes/gradient-demo.js";
import groupFxDemo from "../../../examples/scenes/group-fx-demo.js";

const TIMEOUT = 60_000;

/** Decode a PNG buffer to a flat rgb24 byte array (3 bytes/pixel) via ffmpeg. */
function decodeRgb(png: Buffer, width: number, height: number): Buffer {
  const res = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { input: png, maxBuffer: 256 * 1024 * 1024 },
  );
  if (res.status !== 0) {
    throw new Error(
      `ffmpeg decode failed: ${res.stderr?.toString() ?? res.error?.message ?? "unknown"}`,
    );
  }
  const out = res.stdout;
  if (out.length !== width * height * 3) {
    throw new Error(
      `unexpected decoded size ${out.length}, expected ${width * height * 3} (${width}x${height})`,
    );
  }
  return out;
}

interface RegionStats {
  meanR: number;
  meanG: number;
  meanB: number;
  meanLuma: number;
  lumaStd: number;
  count: number;
}

/** Mean RGB/luma + luma std-dev over a pixel rectangle (clamped to the image). */
function sampleRect(rgb: Buffer, imgW: number, imgH: number, r: Bounds): RegionStats {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(imgW, Math.ceil(r.x + r.w));
  const y1 = Math.min(imgH, Math.ceil(r.y + r.h));
  let sR = 0,
    sG = 0,
    sB = 0,
    sL = 0,
    sL2 = 0,
    n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * imgW + x) * 3;
      const cr = rgb[i]!,
        cg = rgb[i + 1]!,
        cb = rgb[i + 2]!;
      const luma = 0.299 * cr + 0.587 * cg + 0.114 * cb;
      sR += cr;
      sG += cg;
      sB += cb;
      sL += luma;
      sL2 += luma * luma;
      n++;
    }
  }
  if (n === 0) throw new Error("empty sample region");
  const meanLuma = sL / n;
  return {
    meanR: sR / n,
    meanG: sG / n,
    meanB: sB / n,
    meanLuma,
    lumaStd: Math.sqrt(Math.max(0, sL2 / n - meanLuma * meanLuma)),
    count: n,
  };
}

/** Inset a bounds rectangle by a fraction on every side (avoid edges/anti-aliasing). */
function inset(b: Bounds, frac: number): Bounds {
  return {
    x: b.x + b.w * frac,
    y: b.y + b.h * frac,
    w: b.w * (1 - 2 * frac),
    h: b.h * (1 - 2 * frac),
  };
}

/** Bounds of a node OR group id from the scene geometry at time t. */
function regionOf(ir: SceneIR, id: string, t: number): Bounds {
  const geo = sceneGeometry(compileScene(ir), t);
  const node = geo.nodes.find((n) => n.id === id) ?? geo.groups.find((g) => g.id === id);
  if (!node) throw new Error(`no geometry for "${id}" at t=${t}`);
  return node.bounds;
}

async function render(ir: SceneIR, t: number): Promise<{ rgb: Buffer; w: number; h: number }> {
  const png = await renderFrameAt(ir, t);
  const { width: w, height: h } = ir.size;
  return { rgb: decodeRgb(png, w, h), w, h };
}

describe("pixel-level render correctness", () => {
  it(
    "liquid-glass: the backdrop panel is see-through (bright + varied), not a black fill",
    async () => {
      // t after the card has fully opened; the live backdrop samples the drifting blobs.
      const t = 2.5;
      const { rgb, w, h } = await render(liquidGlass, t);
      const panel = sampleRect(rgb, w, h, inset(regionOf(liquidGlass, "card", t), 0.18));
      // The `fill:"none"`→black bug rendered the whole panel near-black; the backdrop
      // makes it bright. Loose floor, machine-independent.
      expect(panel.meanLuma).toBeGreaterThan(30);
      // It samples the blurred colourful blobs (not a flat fill) → real variance.
      expect(panel.lumaStd).toBeGreaterThan(5);
    },
    TIMEOUT,
  );

  it(
    "gradient-demo: a linear-gradient fill actually varies across the shape",
    async () => {
      const t = 1.4; // card-a has popped in
      const { rgb, w, h } = await render(gradientDemo, t);
      const b = regionOf(gradientDemo, "a", t); // rect: linearGradient #FF5C3A → #FFC24B @ 60°
      // sample two opposite quadrants along the gradient diagonal
      const tl = sampleRect(rgb, w, h, {
        x: b.x + b.w * 0.1,
        y: b.y + b.h * 0.1,
        w: b.w * 0.25,
        h: b.h * 0.25,
      });
      const br = sampleRect(rgb, w, h, {
        x: b.x + b.w * 0.65,
        y: b.y + b.h * 0.65,
        w: b.w * 0.25,
        h: b.h * 0.25,
      });
      // both stops are red (R~255); the green channel separates them (0x5C vs 0xC2).
      expect(Math.abs(tl.meanG - br.meanG)).toBeGreaterThan(25);
    },
    TIMEOUT,
  );

  it(
    "group-fx-demo: a group composited offscreen renders its content (not blank)",
    async () => {
      const t = 1.5; // lockup is sharp (group blur ~0); shares the matte offscreen path
      const { rgb, w, h } = await render(groupFxDemo, t);
      const lockup = sampleRect(rgb, w, h, inset(regionOf(groupFxDemo, "lk-card", t), 0.15));
      // bg is #0A0C14 (luma ~11); the lockup card is a bright purple→blue gradient.
      expect(lockup.meanLuma).toBeGreaterThan(40);
    },
    TIMEOUT,
  );

  it(
    "alpha matte: content shows inside the mask and is cut away outside it",
    async () => {
      // pure-shape alpha matte (no assets): an ellipse masks a solid pink fill.
      // Guards the offscreen matte composite (destination-in) directly.
      const matteScene = scene({
        id: "matte-pixeltest",
        size: { width: 800, height: 600 },
        fps: 30,
        duration: 1, // static; no timeline needed
        background: "#000000",
        nodes: [
          group({ id: "m", x: 0, y: 0, matte: "alpha" }, [
            ellipse({
              id: "mask",
              x: 400,
              y: 300,
              width: 320,
              height: 320,
              anchor: "center",
              fill: "#FFFFFF",
            }),
            rect({ id: "content", x: 0, y: 0, width: 800, height: 600, fill: "#FF3D6E" }),
          ]),
        ],
      });
      const t = 0;
      const { rgb, w, h } = await render(matteScene, t);
      const inside = sampleRect(rgb, w, h, { x: 360, y: 260, w: 80, h: 80 });
      const outside = sampleRect(rgb, w, h, { x: 20, y: 20, w: 80, h: 80 });
      expect(inside.meanR).toBeGreaterThan(120); // pink content visible inside the mask
      expect(inside.meanLuma).toBeGreaterThan(outside.meanLuma + 40); // cut away outside
    },
    TIMEOUT,
  );
});
