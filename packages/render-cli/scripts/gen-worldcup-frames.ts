#!/usr/bin/env tsx
/**
 * World Cup 2026 glyph plates for examples/scenes/worldcup-glyph.ts:
 * the "26" glyph built from football materials — balls, chalk tactics,
 * stadium blueprints, commemorative stamps, tickets, pennants — in the
 * same archival language as gen-glyph-frames.ts. Deterministic seeds,
 * 2x screenshots. (Generic football imagery only; no FIFA marks.)
 *
 *   npx tsx packages/render-cli/scripts/gen-worldcup-frames.ts
 */

import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const OUT = join(REPO, "examples", "scenes", "glyph-frames-wc");

const fract = (x: number) => x - Math.floor(x);
const rand = (i: number, salt: number) => fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

const W = 960, H = 540;
const CX = W / 2, CY = H / 2;

// "2026" as two stacked rows ("20" over "26"); digit strokes defined in a
// unit box and placed into the four cells
type Poly = [number, number][];
const DIGITS: Record<string, Poly[]> = {
  "2": [
    [[0.05, 0.22], [0.15, 0.07], [0.38, 0], [0.62, 0.02], [0.86, 0.13], [0.95, 0.3], [0.86, 0.47], [0.58, 0.64], [0.28, 0.8], [0.05, 0.96]],
    [[0.05, 0.97], [0.95, 0.97]],
  ],
  "0": [
    [[0.5, 0], [0.78, 0.08], [0.94, 0.3], [0.96, 0.55], [0.88, 0.8], [0.68, 0.97], [0.42, 0.99], [0.18, 0.88], [0.05, 0.64], [0.04, 0.38], [0.14, 0.13], [0.34, 0.01], [0.5, 0]],
  ],
  "6": [
    [[0.88, 0.06], [0.6, 0], [0.3, 0.09], [0.1, 0.3], [0.03, 0.55]],
    [[0.03, 0.58], [0.08, 0.82], [0.3, 0.98], [0.62, 0.99], [0.88, 0.86], [0.96, 0.66], [0.86, 0.5], [0.6, 0.44], [0.3, 0.5], [0.06, 0.62]],
  ],
};
const CELLS: { d: string; x: number; y: number; w: number; h: number }[] = [
  { d: "2", x: 50, y: 105, w: 170, h: 330 },
  { d: "0", x: 283, y: 105, w: 170, h: 330 },
  { d: "2", x: 516, y: 105, w: 170, h: 330 },
  { d: "6", x: 749, y: 105, w: 170, h: 330 },
];
const SKELETON: [number, number][][] = CELLS.flatMap((c) =>
  DIGITS[c.d]!.map((poly) => poly.map(([u, v]) => [c.x + u * c.w, c.y + v * c.h] as [number, number])),
);
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
  `<text x="${CX}" y="392" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="318" letter-spacing="6" ${extra} fill="${fill}">2026</text>`;
const GLYPH_BARE = `<text x="${CX}" y="392" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="318" letter-spacing="6">2026</text>`;
const CLIP = `<clipPath id="g">${GLYPH_BARE}</clipPath>`;
const MASK_OUT = `<mask id="out"><rect width="${W}" height="${H}" fill="#fff"/>${GLYPH("#000")}</mask>`;

function speckle(n: number, salt: number, color: string, omax = 0.1): string {
  return Array.from({ length: n }, (_, j) =>
    `<circle cx="${(rand(j, salt) * W).toFixed(1)}" cy="${(rand(j, salt + 1) * H).toFixed(1)}" r="${(0.5 + rand(j, salt + 2) * 1.5).toFixed(2)}" fill="${color}" opacity="${(0.04 + rand(j, salt + 3) * omax).toFixed(2)}"/>`,
  ).join("");
}

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
  `<text x="${anchor === "start" ? 28 : anchor === "end" ? W - 28 : CX}" y="${H - 22}" text-anchor="${anchor}" font-family="Georgia" font-size="11" fill="${color}" letter-spacing="3">${text}</text>`;

// host trio palette
const TRIO = ["#006847", "#B22234", "#26619C"]; // MEX green / USA red / CAN-ish blue

const plates: string[] = [];

