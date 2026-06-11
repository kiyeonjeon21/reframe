#!/usr/bin/env tsx
/**
 * Generates the placeholder frames for examples/scenes/glyph-reveal.ts:
 * ten archival-paper cards, each rendering the same big "R" glyph in a
 * different muted material style. Deterministic (seeded speckles), so
 * re-running reproduces identical PNGs. Real usage replaces these with
 * AI-generated frames — the scene only cares that the files exist.
 *
 *   npx tsx packages/render-cli/scripts/gen-glyph-frames.ts
 */

import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "examples", "scenes", "glyph-frames");

const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) => fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

// per-frame palette: [paper, ink, accent]
const STYLES: [string, string, string][] = [
  ["#F2E8D5", "#2B2118", "#8A3B2E"], // aged botanical
  ["#E8DCC4", "#1F2937", "#9C4A31"], // postage
  ["#F5EFDC", "#111111", "#B0252A"], // spectral chart
  ["#EFE6CF", "#0F172A", "#28527A"], // city map
  ["#E9DFC8", "#241C12", "#6B4F2A"], // mechanical
  ["#10304E", "#E8F0FF", "#7FB3FF"], // blueprint
  ["#123A5C", "#F0F6FF", "#9FC6E8"], // cyanotype
  ["#F4ECD9", "#202020", "#B91C1C"], // red dot grid
  ["#1A1714", "#EDE3CC", "#C2803F"], // dark flat-lay
  ["#F1E9D4", "#17120C", "#3F6212"], // herbarium
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 480, height: 600 } });
  for (let i = 0; i < STYLES.length; i++) {
    const [paper, ink, accent] = STYLES[i]!;
    const speckles = Array.from({ length: 90 }, (_, j) => {
      const x = rand(j, i * 7 + 1) * 480;
      const y = rand(j, i * 7 + 2) * 600;
      const r = 0.6 + rand(j, i * 7 + 3) * 1.8;
      const o = 0.05 + rand(j, i * 7 + 4) * 0.12;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${ink}" opacity="${o.toFixed(2)}"/>`;
    }).join("");
    await page.setContent(`<style>
      body { margin:0; width:480px; height:600px; background:${paper}; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
      svg.grain { position:absolute; inset:0; }
      .glyph { font:700 360px Georgia, serif; color:${ink}; position:relative; line-height:1; }
      .glyph::after { content:""; position:absolute; left:-14px; right:-14px; bottom:18px; height:10px; background:${accent}; opacity:.7; }
      .tag { position:absolute; bottom:14px; right:18px; font:12px Georgia, serif; color:${ink}; opacity:.55; letter-spacing:1px; }
      .rule { position:absolute; top:22px; left:22px; right:22px; height:1px; background:${ink}; opacity:.28; }
    </style><body>
      <svg class="grain" width="480" height="600">${speckles}</svg>
      <div class="rule"></div>
      <div class="glyph">R</div>
      <div class="tag">PLATE ${String(i + 1).padStart(2, "0")} / 10</div>
    </body>`);
    await page.screenshot({ path: join(OUT, `frame-${i}.png`) });
  }
  await browser.close();
  console.log(`wrote ${STYLES.length} frames to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
