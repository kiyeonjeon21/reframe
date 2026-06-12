#!/usr/bin/env tsx
/**
 * Generates the plates for examples/scenes/glyph-reveal.ts: the same "R"
 * glyph built in archival material styles (dot grid, spectral chart,
 * blueprint, map negative-space, cyanotype, circuit x-ray, ...) — SVG
 * recreations of the styles that work procedurally. Deterministic seeds.
 * Real usage replaces these with AI-generated plates; the scene only
 * cares that the files exist.
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

const W = 480, H = 600;

// the R's stroke skeleton as polylines (stem, bowl, leg) — objects placed
// along these trace the glyph the way the prompt-pack styles do
const SKELETON: [number, number][][] = [
  [[150, 140], [150, 485]],
  [[150, 150], [235, 138], [305, 152], [343, 200], [338, 252], [296, 292], [205, 305], [152, 300]],
  [[208, 308], [355, 485]],
];
/** n points along the skeleton with tangent angles (degrees). */
function skeletonPoints(n: number): { x: number; y: number; ang: number }[] {
  const segs: { x1: number; y1: number; x2: number; y2: number; len: number }[] = [];
  for (const line of SKELETON)
    for (let i = 0; i < line.length - 1; i++) {
      const [x1, y1] = line[i]!, [x2, y2] = line[i + 1]!;
      segs.push({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
    }
  const total = segs.reduce((a, b) => a + b.len, 0);
  const pts: { x: number; y: number; ang: number }[] = [];
  for (let k = 0; k < n; k++) {
    let d = ((k + 0.5) / n) * total;
    for (const sg of segs) {
      if (d <= sg.len) {
        const u = d / sg.len;
        pts.push({
          x: sg.x1 + (sg.x2 - sg.x1) * u,
          y: sg.y1 + (sg.y2 - sg.y1) * u,
          ang: (Math.atan2(sg.y2 - sg.y1, sg.x2 - sg.x1) * 180) / Math.PI,
        });
        break;
      }
      d -= sg.len;
    }
  }
  return pts;
}
// big glyph reused by every plate (Georgia serif R, centered)
const GLYPH = (fill: string, extra = "") =>
  `<text x="240" y="385" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="380" ${extra} fill="${fill}">R</text>`;
const CLIP = `<clipPath id="g">${GLYPH("#000").replace(/fill="[^"]*"/, "")}</clipPath>`;
const MASK_OUT = `<mask id="out"><rect width="${W}" height="${H}" fill="#fff"/>${GLYPH("#000")}</mask>`;

function speckle(n: number, salt: number, color: string, omax = 0.1): string {
  return Array.from({ length: n }, (_, j) =>
    `<circle cx="${(rand(j, salt) * W).toFixed(1)}" cy="${(rand(j, salt + 1) * H).toFixed(1)}" r="${(0.5 + rand(j, salt + 2) * 1.5).toFixed(2)}" fill="${color}" opacity="${(0.04 + rand(j, salt + 3) * omax).toFixed(2)}"/>`,
  ).join("");
}

function svg(body: string, bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
}

const plates: string[] = [];

// ── 01 · red dot grid on graph paper ───────────────────────────────────────
{
  const grid = Array.from({ length: 40 }, (_, i) =>
    `<line x1="${i * 12}" y1="0" x2="${i * 12}" y2="${H}" stroke="#C9CDD6" stroke-width="0.5"/><line x1="0" y1="${i * 12 + 6}" x2="${W}" y2="${i * 12 + 6}" stroke="#C9CDD6" stroke-width="0.5"/>`,
  ).join("");
  let dots = "";
  for (let gy = 0; gy < 50; gy++)
    for (let gx = 0; gx < 40; gx++) {
      const x = gx * 12 + 6, y = gy * 12 + 6;
      dots += `<circle cx="${x}" cy="${y}" r="${(3.2 + rand(gx * 50 + gy, 5) * 1.2).toFixed(1)}" fill="${rand(gx * 50 + gy, 9) > 0.12 ? "#B91C1C" : "#7F1D1D"}"/>`;
    }
  plates.push(svg(`${CLIP}${grid}<g clip-path="url(#g)">${dots}</g>${speckle(40, 11, "#475569")}<text x="24" y="36" font-family="Georgia" font-size="13" fill="#64748B" letter-spacing="2">FIG. 01 — SPECIMEN R</text>`, "#FAF7F0"));
}

// ── 02 · spectral analysis chart ───────────────────────────────────────────
{
  let bars = "";
  for (let row = 0; row < 75; row++) {
    const y = row * 8;
    let x = 0;
    while (x < W) {
      const w = 4 + rand(row * 97 + x, 21) * 22;
      if (rand(row * 31 + x, 22) > 0.3)
        bars += `<rect x="${x.toFixed(0)}" y="${y}" width="${w.toFixed(0)}" height="5.5" fill="#1A1714" opacity="${(0.78 + rand(row + x, 23) * 0.22).toFixed(2)}"/>`;
      x += w + 2.5;
    }
  }
  const bands = ["#B91C1C", "#C2803F", "#3F6212", "#28527A"].map((c, i) =>
    `<rect x="${70 + i * 96}" y="0" width="9" height="${H}" fill="${c}" opacity="0.5"/>`).join("");
  const labels = Array.from({ length: 9 }, (_, i) =>
    `<text x="${28 + i * 52}" y="582" font-family="Georgia" font-size="9" fill="#6B7280">${(380 + i * 41).toFixed(0)}nm</text>`).join("");
  plates.push(svg(`${CLIP}<g clip-path="url(#g)">${bars}${bands}</g>${labels}${speckle(50, 31, "#1A1714")}<line x1="20" y1="568" x2="460" y2="568" stroke="#1A1714" stroke-width="0.8"/>`, "#F4EEDD"));
}

// ── 03 · blueprint ─────────────────────────────────────────────────────────
{
  const ink = "#E8F0FF";
  let detail = "";
  for (let i = 0; i < 14; i++) {
    const y = 60 + i * 36;
    detail += `<line x1="40" y1="${y}" x2="440" y2="${y}" stroke="${ink}" stroke-width="0.35" opacity="0.35"/>`;
  }
  const dims = `
    <line x1="70" y1="480" x2="410" y2="480" stroke="${ink}" stroke-width="0.8"/>
    <line x1="70" y1="472" x2="70" y2="488" stroke="${ink}" stroke-width="0.8"/>
    <line x1="410" y1="472" x2="410" y2="488" stroke="${ink}" stroke-width="0.8"/>
    <text x="240" y="500" text-anchor="middle" font-family="Georgia" font-size="12" fill="${ink}">340.0</text>
    <circle cx="240" cy="240" r="150" fill="none" stroke="${ink}" stroke-width="0.4" opacity="0.5" stroke-dasharray="5 4"/>
    <line x1="240" y1="60" x2="240" y2="420" stroke="${ink}" stroke-width="0.4" opacity="0.5" stroke-dasharray="9 5"/>`;
  plates.push(svg(`${GLYPH("none", `stroke="${ink}" stroke-width="2.4"`)}${detail}${dims}<rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${ink}" stroke-width="1.4"/><text x="30" y="566" font-family="Georgia" font-size="12" fill="${ink}" letter-spacing="3">DWG R-06 · SECTION A–A</text>${speckle(60, 41, "#9FC6E8", 0.16)}`, "#10304E"));
}

// ── 04 · city map negative space ───────────────────────────────────────────
{
  let blocks = "";
  let i = 0;
  for (let y = 6; y < H - 6; ) {
    const rh = 10 + rand(i, 51) * 18;
    for (let x = 6; x < W - 6; ) {
      const rw = 10 + rand(i, 52) * 26;
      if (rand(i, 53) > 0.08)
        blocks += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(rw - 4).toFixed(0)}" height="${(rh - 4).toFixed(0)}" fill="none" stroke="#1F2937" stroke-width="1"/>` +
          (rand(i, 54) > 0.55 ? `<rect x="${(x + 4).toFixed(0)}" y="${(y + 4).toFixed(0)}" width="${Math.max(3, rw - 11).toFixed(0)}" height="${Math.max(3, rh - 11).toFixed(0)}" fill="#1F2937" opacity="0.22"/>` : "");
      x += rw; i++;
    }
    y += rh;
  }
  plates.push(svg(`${MASK_OUT}<g mask="url(#out)">${blocks}</g>${speckle(45, 61, "#1F2937")}<text x="452" y="582" text-anchor="end" font-family="Georgia" font-size="11" fill="#6B7280" letter-spacing="2">PLAN OF THE CITY · 1888</text>`, "#F2ECDB"));
}

// ── 05 · cyanotype ferns ───────────────────────────────────────────────────
{
  const frond = (cx: number, cy: number, ang: number, len: number, s: number) => {
    let f = `<g transform="translate(${cx},${cy}) rotate(${ang})"><line x1="0" y1="0" x2="0" y2="${-len}" stroke="#F0F6FF" stroke-width="1.6"/>`;
    const leaves = Math.floor(len / 7);
    for (let j = 0; j < leaves; j++) {
      const ly = -(j + 1) * (len / leaves);
      const ll = (1 - j / leaves) * 16 + 3;
      const sway = (rand(j, s) - 0.5) * 8;
      f += `<path d="M 0 ${ly} Q ${ll * 0.7} ${ly - 4 + sway} ${ll} ${ly - 9}" stroke="#F0F6FF" stroke-width="1.1" fill="none"/>`;
      f += `<path d="M 0 ${ly} Q ${-ll * 0.7} ${ly - 4 - sway} ${-ll} ${ly - 9}" stroke="#F0F6FF" stroke-width="1.1" fill="none"/>`;
    }
    return f + "</g>";
  };
  // fronds along the R's stroke skeleton, tips pointing outward
  const placements = skeletonPoints(22).map((p, i) => {
    const len = 42 + rand(i, 73) * 30;
    return [p.x, p.y, p.ang + 90 + (rand(i, 74) - 0.5) * 40, len] as [number, number, number, number];
  });
  plates.push(svg(`${placements.map((p, i) => frond(p[0], p[1], p[2], p[3], i * 7)).join("")}${speckle(80, 71, "#F0F6FF", 0.2)}<text x="240" y="566" text-anchor="middle" font-family="Georgia" font-size="12" fill="#9FC6E8" letter-spacing="4">CYANOTYPE · PTERIDIUM R</text>`, "#123A5C"));
}

// ── 06 · x-ray circuit board ───────────────────────────────────────────────
{
  let parts = "";
  for (let i = 0; i < 1400; i++) {
    const x = rand(i, 81) * W, y = rand(i, 82) * H;
    const kind = rand(i, 83);
    if (kind < 0.45) parts += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(6 + rand(i, 84) * 18).toFixed(0)}" height="${(4 + rand(i, 85) * 10).toFixed(0)}" fill="none" stroke="#CBD5E1" stroke-width="1" opacity="0.85"/>`;
    else if (kind < 0.7) parts += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(2 + rand(i, 86) * 4).toFixed(1)}" fill="none" stroke="#CBD5E1" stroke-width="1" opacity="0.8"/>`;
    else parts += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + (rand(i, 87) - 0.5) * 60).toFixed(0)}" y2="${y.toFixed(0)}" stroke="#CBD5E1" stroke-width="0.8" opacity="0.6"/>`;
  }
  plates.push(svg(`${CLIP}<g clip-path="url(#g)">${parts}<rect x="0" y="0" width="${W}" height="${H}" fill="#E2E8F0" opacity="0.05"/></g>${GLYPH("none", 'stroke="#94A3B8" stroke-width="0.7" opacity="0.5"')}${speckle(70, 91, "#CBD5E1", 0.14)}<text x="24" y="578" font-family="Georgia" font-size="11" fill="#64748B" letter-spacing="3">RADIOGRAPH 06 · 64kV</text>`, "#0B1220"));
}