// ── 01 · soccer balls along the glyph ───────────────────────────────────────
{
  const ball = (x: number, y: number, r: number, s: number) => {
    let patches = "";
    const rot = rand(s, 11) * 72;
    for (let p = 0; p < 5; p++) {
      const a = ((p / 5) * Math.PI * 2) + (rot * Math.PI) / 180;
      const px = Math.cos(a) * r * 0.62, py = Math.sin(a) * r * 0.62;
      patches += `<polygon points="${Array.from({ length: 5 }, (_, k) => {
        const b = (k / 5) * Math.PI * 2 + a;
        return `${(px + Math.cos(b) * r * 0.26).toFixed(1)},${(py + Math.sin(b) * r * 0.26).toFixed(1)}`;
      }).join(" ")}" fill="#1A1714"/>`;
    }
    return `<g transform="translate(${x},${y})">
      <circle r="${r}" fill="#FBF8EF" stroke="#1A1714" stroke-width="1.6"/>
      <polygon points="${Array.from({ length: 5 }, (_, k) => {
        const b = (k / 5) * Math.PI * 2 + (rot * Math.PI) / 180 + 0.628;
        return `${(Math.cos(b) * r * 0.3).toFixed(1)},${(Math.sin(b) * r * 0.3).toFixed(1)}`;
      }).join(" ")}" fill="#1A1714"/>${patches}
      <circle r="${r}" fill="none" stroke="#1A1714" stroke-width="1.6"/>
      <ellipse cx="${-r * 0.35}" cy="${-r * 0.4}" rx="${r * 0.3}" ry="${r * 0.16}" fill="#FFF" opacity="0.5" transform="rotate(-30)"/>
    </g>`;
  };
  const spots = skeletonPoints(52);
  plates.push(svg(`${spots.map((p, i) => ball(p.x, p.y, 11 + rand(i, 13) * 4, i * 3 + 1)).join("")}${speckle(45, 15, "#5B4636")}<text x="28" y="40" font-family="Georgia" font-size="13" fill="#7A6A52" letter-spacing="2">FOOTBALLS OF THE TOURNAMENT · 2026</text>`, "#F3EDDC"));
}

// ── 02 · chalk tactics board ────────────────────────────────────────────────
{
  const chalk = "#F2F7F2";
  let marks = "";
  skeletonPoints(46).forEach((p, i) => {
    if (i % 2 === 0)
      marks += `<text x="${p.x.toFixed(0)}" y="${(p.y + 6).toFixed(0)}" text-anchor="middle" font-family="Georgia" font-size="22" fill="${chalk}" opacity="0.92">×</text>`;
    else
      marks += `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="9" fill="none" stroke="${chalk}" stroke-width="2" opacity="0.9"/>`;
    if (i % 4 === 1) {
      const a = ((p.ang + 20) * Math.PI) / 180;
      const x2 = p.x + Math.cos(a) * 34, y2 = p.y + Math.sin(a) * 34;
      marks += `<line x1="${p.x.toFixed(0)}" y1="${p.y.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${chalk}" stroke-width="1.4" stroke-dasharray="6 4" opacity="0.7"/><polygon points="${x2.toFixed(0)},${y2.toFixed(0)} ${(x2 - 6).toFixed(0)},${(y2 - 3).toFixed(0)} ${(x2 - 5).toFixed(0)},${(y2 + 4).toFixed(0)}" fill="${chalk}" opacity="0.7"/>`;
    }
  });
  const pitch = `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="${chalk}" stroke-width="2" opacity="0.8"/>
    <line x1="${CX}" y1="26" x2="${CX}" y2="${H - 26}" stroke="${chalk}" stroke-width="1.4" opacity="0.55"/>
    <circle cx="${CX}" cy="${CY}" r="62" fill="none" stroke="${chalk}" stroke-width="1.4" opacity="0.55"/>
    <rect x="26" y="${CY - 95}" width="74" height="190" fill="none" stroke="${chalk}" stroke-width="1.4" opacity="0.55"/>
    <rect x="${W - 100}" y="${CY - 95}" width="74" height="190" fill="none" stroke="${chalk}" stroke-width="1.4" opacity="0.55"/>`;
  plates.push(svg(`${pitch}${marks}${speckle(90, 25, chalk, 0.18)}${caption("THE GAFFER'S PLAN · FORMATION 26", "#BBD4BB")}`, "#1E4D2B", true));
}

