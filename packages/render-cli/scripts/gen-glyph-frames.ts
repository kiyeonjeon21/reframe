#!/usr/bin/env tsx
/**
 * Generates the plates for examples/scenes/glyph-reveal.ts: the same "R"
 * glyph built in archival material styles — SVG recreations of the
 * prompt-pack styles that work procedurally, plus a reframe logo finale.
 * Objects are placed ALONG the glyph's stroke skeleton (the pack's
 * "object placement, not texture fill" rule). Deterministic seeds; 2x
 * resolution screenshots. Real usage replaces these with AI-generated
 * plates; the scene only cares that the files exist.
 *
 *   npx tsx packages/render-cli/scripts/gen-glyph-frames.ts
 */

import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const OUT = join(REPO, "examples", "scenes", "glyph-frames");

const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) => fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

const W = 480, H = 600;

// the R's stroke skeleton as polylines (stem, bowl, leg)
const SKELETON: [number, number][][] = [
  [[150, 140], [150, 485]],
  [[150, 150], [235, 138], [305, 152], [343, 200], [338, 252], [296, 292], [205, 305], [152, 300]],
  [[208, 308], [355, 485]],
];
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

const GLYPH = (fill: string, extra = "") =>
  `<text x="240" y="385" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="380" ${extra} fill="${fill}">R</text>`;
const CLIP = `<clipPath id="g">${GLYPH("#000").replace(/fill="[^"]*"/, "")}</clipPath>`;
const MASK_OUT = `<mask id="out"><rect width="${W}" height="${H}" fill="#fff"/>${GLYPH("#000")}</mask>`;

function speckle(n: number, salt: number, color: string, omax = 0.1): string {
  return Array.from({ length: n }, (_, j) =>
    `<circle cx="${(rand(j, salt) * W).toFixed(1)}" cy="${(rand(j, salt + 1) * H).toFixed(1)}" r="${(0.5 + rand(j, salt + 2) * 1.5).toFixed(2)}" fill="${color}" opacity="${(0.04 + rand(j, salt + 3) * omax).toFixed(2)}"/>`,
  ).join("");
}

/** soft scan vignette + paper fibres — the quality layer every plate gets */
function finish(dark = false): string {
  const fibres = Array.from({ length: 26 }, (_, j) => {
    const y = rand(j, 301) * H;
    return `<line x1="0" y1="${y.toFixed(0)}" x2="${W}" y2="${(y + (rand(j, 302) - 0.5) * 14).toFixed(0)}" stroke="${dark ? "#FFFFFF" : "#000000"}" stroke-width="0.4" opacity="${(0.012 + rand(j, 303) * 0.02).toFixed(3)}"/>`;
  }).join("");
  return `${fibres}
  <radialGradient id="vig" cx="0.5" cy="0.46" r="0.75">
    <stop offset="62%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="${dark ? 0.34 : 0.14}"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

function svg(body: string, bg: string, dark = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}${finish(dark)}</svg>`;
}

const caption = (text: string, color: string, anchor: "start" | "middle" | "end" = "middle") =>
  `<text x="${anchor === "start" ? 26 : anchor === "end" ? 454 : 240}" y="572" text-anchor="${anchor}" font-family="Georgia" font-size="11" fill="${color}" letter-spacing="3">${text}</text>`;

const plates: string[] = [];

// ── 01 · red dot grid ───────────────────────────────────────────────────────
{
  const grid = Array.from({ length: 50 }, (_, i) =>
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

// ── 02 · spectral analysis chart ────────────────────────────────────────────
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

// ── 03 · blueprint ──────────────────────────────────────────────────────────
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
  plates.push(svg(`${GLYPH("none", `stroke="${ink}" stroke-width="2.4"`)}${detail}${dims}<rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${ink}" stroke-width="1.4"/><text x="30" y="566" font-family="Georgia" font-size="12" fill="${ink}" letter-spacing="3">DWG R-06 · SECTION A–A</text>${speckle(60, 41, "#9FC6E8", 0.16)}`, "#10304E", true));
}

// ── 04 · city map negative space ────────────────────────────────────────────
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
  plates.push(svg(`${MASK_OUT}<g mask="url(#out)">${blocks}</g>${speckle(45, 61, "#1F2937")}${caption("PLAN OF THE CITY · 1888", "#6B7280", "end")}`, "#F2ECDB"));
}