// ── 07 · postage stamp collage ─────────────────────────────────────────────
{
  const colors = ["#8A3B2E", "#28527A", "#3F6212", "#C2803F", "#7C2D52"];
  let stamps = "";
  // stamps along the R strokes (layout guide, gaps left visible)
  const spots = skeletonPoints(15).map((p, i) => [p.x, p.y, (rand(i, 103) - 0.5) * 16] as [number, number, number]);
  spots.forEach(([x, y, r], i) => {
    const c = colors[i % colors.length]!;
    const sw = 62 + rand(i, 101) * 14, sh = 74 + rand(i, 102) * 12;
    stamps += `<g transform="translate(${x},${y}) rotate(${r})">
      <rect x="${-sw / 2}" y="${-sh / 2}" width="${sw}" height="${sh}" fill="#F6F1E3" stroke="#D6CDB4" stroke-width="1" stroke-dasharray="3.5 3"/>
      <rect x="${-sw / 2 + 6}" y="${-sh / 2 + 6}" width="${sw - 12}" height="${sh - 12}" fill="${c}" opacity="0.82"/>
      <text x="0" y="9" text-anchor="middle" font-family="Georgia" font-size="26" fill="#F6F1E3">R</text>
      <text x="0" y="${sh / 2 - 11}" text-anchor="middle" font-family="Georgia" font-size="7" fill="#F6F1E3" letter-spacing="1">POSTAGE · 5</text>
      <ellipse cx="${sw / 4}" cy="${-sh / 4}" rx="22" ry="14" fill="none" stroke="#1F2937" stroke-width="0.9" opacity="0.55" transform="rotate(-18)"/>
    </g>`;
  });
  plates.push(svg(`${stamps}${speckle(50, 111, "#5B4636")}<text x="24" y="36" font-family="Georgia" font-size="12" fill="#7A6A52" letter-spacing="2">PHILATELIC PLATE R</text>`, "#E7DCC3"));
}