// ── 03 · stadium blueprint ──────────────────────────────────────────────────
{
  const ink = "#E8F0FF";
  const stands = Array.from({ length: 4 }, (_, i) =>
    `<ellipse cx="${CX}" cy="${CY}" rx="${398 + i * 16}" ry="${198 + i * 13}" fill="none" stroke="${ink}" stroke-width="${i === 3 ? 1.4 : 0.5}" opacity="${i === 3 ? 0.8 : 0.45}" stroke-dasharray="${i % 2 ? "10 6" : "none"}"/>`,
  ).join("");
  plates.push(svg(`${GLYPH("none", `stroke="${ink}" stroke-width="2.4"`)}${stands}
    <line x1="${CX}" y1="30" x2="${CX}" y2="${H - 30}" stroke="${ink}" stroke-width="0.4" opacity="0.5" stroke-dasharray="9 5"/>
    <line x1="110" y1="${H - 58}" x2="${W - 110}" y2="${H - 58}" stroke="${ink}" stroke-width="0.8"/>
    <line x1="110" y1="${H - 66}" x2="110" y2="${H - 50}" stroke="${ink}" stroke-width="0.8"/>
    <line x1="${W - 110}" y1="${H - 66}" x2="${W - 110}" y2="${H - 50}" stroke="${ink}" stroke-width="0.8"/>
    <text x="${CX}" y="${H - 38}" text-anchor="middle" font-family="Georgia" font-size="12" fill="${ink}">CAPACITY 80,000</text>
    <rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="${ink}" stroke-width="1.4"/>
    <text x="30" y="${H - 24}" font-family="Georgia" font-size="12" fill="${ink}" letter-spacing="3">STADIUM DWG 2026 · FINAL VENUE</text>${speckle(60, 35, "#9FC6E8", 0.16)}`, "#10304E", true));
}

// ── 04 · commemorative stamps ───────────────────────────────────────────────
{
  let stamps = "";
  const spots = skeletonPoints(28).map((p, i) => [p.x, p.y, (rand(i, 43) - 0.5) * 16] as [number, number, number]);
  spots.forEach(([x, y, r], i) => {
    const c = TRIO[i % 3]!;
    const sw = 42 + rand(i, 41) * 8, sh = 50 + rand(i, 42) * 8;
    stamps += `<g transform="translate(${x},${y}) rotate(${r})">
      <rect x="${-sw / 2}" y="${-sh / 2}" width="${sw}" height="${sh}" fill="#F6F1E3" stroke="#D6CDB4" stroke-width="1" stroke-dasharray="3.5 3"/>
      <rect x="${-sw / 2 + 5}" y="${-sh / 2 + 5}" width="${sw - 10}" height="${sh - 10}" fill="${c}" opacity="0.85"/>
      <circle cy="-4" r="11" fill="none" stroke="#F6F1E3" stroke-width="1.6"/>
      <text x="0" y="1" text-anchor="middle" font-family="Georgia" font-size="11" fill="#F6F1E3">⚽</text>
      <text x="0" y="${sh / 2 - 10}" text-anchor="middle" font-family="Georgia" font-size="8" fill="#F6F1E3" letter-spacing="1">CORREOS · 26</text>
    </g>`;
  });
  plates.push(svg(`${stamps}${speckle(50, 45, "#5B4636")}<text x="28" y="40" font-family="Georgia" font-size="12" fill="#7A6A52" letter-spacing="2">PHILATELIC ISSUE · WORLD CUP 2026</text>`, "#E7DCC3"));
}