// ── 05 · cyanotype ferns ────────────────────────────────────────────────────
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
  const placements = skeletonPoints(22).map((p, i) => {
    const len = 42 + rand(i, 73) * 30;
    return [p.x, p.y, p.ang + 90 + (rand(i, 74) - 0.5) * 40, len] as [number, number, number, number];
  });
  plates.push(svg(`${placements.map((p, i) => frond(p[0], p[1], p[2], p[3], i * 7)).join("")}${speckle(80, 71, "#F0F6FF", 0.2)}${caption("CYANOTYPE · PTERIDIUM R", "#9FC6E8")}`, "#123A5C", true));
}

// ── 06 · x-ray circuit board ────────────────────────────────────────────────
{
  let parts = "";
  for (let i = 0; i < 1400; i++) {
    const x = rand(i, 81) * W, y = rand(i, 82) * H;
    const kind = rand(i, 83);
    if (kind < 0.45) parts += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(6 + rand(i, 84) * 18).toFixed(0)}" height="${(4 + rand(i, 85) * 10).toFixed(0)}" fill="none" stroke="#CBD5E1" stroke-width="1" opacity="0.85"/>`;
    else if (kind < 0.7) parts += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(2 + rand(i, 86) * 4).toFixed(1)}" fill="none" stroke="#CBD5E1" stroke-width="1" opacity="0.8"/>`;
    else parts += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + (rand(i, 87) - 0.5) * 60).toFixed(0)}" y2="${y.toFixed(0)}" stroke="#CBD5E1" stroke-width="0.8" opacity="0.6"/>`;
  }
  plates.push(svg(`${CLIP}<g clip-path="url(#g)">${parts}<rect x="0" y="0" width="${W}" height="${H}" fill="#E2E8F0" opacity="0.05"/></g>${GLYPH("none", 'stroke="#94A3B8" stroke-width="0.7" opacity="0.5"')}${speckle(70, 91, "#CBD5E1", 0.14)}${caption("RADIOGRAPH 06 · 64kV", "#64748B", "start")}`, "#0B1220", true));
}

// ── 07 · postage stamps ─────────────────────────────────────────────────────
{
  const colors = ["#8A3B2E", "#28527A", "#3F6212", "#C2803F", "#7C2D52"];
  let stamps = "";
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

// ── 08 · old book typography ────────────────────────────────────────────────
{
  let texty = "";
  const words = ["regula", "rubrica", "rex", "ratio", "radix", "forma", "littera", "R majuscula", "ornamentum", "initialis"];
  for (let i = 0; i < 110; i++) {
    const x = rand(i, 121) * (W - 60) + 18, y = rand(i, 122) * (H - 50) + 30;
    texty += `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="Georgia" font-style="italic" font-size="${(8 + rand(i, 123) * 8).toFixed(0)}" fill="#3B3228" opacity="${(0.25 + rand(i, 124) * 0.4).toFixed(2)}" transform="rotate(${((rand(i, 125) - 0.5) * 10).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})">${words[i % words.length]}</text>`;
  }
  plates.push(svg(`${MASK_OUT}<g mask="url(#out)">${texty}</g>${GLYPH("none", 'stroke="#8A3B2E" stroke-width="1.6" opacity="0.9"')}${speckle(60, 131, "#3B3228")}<line x1="30" y1="48" x2="450" y2="48" stroke="#3B3228" stroke-width="0.7" opacity="0.6"/><line x1="30" y1="556" x2="450" y2="556" stroke="#3B3228" stroke-width="0.7" opacity="0.6"/>`, "#F1E8D2"));
}

// ── 09 · glowing root network ───────────────────────────────────────────────
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
  plates.push(svg(`<g filter="url(#glow)">${roots}</g><defs><filter id="glow"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${speckle(90, 151, "#A7F3D0", 0.22)}${caption("MYCELIUM CULTURE R", "#6EE7B7")}`, "#0A2233", true));
}

// ── 10 · herbarium branches ─────────────────────────────────────────────────
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
  plates.push(svg(`${spots.map((p, i) => stem(p[0], p[1], p[2], p[3], i * 13 + 1)).join("")}${speckle(55, 171, "#4A3B28")}<rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="#C9BFA4" stroke-width="1"/>${caption("HERBARIUM · FOLIUM R", "#7A6A52")}`, "#F3EDDC"));
}