// ── 08 · old book typography ───────────────────────────────────────────────
{
  let texty = "";
  const words = ["regula", "rubrica", "rex", "ratio", "radix", "forma", "littera", "R majuscula", "ornamentum", "initialis"];
  for (let i = 0; i < 110; i++) {
    const x = rand(i, 121) * (W - 60) + 18, y = rand(i, 122) * (H - 50) + 30;
    texty += `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="Georgia" font-style="italic" font-size="${(8 + rand(i, 123) * 8).toFixed(0)}" fill="#3B3228" opacity="${(0.25 + rand(i, 124) * 0.4).toFixed(2)}" transform="rotate(${((rand(i, 125) - 0.5) * 10).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})">${words[i % words.length]}</text>`;
  }
  plates.push(svg(`${MASK_OUT}<g mask="url(#out)">${texty}</g>${GLYPH("none", 'stroke="#8A3B2E" stroke-width="1.6" opacity="0.9"')}${speckle(60, 131, "#3B3228")}<line x1="30" y1="48" x2="450" y2="48" stroke="#3B3228" stroke-width="0.7" opacity="0.6"/><line x1="30" y1="556" x2="450" y2="556" stroke="#3B3228" stroke-width="0.7" opacity="0.6"/>`, "#F1E8D2"));
}