// ── 05 · match tickets ──────────────────────────────────────────────────────
{
  let tix = "";
  const spots = skeletonPoints(22);
  spots.forEach((p, i) => {
    const tw = 74, th = 30;
    const c = ["#F8F3E2", "#F3E9CF"][i % 2]!;
    tix += `<g transform="translate(${p.x},${p.y}) rotate(${(p.ang + (rand(i, 53) - 0.5) * 14).toFixed(0)})">
      <rect x="${-tw / 2}" y="${-th / 2}" width="${tw}" height="${th}" rx="3" fill="${c}" stroke="#B8A77E" stroke-width="1"/>
      <line x1="${tw / 2 - 17}" y1="${-th / 2}" x2="${tw / 2 - 22}" y2="${th / 2}" stroke="#B8A77E" stroke-width="0.9" stroke-dasharray="3 3"/>
      <text x="${-tw / 2 + 6}" y="-2" font-family="Georgia" font-size="7" fill="#5B4636" letter-spacing="1">ADMIT ONE</text>
      <text x="${-tw / 2 + 6}" y="8" font-family="Georgia" font-size="5.5" fill="#8A7A5C">THE FINAL · JULY 19 1926</text>
      <text x="${tw / 2 - 9}" y="4" text-anchor="middle" font-family="Georgia" font-size="9" fill="#8A3B2E">26</text>
    </g>`;
  });
  plates.push(svg(`${tix}${speckle(55, 55, "#5B4636")}${caption("TICKET STUBS OF A CENTURY", "#7A6A52")}`, "#EFE6CF"));
}

// ── 06 · pennant flags ──────────────────────────────────────────────────────
{
  let pens = "";
  const spots = skeletonPoints(34);
  spots.forEach((p, i) => {
    const c = TRIO[i % 3]!;
    const len = 32 + rand(i, 63) * 12;
    pens += `<g transform="translate(${p.x},${p.y}) rotate(${(p.ang + (rand(i, 64) - 0.5) * 36).toFixed(0)})">
      <line x1="0" y1="0" x2="0" y2="-14" stroke="#5B4636" stroke-width="1.6"/>
      <polygon points="0,-14 ${len},-7 0,0" fill="${c}" opacity="0.92"/>
      <polygon points="0,-14 ${len},-7 0,0" fill="none" stroke="#3B3228" stroke-width="0.7" opacity="0.5"/>
      <text x="14" y="-4" font-family="Georgia" font-size="8" fill="#F6F1E3" transform="rotate(${(Math.atan2(7, len) * 180 / Math.PI).toFixed(0)} 0 -7)">26</text>
    </g>`;
  });
  plates.push(svg(`${pens}${speckle(50, 65, "#5B4636")}${caption("CLUB PENNANTS · GROUP STAGE", "#7A6A52")}`, "#F4EEDF"));
}

// ── 07 · host cities map (negative space) ───────────────────────────────────
{
  let blocks = "";
  let i = 0;
  for (let y = 6; y < H - 6; ) {
    const rh = 10 + rand(i, 71) * 18;
    for (let x = 6; x < W - 6; ) {
      const rw = 10 + rand(i, 72) * 26;
      if (rand(i, 73) > 0.08)
        blocks += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(rw - 4).toFixed(0)}" height="${(rh - 4).toFixed(0)}" fill="none" stroke="#1F2937" stroke-width="1"/>` +
          (rand(i, 74) > 0.55 ? `<rect x="${(x + 4).toFixed(0)}" y="${(y + 4).toFixed(0)}" width="${Math.max(3, rw - 11).toFixed(0)}" height="${Math.max(3, rh - 11).toFixed(0)}" fill="#1F2937" opacity="0.22"/>` : "");
      x += rw; i++;
    }
    y += rh;
  }
  plates.push(svg(`${MASK_OUT}<g mask="url(#out)">${blocks}</g>${speckle(45, 75, "#1F2937")}${caption("SIXTEEN HOST CITIES · ONE SUMMER", "#6B7280", "end")}`, "#F2ECDB"));
}

// ── 08 · press box typography ───────────────────────────────────────────────
{
  let texty = "";
  const words = ["GOL!", "campeón", "final whistle", "extra time", "golden boot", "¡qué golazo!", "hat-trick", "the beautiful game", "penales", "glory"];
  for (let i = 0; i < 170; i++) {
    const x = rand(i, 81) * (W - 60) + 18, y = rand(i, 82) * (H - 70) + 50;
    texty += `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" font-family="Georgia" font-style="italic" font-size="${(8 + rand(i, 83) * 9).toFixed(0)}" fill="#3B3228" opacity="${(0.25 + rand(i, 84) * 0.4).toFixed(2)}" transform="rotate(${((rand(i, 85) - 0.5) * 10).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})">${words[i % words.length]}</text>`;
  }
  plates.push(svg(`${MASK_OUT}<g mask="url(#out)">${texty}</g>${GLYPH("none", 'stroke="#8A3B2E" stroke-width="1.6" opacity="0.9"')}${speckle(60, 87, "#3B3228")}<line x1="30" y1="48" x2="${W - 30}" y2="48" stroke="#3B3228" stroke-width="0.7" opacity="0.6"/><text x="${CX}" y="40" text-anchor="middle" font-family="Georgia" font-size="13" fill="#7A6A52" letter-spacing="3">THE SPORTING GAZETTE</text>`, "#F1E8D2"));
}