// ── 11 · mechanical patent diagram ──────────────────────────────────────────
{
  const ink = "#241C12";
  const gear = (x: number, y: number, r: number, teeth: number, s: number) => {
    let g = `<g transform="translate(${x},${y}) rotate(${(rand(s, 181) * 360).toFixed(0)})">`;
    for (let t = 0; t < teeth; t++) {
      const a = (t / teeth) * Math.PI * 2;
      g += `<rect x="${(Math.cos(a) * r - 2).toFixed(1)}" y="${(Math.sin(a) * r - 3.4).toFixed(1)}" width="4" height="6.8" fill="${ink}" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)})"/>`;
    }
    g += `<circle r="${r}" fill="none" stroke="${ink}" stroke-width="1.6"/><circle r="${r * 0.55}" fill="none" stroke="${ink}" stroke-width="1"/><circle r="${r * 0.14}" fill="${ink}"/>`;
    for (let sp = 0; sp < 5; sp++) {
      const a = (sp / 5) * Math.PI * 2;
      g += `<line x1="${(Math.cos(a) * r * 0.14).toFixed(1)}" y1="${(Math.sin(a) * r * 0.14).toFixed(1)}" x2="${(Math.cos(a) * r * 0.55).toFixed(1)}" y2="${(Math.sin(a) * r * 0.55).toFixed(1)}" stroke="${ink}" stroke-width="1.2"/>`;
    }
    return g + "</g>";
  };
  const pts = skeletonPoints(13);
  let mech = "";
  pts.forEach((p, i) => {
    const r = 16 + rand(i, 183) * 14;
    mech += gear(p.x, p.y, r, 8 + Math.floor(rand(i, 184) * 6), i);
    if (i % 3 === 0) {
      const lx = p.x + (p.x < 240 ? -1 : 1) * (60 + rand(i, 185) * 30), ly = p.y - 30 - rand(i, 186) * 24;
      mech += `<line x1="${p.x}" y1="${p.y}" x2="${lx.toFixed(0)}" y2="${ly.toFixed(0)}" stroke="${ink}" stroke-width="0.6" stroke-dasharray="3 2"/><text x="${lx.toFixed(0)}" y="${(ly - 4).toFixed(0)}" text-anchor="middle" font-family="Georgia" font-size="11" fill="${ink}">${14 + i}</text>`;
    }
  });
  plates.push(svg(`${mech}${speckle(55, 191, ink)}<rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${ink}" stroke-width="0.8" opacity="0.6"/>${caption("PATENT No. 88,214 — MECHANISM R", ink)}`, "#EBE1C8"));
}

