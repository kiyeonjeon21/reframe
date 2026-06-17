// One-time generator: orthographic projection of Natural Earth 110m land onto the
// zoom-to-space globe disc, centered on a chosen coastal city. Emits disc-space SVG
// path `d` strings (recognizable continents) into world-earth.ts. Public-domain data.
//
//   node gen-world.mjs   (reads /tmp/land110.json, writes ../lib/world-earth.ts)
//
// The projection centers the camera on (LON0, LAT0); that point lands at the disc
// origin (0,0), so the city anchored there shares the continent's real coastline —
// one shape serves both the street-level start and the from-space silhouette.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const EARTH_R = 760;
// Camera centre: the US East Coast (≈ New York). Puts North America filling the disc,
// the Atlantic to the south-east, with the origin sitting right on a real coastline for
// the street-level open. Slightly inland so the city is on land, the sea just offshore.
const LON0 = -74.0, LAT0 = 40.8;

const RAD = Math.PI / 180;
const lon0 = LON0 * RAD, lat0 = LAT0 * RAD;
const sinLat0 = Math.sin(lat0), cosLat0 = Math.cos(lat0);

// orthographic: cosc<0 → far side (hidden). North is up (negate screen y).
function cosc(lonr, latr) {
  return sinLat0 * Math.sin(latr) + cosLat0 * Math.cos(latr) * Math.cos(lonr - lon0);
}
function project(lonDeg, latDeg) {
  const lonr = lonDeg * RAD, latr = latDeg * RAD;
  const x = Math.cos(latr) * Math.sin(lonr - lon0);
  const y = cosLat0 * Math.sin(latr) - sinLat0 * Math.cos(latr) * Math.cos(lonr - lon0);
  return [x * EARTH_R, -y * EARTH_R];
}

// binary-search the limb crossing (cosc=0) between a visible and a hidden vertex
function limbCross(a, b) {
  let lo = 0, hi = 1;
  const ca = cosc(a[0] * RAD, a[1] * RAD);
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    const lon = a[0] + (b[0] - a[0]) * m, lat = a[1] + (b[1] - a[1]) * m;
    const c = cosc(lon * RAD, lat * RAD);
    if ((c >= 0) === (ca >= 0)) lo = m; else hi = m;
  }
  const t = (lo + hi) / 2;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// split a ring (lon/lat) into visible polylines in disc space, inserting limb points
function visibleRuns(ring) {
  const n = ring.length;
  const vis = ring.map((p) => cosc(p[0] * RAD, p[1] * RAD) >= 0);
  if (vis.every((v) => !v)) return [];
  if (vis.every((v) => v)) return [ring.map((p) => project(p[0], p[1]))]; // whole loop visible
  // find a hidden→visible boundary to start
  let start = 0;
  while (!(vis[start] === false && vis[(start + 1) % n] === true)) start++;
  const runs = [];
  let cur = null;
  for (let k = 0; k <= n; k++) {
    const i = (start + k) % n, j = (start + k + 1) % n;
    if (vis[i]) {
      if (!cur) cur = [];
      cur.push(project(ring[i][0], ring[i][1]));
      if (!vis[j]) { cur.push(project(...limbCross(ring[i], ring[j]))); runs.push(cur); cur = null; }
    } else if (vis[j]) {
      cur = [project(...limbCross(ring[i], ring[j]))];
    }
  }
  if (cur && cur.length) runs.push(cur);
  return runs;
}

// Douglas–Peucker in screen space
function dp(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

const geo = JSON.parse(readFileSync("/tmp/land110.json", "utf8"));
const rings = [];
for (const f of geo.features) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const poly of polys) rings.push(poly[0]); // exterior ring only
}

const TOL = 1.4;     // screen-space simplify tolerance (units, EARTH_R=760)
const MIN_SPAN = 9;  // drop specks smaller than this (bbox diagonal)
const out = [];
for (const ring of rings) {
  for (const run of visibleRuns(ring)) {
    const simp = dp(run, TOL);
    if (simp.length < 4) continue;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, minR = 1e9;
    for (const [x, y] of simp) { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); minR = Math.min(minR, Math.hypot(x, y)); }
    if (Math.hypot(maxx - minx, maxy - miny) < MIN_SPAN) continue;
    // drop far-limb slivers (all vertices hug the rim) — their chord-close cuts an
    // artifact band across the disc, and they aren't recognizable land anyway.
    if (minR > 0.65 * EARTH_R) continue;
    const d = "M " + simp.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ") + " Z";
    out.push({ d, span: Math.hypot(maxx - minx, maxy - miny) });
  }
}
out.sort((a, b) => b.span - a.span); // big landmasses first (draw order)

const body = out.map((o) => `  ${JSON.stringify(o.d)},`).join("\n");
const ts = `// AUTO-GENERATED by gen-world.mjs — orthographic projection of Natural Earth 110m
// land (public domain) onto the globe disc, camera centred at lon ${LON0}, lat ${LAT0}
// (a real coastline). Disc radius ${EARTH_R}; origin = the city. Do not edit by hand.
export const WORLD_CENTER = { lon: ${LON0}, lat: ${LAT0} };
export const EARTH_DISC_R = ${EARTH_R};
export const LAND_PATHS: string[] = [
${body}
];
`;
writeFileSync(join(__dir, "world-earth.ts"), ts);
console.log(`wrote ${out.length} land paths, ${ts.length} bytes`);