// ── 09 · ticker-tape confetti ───────────────────────────────────────────────
{
  let confetti = "";
  for (let i = 0; i < 2600; i++) {
    const x = rand(i, 91) * W, y = rand(i, 92) * H;
    const c = TRIO[Math.floor(rand(i, 93) * 3)]!;
    confetti += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(3 + rand(i, 94) * 5).toFixed(1)}" height="${(6 + rand(i, 95) * 8).toFixed(1)}" fill="${c}" opacity="${(0.55 + rand(i, 96) * 0.45).toFixed(2)}" transform="rotate(${(rand(i, 97) * 360).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  plates.push(svg(`${CLIP}<g clip-path="url(#g)">${confetti}</g>${GLYPH("none", 'stroke="#3B3228" stroke-width="0.8" opacity="0.4"')}${speckle(40, 99, "#3B3228")}${caption("TICKER-TAPE · THE PARADE", "#7A6A52")}`, "#FAF6EA"));
}

// ── 10 · winners' medals ────────────────────────────────────────────────────
{
  const medal = (x: number, y: number, r: number, s: number) => {
    const gold = rand(s, 101) > 0.3;
    const m = gold ? ["#C9A227", "#8A6B14"] : ["#B8BCC4", "#7C828E"];
    let serr = "";
    for (let t = 0; t < 30; t++) {
      const a = (t / 30) * Math.PI * 2;
      serr += `<circle cx="${(Math.cos(a) * (r - 3)).toFixed(1)}" cy="${(Math.sin(a) * (r - 3)).toFixed(1)}" r="0.8" fill="${m[1]}"/>`;
    }
    return `<g transform="translate(${x},${y})">
      <path d="M -7 ${-r - 12} L 0 ${-r + 2} L 7 ${-r - 12} Z" fill="#8A3B2E"/>
      <circle r="${r}" fill="${m[0]}"/><circle r="${r}" fill="none" stroke="${m[1]}" stroke-width="1.4"/>${serr}
      <text y="${r * 0.34}" text-anchor="middle" font-family="Georgia" font-size="${r * 0.95}" fill="${m[1]}">26</text>
    </g>`;
  };
  const spots = skeletonPoints(28);
  plates.push(svg(`${spots.map((p, i) => medal(p.x, p.y, 15 + rand(i, 103) * 6, i * 7 + 2)).join("")}${speckle(50, 105, "#5B4636")}${caption("WINNERS' MEDALS · 1930–2026", "#7A6A52")}`, "#F1EADA"));
}

// ── 11 · floodlight constellation ───────────────────────────────────────────
{
  const ink = "#D8E3F4";
  let field = "";
  for (let i = 0; i < 130; i++)
    field += `<circle cx="${(rand(i, 111) * W).toFixed(0)}" cy="${(rand(i, 112) * H).toFixed(0)}" r="${(0.5 + rand(i, 113) * 1.1).toFixed(1)}" fill="${ink}" opacity="${(0.2 + rand(i, 114) * 0.5).toFixed(2)}"/>`;
  const pts = skeletonPoints(38);
  let constellation = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 64)
      constellation += `<line x1="${a.x.toFixed(0)}" y1="${a.y.toFixed(0)}" x2="${b.x.toFixed(0)}" y2="${b.y.toFixed(0)}" stroke="${ink}" stroke-width="0.8" opacity="0.65"/>`;
  }
  pts.forEach((p, i) => {
    const r = 2.0 + rand(i, 117) * 2.4;
    constellation += `<circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="${r.toFixed(1)}" fill="#FFF7DB"/><circle cx="${p.x.toFixed(0)}" cy="${p.y.toFixed(0)}" r="${(r + 3).toFixed(1)}" fill="none" stroke="#FFF7DB" stroke-width="0.5" opacity="0.5"/>`;
  });
  plates.push(svg(`${field}<ellipse cx="${CX}" cy="${CY}" rx="455" ry="245" fill="none" stroke="${ink}" stroke-width="0.5" opacity="0.4"/>${constellation}<text x="${W - 180}" y="90" font-family="Georgia" font-style="italic" font-size="13" fill="${ink}" opacity="0.8">Estadio Australis</text>${caption("NIGHT MATCH · FLOODLIT SKY 26", "#7E92B5")}`, "#0A1428", true));
}