// ── 09 · glowing root network ──────────────────────────────────────────────
{
  let roots = "";
  const branch = (x: number, y: number, ang: number, len: number, w: number, d: number, s: number): void => {
    if (d > 5 || len < 7) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    roots += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#A7F3D0" stroke-width="${w.toFixed(1)}" opacity="${(0.95 - d * 0.18).toFixed(2)}"/>`;
    branch(x2, y2, ang + (rand(s, 141) - 0.5) * 1.3, len * 0.72, w * 0.65, d + 1, s * 3 + 1);
    branch(x2, y2, ang + (rand(s, 142) - 0.5) * 1.3, len * 0.66, w * 0.6, d + 1, s * 3 + 2);
  };
  const seeds = skeletonPoints(64).map((p, i) => [p.x, p.y, ((p.ang + 90 * (i % 2 === 0 ? 1 : -1)) * Math.PI) / 180] as [number, number, number]);
  seeds.forEach(([x, y, a], i) => branch(x, y, a, 42, 3.0, 0, i + 2));
  plates.push(svg(`${CLIP}<g clip-path="url(#g)" filter="url(#glow)">${roots}</g><defs><filter id="glow"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${speckle(90, 151, "#A7F3D0", 0.22)}<text x="240" y="572" text-anchor="middle" font-family="Georgia" font-size="11" fill="#6EE7B7" letter-spacing="4" opacity="0.7">MYCELIUM CULTURE R</text>`, "#0A2233"));
}

// ── 10 · herbarium branches ────────────────────────────────────────────────
{
  const stem = (x: number, y: number, ang: number, len: number, s: number) => {
    let g = `<g transform="translate(${x},${y}) rotate(${ang})"><path d="M 0 0 Q ${(rand(s, 161) - 0.5) * 24} ${-len / 2} 0 ${-len}" stroke="#4A5D23" stroke-width="2.2" fill="none"/>`;
    const n = Math.floor(len / 16);
    for (let j = 0; j < n; j++) {
      const ly = -(j + 1) * (len / n);
      const side = j % 2 === 0 ? 1 : -1;
      const ll = 9 + rand(j, s + 3) * 9;
      g += `<ellipse cx="${side * ll * 0.65}" cy="${ly}" rx="${ll}" ry="${ll * 0.42}" fill="${["#5B7031", "#6B8038", "#8A3B2E"][Math.floor(rand(j, s + 5) * 3)]}" opacity="0.88" transform="rotate(${side * 38} ${side * ll * 0.65} ${ly})"/>`;
    }
    if (rand(s, 167) > 0.5) g += `<circle cx="0" cy="${-len - 5}" r="6.5" fill="#8A3B2E"/>`;
    return g + "</g>";
  };
  const spots = skeletonPoints(16).map((p, i) => {
    const len = 60 + rand(i, 163) * 35;
    return [p.x + Math.cos((p.ang * Math.PI) / 180) * len * 0.5, p.y + Math.sin((p.ang * Math.PI) / 180) * len * 0.5, p.ang + 90 + (rand(i, 164) - 0.5) * 24, len] as [number, number, number, number];
  });
  plates.push(svg(`${spots.map((p, i) => stem(p[0], p[1], p[2], p[3], i * 13 + 1)).join("")}${speckle(55, 171, "#4A3B28")}<rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="#C9BFa4" stroke-width="1"/><text x="240" y="572" text-anchor="middle" font-family="Georgia" font-size="11" fill="#7A6A52" letter-spacing="3">HERBARIUM · FOLIUM R</text>`, "#F3EDDC"));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  for (let i = 0; i < plates.length; i++) {
    await page.setContent(`<style>body{margin:0}</style>${plates[i]}`);
    await page.screenshot({ path: join(OUT, `frame-${i}.png`) });
  }
  await browser.close();
  console.log(`wrote ${plates.length} plates to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