// ── 12 · torn coastline islands ─────────────────────────────────────────────
{
  const ink = "#1F2937";
  const island = (x: number, y: number, r: number, s: number) => {
    const pts = Array.from({ length: 10 }, (_, j) => {
      const a = (j / 10) * Math.PI * 2;
      const rr = r * (0.7 + rand(j, s) * 0.6);
      return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr * 0.8).toFixed(1)}`;
    }).join(" ");
    return `<g transform="translate(${x},${y}) rotate(${(rand(s, 201) * 40 - 20).toFixed(0)})">
      <polygon points="${pts}" fill="#F7F2E2" stroke="${ink}" stroke-width="1.3"/>
      <polygon points="${pts}" fill="none" stroke="${ink}" stroke-width="0.5" opacity="0.5" transform="scale(1.18)"/>
      <line x1="${-r * 0.5}" y1="0" x2="${r * 0.55}" y2="${(rand(s, 203) - 0.5) * r * 0.4}" stroke="#8A3B2E" stroke-width="0.9"/>
      <circle cx="${(rand(s, 204) - 0.5) * r * 0.5}" cy="${(rand(s, 205) - 0.5) * r * 0.4}" r="1.6" fill="${ink}"/>
    </g>`;
  };
  const spots = skeletonPoints(17);
  plates.push(svg(`${spots.map((p, i) => island(p.x, p.y, 26 + rand(i, 207) * 12, i * 11 + 3)).join("")}${speckle(60, 211, ink)}<text x="24" y="38" font-family="Georgia" font-size="12" fill="#6B7280" letter-spacing="2">ARCHIPELAGO OF R · SURVEYED 1851</text><line x1="24" y1="46" x2="206" y2="46" stroke="${ink}" stroke-width="0.6"/>`, "#FAF6EA"));
}

// ── 13 · antique coins ──────────────────────────────────────────────────────
{
  const coin = (x: number, y: number, r: number, s: number) => {
    const metal = rand(s, 221) > 0.45 ? ["#B08D4F", "#8A6B33"] : ["#A8A8A8", "#7C7C7C"];
    let serr = "";
    for (let t = 0; t < 36; t++) {
      const a = (t / 36) * Math.PI * 2;
      serr += `<line x1="${(Math.cos(a) * (r - 2)).toFixed(1)}" y1="${(Math.sin(a) * (r - 2)).toFixed(1)}" x2="${(Math.cos(a) * r).toFixed(1)}" y2="${(Math.sin(a) * r).toFixed(1)}" stroke="${metal[1]}" stroke-width="1"/>`;
    }
    return `<g transform="translate(${x},${y})">
      <circle r="${r}" fill="${metal[0]}"/>
      <circle r="${r}" fill="none" stroke="${metal[1]}" stroke-width="1.4"/>${serr}
      <circle r="${r * 0.72}" fill="none" stroke="${metal[1]}" stroke-width="0.8"/>
      <text y="${r * 0.32}" text-anchor="middle" font-family="Georgia" font-size="${r}" fill="${metal[1]}">R</text>
    </g>`;
  };
  const spots = skeletonPoints(19);
  plates.push(svg(`${spots.map((p, i) => coin(p.x, p.y, 20 + rand(i, 223) * 9, i * 7 + 2)).join("")}${speckle(50, 231, "#5B4636")}${caption("NUMISMATIC COLLECTION · SERIES R", "#7A6A52")}`, "#F1EADA"));
}

// ── 14 · sheet music ────────────────────────────────────────────────────────
{
  const ink = "#2B2118";
  const strip = (x: number, y: number, ang: number, len: number, s: number) => {
    let g = `<g transform="translate(${x},${y}) rotate(${ang})"><rect x="${-len / 2}" y="-16" width="${len}" height="32" fill="#FAF5E6" stroke="#D6CDB4" stroke-width="0.7"/>`;
    for (let l = 0; l < 5; l++) g += `<line x1="${-len / 2 + 4}" y1="${-10 + l * 5}" x2="${len / 2 - 4}" y2="${-10 + l * 5}" stroke="${ink}" stroke-width="0.6"/>`;
    const notes = Math.floor(len / 16);
    for (let n = 0; n < notes; n++) {
      const nx = -len / 2 + 10 + n * 15, ny = -10 + Math.floor(rand(n, s) * 5) * 5;
      g += `<ellipse cx="${nx}" cy="${ny}" rx="3.4" ry="2.5" fill="${ink}" transform="rotate(-18 ${nx} ${ny})"/><line x1="${nx + 3.2}" y1="${ny}" x2="${nx + 3.2}" y2="${ny - 13}" stroke="${ink}" stroke-width="0.9"/>`;
    }
    return g + "</g>";
  };
  const spots = skeletonPoints(13);
  plates.push(svg(`${spots.map((p, i) => strip(p.x, p.y, p.ang + (rand(i, 243) - 0.5) * 10, 78 + rand(i, 244) * 26, i * 5 + 1)).join("")}${speckle(55, 251, ink)}${caption("RONDO IN R · Op. 12", "#7A6A52")}<text x="240" y="44" text-anchor="middle" font-family="Georgia" font-style="italic" font-size="15" fill="#7A6A52">Allegro ma non troppo</text>`, "#F2EBD8"));
}

// ── 15 · pinned beetles ─────────────────────────────────────────────────────
{
  const beetle = (x: number, y: number, ang: number, sc: number, s: number) => {
    const shell = ["#1C1A17", "#2E2218", "#1F2A1D"][Math.floor(rand(s, 261) * 3)];
    let legs = "";
    for (let l = 0; l < 3; l++) {
      const ly = -4 + l * 7;
      legs += `<path d="M -6 ${ly} Q -16 ${ly - 5} -21 ${ly + 3}" stroke="#3B3228" stroke-width="1.3" fill="none"/><path d="M 6 ${ly} Q 16 ${ly - 5} 21 ${ly + 3}" stroke="#3B3228" stroke-width="1.3" fill="none"/>`;
    }
    return `<g transform="translate(${x},${y}) rotate(${ang}) scale(${sc})">${legs}
      <ellipse cy="6" rx="9.5" ry="13" fill="${shell}"/><line x1="0" y1="-4" x2="0" y2="19" stroke="#0A0908" stroke-width="0.8"/>
      <circle cy="-8" r="5.5" fill="${shell}"/>
      <path d="M -3 -12 Q -7 -20 -12 -22" stroke="#3B3228" stroke-width="1" fill="none"/><path d="M 3 -12 Q 7 -20 12 -22" stroke="#3B3228" stroke-width="1" fill="none"/>
      <circle cy="-2" r="1" fill="#C9BFA4"/>
    </g>`;
  };
  const spots = skeletonPoints(18);
  plates.push(svg(`${spots.map((p, i) => beetle(p.x, p.y, rand(i, 263) * 360, 0.9 + rand(i, 264) * 0.5, i * 3 + 1)).join("")}${speckle(45, 271, "#5B4636")}<line x1="350" y1="560" x2="430" y2="560" stroke="#3B3228" stroke-width="1.4"/><text x="390" y="550" text-anchor="middle" font-family="Georgia" font-size="9" fill="#7A6A52">10 mm</text><text x="24" y="36" font-family="Georgia" font-size="12" fill="#7A6A52" letter-spacing="2">COLEOPTERA · PLATE R</text>`, "#F5F0E4"));
}

// ── 16 · butterflies and moths ──────────────────────────────────────────────
{
  const fly = (x: number, y: number, ang: number, sc: number, s: number) => {
    const wing = ["#8A3B2E", "#C2803F", "#3F6212", "#28527A", "#7C2D52"][Math.floor(rand(s, 281) * 5)];
    const spotc = "#F1E8D2";
    return `<g transform="translate(${x},${y}) rotate(${ang}) scale(${sc})">
      <path d="M 0 0 Q -22 -18 -24 -4 Q -25 6 -2 6 Z" fill="${wing}" opacity="0.9"/>
      <path d="M 0 0 Q 22 -18 24 -4 Q 25 6 2 6 Z" fill="${wing}" opacity="0.9"/>
      <path d="M 0 4 Q -14 16 -6 20 Q 0 22 0 8 Z" fill="${wing}" opacity="0.75"/>
      <path d="M 0 4 Q 14 16 6 20 Q 0 22 0 8 Z" fill="${wing}" opacity="0.75"/>
      <circle cx="-13" cy="-6" r="2.6" fill="${spotc}" opacity="0.85"/><circle cx="13" cy="-6" r="2.6" fill="${spotc}" opacity="0.85"/>
      <ellipse rx="1.8" ry="9" cy="6" fill="#241C12"/>
      <path d="M -1 -3 Q -5 -12 -8 -14" stroke="#241C12" stroke-width="0.8" fill="none"/><path d="M 1 -3 Q 5 -12 8 -14" stroke="#241C12" stroke-width="0.8" fill="none"/>
    </g>`;
  };
  const spots = skeletonPoints(16);
  plates.push(svg(`${spots.map((p, i) => fly(p.x, p.y, (rand(i, 283) - 0.5) * 50, 0.95 + rand(i, 284) * 0.5, i * 9 + 4)).join("")}${speckle(45, 291, "#5B4636")}${caption("LEPIDOPTERA · PLATE R", "#7A6A52")}`, "#F4EEDF"));
}

// ── 17 · petri dish culture ─────────────────────────────────────────────────
{
  let colonies = "";
  const cx = 240, cy = 300, scale = 0.78;
  skeletonPoints(60).forEach((p, i) => {
    const px = cx + (p.x - 240) * scale, py = cy + (p.y - 312) * scale;
    for (let k = 0; k < 5; k++) {
      const ox = (rand(i * 5 + k, 311) - 0.5) * 17, oy = (rand(i * 5 + k, 312) - 0.5) * 17;
      const r = 2.2 + rand(i * 5 + k, 313) * 4.6;
      colonies += `<circle cx="${(px + ox).toFixed(1)}" cy="${(py + oy).toFixed(1)}" r="${r.toFixed(1)}" fill="#C92A2A" opacity="${(0.65 + rand(i * 5 + k, 314) * 0.35).toFixed(2)}"/><circle cx="${(px + ox - r * 0.25).toFixed(1)}" cy="${(py + oy - r * 0.25).toFixed(1)}" r="${(r * 0.4).toFixed(1)}" fill="#E8590C" opacity="0.5"/>`;
    }
  });
  plates.push(svg(`<clipPath id="dish"><circle cx="240" cy="300" r="212"/></clipPath>
    <circle cx="240" cy="300" r="222" fill="#1A2C24"/>
    <circle cx="240" cy="300" r="212" fill="#14251D"/>
    <g clip-path="url(#dish)">${colonies}</g>
    <circle cx="240" cy="300" r="222" fill="none" stroke="#C9D2CC" stroke-width="3" opacity="0.7"/>
    <circle cx="240" cy="300" r="212" fill="none" stroke="#E8EDE9" stroke-width="1.2" opacity="0.5"/>
    <ellipse cx="168" cy="194" rx="86" ry="34" fill="#FFFFFF" opacity="0.07" transform="rotate(-32 168 194)"/>
    ${caption("CULTURE 17 · 48H · STRAIN R", "#8FA396")}`, "#E8E4D8"));
}

// ── 18 · star chart ─────────────────────────────────────────────────────────
{
  const ink = "#D8E3F4";
  let field = "";
  for (let i = 0; i < 130; i++)
    field += `<circle cx="${(rand(i, 321) * W).toFixed(0)}" cy="${(rand(i, 322) * H).toFixed(0)}" r="${(0.5 + rand(i, 323) * 1.1).toFixed(1)}" fill="${ink}" opacity="${(0.2 + rand(i, 324) * 0.5).toFixed(2)}"/>`;
  const pts = skeletonPoints(15);
  let constellation = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 90)
      constellation += `<line x1="${a.x.toFixed(0)}" y1="${a.y.toFixed(0)}" x2="${b.x.toFixed(0)}" y2="${b.y.toFixed(0)}" stroke="${ink}" stroke-width="0.8" opacity="0.65"/>`;
  }
  pts.forEach((p, i) => {
    const r = 2.4 + rand(i, 327) * 3;
    constellation += `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="${r.toFixed(1)}" fill="#FFF7DB"/><circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="${(r + 3).toFixed(1)}" fill="none" stroke="#FFF7DB" stroke-width="0.5" opacity="0.5"/>`;
  });
  plates.push(svg(`${field}<circle cx="240" cy="300" r="235" fill="none" stroke="${ink}" stroke-width="0.5" opacity="0.4"/><circle cx="240" cy="300" r="180" fill="none" stroke="${ink}" stroke-width="0.4" opacity="0.3" stroke-dasharray="3 5"/>${constellation}<text x="356" y="170" font-family="Georgia" font-style="italic" font-size="13" fill="${ink}" opacity="0.8">α Reginae</text>${caption("CONSTELLATION R · EPOCH 1900", "#7E92B5")}`, "#0A1428", true));
}

// ── 19 · reframe logo finale (HTML, brand Inter) ────────────────────────────
const inter700 = readFileSync(join(REPO, "assets/fonts/inter-700.woff2")).toString("base64");
const inter400 = readFileSync(join(REPO, "assets/fonts/inter-400.woff2")).toString("base64");
const LOGO_HTML = `<style>
  @font-face { font-family: Inter; font-weight: 700; src: url(data:font/woff2;base64,${inter700}) format("woff2"); }
  @font-face { font-family: Inter; font-weight: 400; src: url(data:font/woff2;base64,${inter400}) format("woff2"); }
  body { margin:0; width:${W}px; height:${H}px; background:#0A0A0C; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .disc { width:150px; height:150px; border-radius:50%; background:#FF4D00; display:flex; align-items:center; justify-content:center;
          box-shadow: 0 0 90px rgba(255,77,0,.28); }
  .mark { width:62px; height:62px; border-radius:16px; background:#0A0A0C; }
  h1 { font:700 64px Inter; color:#fff; margin:34px 0 0; letter-spacing:-1px; }
  p  { font:400 19px Inter; color:#8B93A7; margin:10px 0 0; letter-spacing:2px; }
</style><body><div class="disc"><div class="mark"></div></div><h1>reframe</h1><p>motion, declared</p></body>`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  for (let i = 0; i < plates.length; i++) {
    await page.setContent(`<style>body{margin:0}</style>${plates[i]}`);
    await page.screenshot({ path: join(OUT, `frame-${i}.png`) });
  }
  await page.setContent(LOGO_HTML);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `frame-${plates.length}.png`) });
  await browser.close();
  console.log(`wrote ${plates.length} plates + logo finale to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