// ── 12 · stadium aerial (seat dots) ─────────────────────────────────────────
{
  let seats = "";
  // seats trace a shrunken 26 inside the bowl
  const cx = CX, cy = CY, scale = 0.58;
  skeletonPoints(110).forEach((p, i) => {
    const px = cx + (p.x - CX) * scale, py = cy + (p.y - CY) * scale;
    for (let k = 0; k < 4; k++) {
      const ox = (rand(i * 4 + k, 121) - 0.5) * 13, oy = (rand(i * 4 + k, 122) - 0.5) * 13;
      seats += `<circle cx="${(px + ox).toFixed(1)}" cy="${(py + oy).toFixed(1)}" r="${(1.8 + rand(i * 4 + k, 123) * 1.6).toFixed(1)}" fill="${rand(i * 4 + k, 124) > 0.25 ? "#E8590C" : "#F6F1E3"}" opacity="0.95"/>`;
    }
  });
  const rings = Array.from({ length: 3 }, (_, i) =>
    `<ellipse cx="${CX}" cy="${CY}" rx="${352 + i * 32}" ry="${188 + i * 22}" fill="none" stroke="#8FA396" stroke-width="${i === 2 ? 2.4 : 1}" opacity="${0.55 + i * 0.15}"/>`,
  ).join("");
  plates.push(svg(`<ellipse cx="${CX}" cy="${CY}" rx="445" ry="252" fill="#27372E"/>
    <ellipse cx="${CX}" cy="${CY}" rx="350" ry="186" fill="#1E4D2B"/>
    ${seats}${rings}
    <ellipse cx="300" cy="140" rx="120" ry="36" fill="#FFFFFF" opacity="0.06" transform="rotate(-18 300 140)"/>
    ${caption("AERIAL SURVEY · MATCHDAY 26", "#8FA396")}`, "#E8E4D8"));
}


// ── 13 · pinned jerseys ─────────────────────────────────────────────────────
{
  const jersey = (x: number, y: number, ang: number, sc: number, s: number) => {
    const c = TRIO[Math.floor(rand(s, 401) * 3)]!;
    return `<g transform="translate(${x},${y}) rotate(${ang}) scale(${sc})">
      <path d="M -10 -14 L -22 -8 L -18 2 L -11 -1 L -11 16 L 11 16 L 11 -1 L 18 2 L 22 -8 L 10 -14 Q 0 -9 -10 -14 Z" fill="${c}" stroke="#3B3228" stroke-width="0.8" opacity="0.92"/>
      <path d="M -5 -14 Q 0 -10 5 -14" fill="none" stroke="#F6F1E3" stroke-width="1.4"/>
      <circle cy="-17" r="1" fill="#C9BFA4"/>
    </g>`;
  };
  const spots = skeletonPoints(42);
  plates.push(svg(`${spots.map((p, i) => jersey(p.x, p.y, (rand(i, 403) - 0.5) * 26, 0.75 + rand(i, 404) * 0.3, i * 3 + 1)).join("")}${speckle(45, 405, "#5B4636")}${caption("KIT ROOM · MATCHDAY ISSUE 2026", "#7A6A52")}`, "#F3EDDC"));
}

// ── 14 · boot prints on the pitch ───────────────────────────────────────────
{
  const mud = "#3E2C1A";
  const print = (x: number, y: number, ang: number, s: number) => {
    let studs = "";
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 2; c++)
        studs += `<ellipse cx="${(c - 0.5) * 9}" cy="${-12 + r * 7}" rx="3.2" ry="4" fill="${mud}" opacity="${(0.6 + rand(r * 2 + c + s, 411) * 0.4).toFixed(2)}"/>`;
    studs += `<ellipse cx="-4.5" cy="20" rx="3.4" ry="4.4" fill="${mud}" opacity="0.8"/><ellipse cx="4.5" cy="20" rx="3.4" ry="4.4" fill="${mud}" opacity="0.8"/>`;
    return `<g transform="translate(${x},${y}) rotate(${ang})">${studs}</g>`;
  };
  const spots = skeletonPoints(34);
  const mow = Array.from({ length: 8 }, (_, i) =>
    `<rect x="${i * 120}" y="0" width="60" height="${H}" fill="#FFFFFF" opacity="0.03"/>`).join("");
  plates.push(svg(`${mow}${spots.map((p, i) => print(p.x, p.y, p.ang + 90 + (rand(i, 413) - 0.5) * 30, i * 5 + 2)).join("")}${speckle(70, 415, "#1A2E1A", 0.16)}${caption("STUD MARKS · EXTRA TIME 2026", "#BBD4BB")}`, "#2A5734", true));
}

// ── 15 · trading cards ──────────────────────────────────────────────────────
{
  const card = (x: number, y: number, ang: number, s: number) => {
    const c = TRIO[Math.floor(rand(s, 421) * 3)]!;
    return `<g transform="translate(${x},${y}) rotate(${ang})">
      <rect x="-17" y="-23" width="34" height="46" rx="3" fill="#F8F3E2" stroke="#B8A77E" stroke-width="1"/>
      <rect x="-13" y="-19" width="26" height="26" fill="${c}" opacity="0.28"/>
      <circle cy="-10" r="6" fill="#8A7A5C"/>
      <path d="M -9 7 Q 0 -2 9 7 Z" fill="#8A7A5C"/>
      <rect x="-13" y="11" width="26" height="7" fill="${c}" opacity="0.85"/>
      <text y="23" text-anchor="middle" font-family="Georgia" font-size="5.5" fill="#8A7A5C">No. ${10 + (s % 16)}</text>
    </g>`;
  };
  const spots = skeletonPoints(36);
  plates.push(svg(`${spots.map((p, i) => card(p.x, p.y, (rand(i, 423) - 0.5) * 22, i * 7 + 3)).join("")}${speckle(50, 425, "#5B4636")}<text x="28" y="40" font-family="Georgia" font-size="12" fill="#7A6A52" letter-spacing="2">COLLECTOR CARDS · SERIES 2026</text>`, "#EFE6CF"));
}

// ── 16 · referee's pocket ───────────────────────────────────────────────────
{
  const refcard = (x: number, y: number, ang: number, s: number) => {
    const yellow = rand(s, 431) > 0.32;
    return `<g transform="translate(${x},${y}) rotate(${ang})">
      <rect x="-11" y="-15" width="22" height="30" rx="2.5" fill="${yellow ? "#E8B30B" : "#C92A2A"}" stroke="#3B3228" stroke-width="0.8" opacity="0.94"/>
      <rect x="-11" y="-15" width="22" height="30" rx="2.5" fill="none" stroke="#FFF" stroke-width="0.5" opacity="0.3"/>
    </g>`;
  };
  const spots = skeletonPoints(42);
  plates.push(svg(`${spots.map((p, i) => refcard(p.x, p.y, (rand(i, 433) - 0.5) * 34, i * 3 + 2)).join("")}${speckle(50, 435, "#5B4636")}${caption("THE REFEREE'S POCKET · DISCIPLINARY RECORD 2026", "#7A6A52")}`, "#F4EEDF"));
}

// ── 17 · goal net ───────────────────────────────────────────────────────────
{
  let net = "";
  for (let i = -20; i < 60; i++) {
    net += `<line x1="${i * 24}" y1="0" x2="${i * 24 + 280}" y2="${H}" stroke="#F2F7F2" stroke-width="1.1" opacity="0.85"/>`;
    net += `<line x1="${i * 24}" y1="0" x2="${i * 24 - 280}" y2="${H}" stroke="#F2F7F2" stroke-width="1.1" opacity="0.85"/>`;
  }
  plates.push(svg(`${CLIP}<g clip-path="url(#g)">${net}</g>${GLYPH("none", 'stroke="#F2F7F2" stroke-width="1.2" opacity="0.5"')}
    <rect x="20" y="14" width="${W - 40}" height="10" fill="#F2F7F2" opacity="0.9"/>
    <rect x="20" y="14" width="10" height="${H - 28}" fill="#F2F7F2" opacity="0.9"/>
    <rect x="${W - 30}" y="14" width="10" height="${H - 28}" fill="#F2F7F2" opacity="0.9"/>
    ${speckle(60, 441, "#F2F7F2", 0.14)}${caption("TOP CORNER · THE NET BULGES", "#9CB89C")}`, "#1B3D24", true));
}

// ── 18 · fan scarves ────────────────────────────────────────────────────────
{
  const scarf = (x: number, y: number, ang: number, len: number, s: number) => {
    const c = TRIO[Math.floor(rand(s, 451) * 3)]!;
    let stripes = "";
    const n = Math.floor(len / 12);
    for (let j = 0; j < n; j++)
      stripes += `<rect x="${-len / 2 + j * 12}" y="-10" width="12" height="20" fill="${j % 2 ? c : "#F6F1E3"}"/>`;
    let fringe = "";
    for (let f = 0; f < 5; f++) {
      fringe += `<line x1="${-len / 2 - 1}" y1="${-8 + f * 4}" x2="${-len / 2 - 7}" y2="${-9 + f * 4.4}" stroke="${c}" stroke-width="1.4"/>`;
      fringe += `<line x1="${len / 2 + 1}" y1="${-8 + f * 4}" x2="${len / 2 + 7}" y2="${-9 + f * 4.4}" stroke="${c}" stroke-width="1.4"/>`;
    }
    return `<g transform="translate(${x},${y}) rotate(${ang})">${stripes}<rect x="${-len / 2}" y="-10" width="${len}" height="20" fill="none" stroke="#3B3228" stroke-width="0.7" opacity="0.6"/>${fringe}</g>`;
  };
  const spots = skeletonPoints(20);
  plates.push(svg(`${spots.map((p, i) => scarf(p.x, p.y, p.ang + (rand(i, 453) - 0.5) * 18, 62 + rand(i, 454) * 22, i * 9 + 1)).join("")}${speckle(50, 455, "#5B4636")}${caption("FROM THE TERRACES · SCARVES UP 2026", "#7A6A52")}`, "#F1E9D6"));
}

// ── finale lockup ───────────────────────────────────────────────────────────
const inter700 = readFileSync(join(REPO, "assets/fonts/inter-700.woff2")).toString("base64");
const inter400 = readFileSync(join(REPO, "assets/fonts/inter-400.woff2")).toString("base64");
const FINALE_HTML = `<style>
  @font-face { font-family: Inter; font-weight: 700; src: url(data:font/woff2;base64,${inter700}) format("woff2"); }
  @font-face { font-family: Inter; font-weight: 400; src: url(data:font/woff2;base64,${inter400}) format("woff2"); }
  body { margin:0; width:${W}px; height:${H}px; background:#0A0A0C; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .bars { display:flex; gap:12px; margin-bottom:26px; }
  .bars i { width:46px; height:7px; border-radius:3.5px; display:block; }
  h1 { font:700 88px Inter; color:#fff; margin:0; letter-spacing:-2px; line-height:1; }
  h1 b { color:#C9A227; font-weight:700; }
  p  { font:400 17px Inter; color:#8B93A7; margin:22px 0 0; letter-spacing:4px; }
  small { font:400 12px Inter; color:#4A5160; margin-top:34px; letter-spacing:1px; }
</style><body>
  <div class="bars"><i style="background:#006847"></i><i style="background:#B22234"></i><i style="background:#26619C"></i></div>
  <h1>WORLD CUP <b>2026</b></h1>
  <p>JUNE — JULY · NORTH AMERICA</p>
  <small>made with reframe</small>
</body>`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  for (let i = 0; i < plates.length; i++) {
    await page.setContent(`<style>body{margin:0}</style>${plates[i]}`);
    await page.screenshot({ path: join(OUT, `frame-${i}.png`) });
  }
  await page.setContent(FINALE_HTML);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `frame-${plates.length}.png`) });
  await browser.close();
  console.log(`wrote ${plates.length} plates + finale to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
