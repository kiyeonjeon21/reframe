// BTC/USD — a "wow" candlestick chart that plays out over time.
//
// Candles draw left to right (time flows), each green on an up-close and red on
// a down-close, a glowing price line traces the closes, a marker rides the front
// of the line, and the big price ticks and flashes green/red with the move. It
// ends on a pump: green run, price flares, percent badge slams in.
//
// The price series is generated with a seeded PRNG (mulberry32) at author time,
// so it bakes into the IR as constants. No Math.random / Date — pure + deterministic.

import {
  scene, group, rect, ellipse, line, path, text,
  seq, par, stagger, beat, tween, wait, oscillate,
  motionPath, linearGradient, glow,
} from "@reframe/core";

const W = 1920, H = 1080;

// palette — dark trading terminal
const BG = "#070A12";
const GRID = "#141A26";
const TXT = "#E8ECF4";
const MUTED = "#6B7488";
const GREEN = "#1ECB81";
const RED = "#FF4D5E";
const LINE = "#56C8FF";

// ── deterministic price series ──────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const N = 36;
const rnd = mulberry32(11);
const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
let p = 42000;
for (let i = 0; i < N; i++) {
  const open = p;
  let drift = 0.008;                 // mild uptrend, volatility does the rest
  if (i > 9 && i < 15) drift = -0.03;  // a correction (red run)
  if (i >= 27) drift = 0.05;           // the pump (green run)
  // high per-candle volatility => candles flip green/red often (choppy "왔다갔다")
  const change = drift + (rnd() - 0.5) * 0.06;
  const close = open * (1 + change);
  highs.push(Math.max(open, close) * (1 + rnd() * 0.012));
  lows.push(Math.min(open, close) * (1 - rnd() * 0.012));
  opens.push(open); closes.push(close);
  p = close;
}

// ── chart geometry ──────────────────────────────────────────────────────────
const X0 = 170, X1 = 1690;          // plot x range (room for right-axis labels)
const TOP = 300, BOT = 900;          // plot y range
const slot = (X1 - X0) / N;
const bodyW = Math.min(26, slot * 0.62);
const pmin = Math.min(...lows) * 0.992;
const pmax = Math.max(...highs) * 1.008;
const xAt = (i: number) => X0 + (i + 0.5) * slot;
const yAt = (v: number) => BOT - ((v - pmin) / (pmax - pmin)) * (BOT - TOP);
const up = (i: number) => closes[i] >= opens[i];

const REVEAL = 0.16;                 // per-candle stagger interval
const REVEAL_DUR = (N - 1) * REVEAL;
const pct = (closes[N - 1] / opens[0] - 1) * 100;

// gridlines + right-axis labels
const GRID_LEVELS = 5;
const gridNodes = Array.from({ length: GRID_LEVELS }, (_, k) => {
  const v = pmin + (k / (GRID_LEVELS - 1)) * (pmax - pmin);
  const gy = yAt(v);
  return [
    line({ id: `grid-${k}`, x1: X0, y1: gy, x2: X1, y2: gy, stroke: GRID, strokeWidth: 1.5 }),
    text({ id: `axis-${k}`, x: X1 + 22, y: gy, anchor: "center-left", content: Math.round(v / 1000), prefix: "$", suffix: "k", contentThousands: true, fontFamily: "Inter", fontSize: 22, fontWeight: 500, fill: MUTED }),
  ];
}).flat();

// candles — each a group (wick + body) revealed in turn
const candleNodes = Array.from({ length: N }, (_, i) => {
  const c = up(i) ? GREEN : RED;
  const x = xAt(i);
  const yo = yAt(opens[i]), yc = yAt(closes[i]);
  const top = Math.min(yo, yc), bot = Math.max(yo, yc);
  return group({ id: `c-${i}`, x: 0, y: 0, opacity: 0 }, [
    line({ id: `wick-${i}`, x1: x, y1: yAt(highs[i]), x2: x, y2: yAt(lows[i]), stroke: c, strokeWidth: 3 }),
    rect({ id: `body-${i}`, x, y: (top + bot) / 2, width: bodyW, height: Math.max(4, bot - top), radius: 2, anchor: "center", fill: c }),
  ]);
});

// glowing close-line that draws on, and a marker that rides its front
const lineD = closes.map((c, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(c).toFixed(1)}`).join(" ");
const dotPts: [number, number][] = closes.map((c, i) => [xAt(i), yAt(c)]);

// big ticking price, stepped through every close, flashing with direction
const priceSteps = seq(
  ...closes.map((c, i) => {
    const prev = i > 0 ? closes[i - 1] : opens[0];
    const dir = c >= prev ? GREEN : RED;
    return par(
      tween("price", { fill: dir }, { duration: 0.03 }),
      tween("price", { content: c }, { duration: REVEAL, ease: "linear" }),
    );
  }),
);

export default scene({
  id: "btc-chart",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    // faint background gradient glow
    ellipse({ id: "bgglow", x: 1400, y: 760, width: 1500, height: 1100, anchor: "center", fill: linearGradient(["#0E2A22", "#070A1200"], { angle: 120 }), opacity: 0.5 }),

    // header
    text({ id: "tkr", x: 170, y: 110, anchor: "center-left", content: "BTC / USD", fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: TXT, letterSpacing: 1, opacity: 0 }),
    ellipse({ id: "live", x: 180, y: 168, width: 14, height: 14, anchor: "center", fill: RED, opacity: 0 }),
    text({ id: "livetx", x: 202, y: 168, anchor: "center-left", content: "LIVE", fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: MUTED, letterSpacing: 3, opacity: 0 }),
    text({ id: "price", x: 1750, y: 138, anchor: "center-right", content: opens[0], prefix: "$", contentThousands: true, contentDecimals: 0, fontFamily: "Inter", fontSize: 92, fontWeight: 800, fill: TXT, shadowColor: GREEN, shadowBlur: 0, opacity: 0 }),
    group({ id: "badge", x: 1660, y: 232, scale: 0.7, opacity: 0 }, [
      rect({ id: "badge-bg", x: 0, y: 0, width: 250, height: 58, radius: 14, anchor: "center", fill: "#0E2A22", stroke: GREEN, strokeWidth: 2 }),
      text({ id: "pct", x: 0, y: 1, anchor: "center", content: 0, prefix: "↑ +", suffix: "%", contentDecimals: 1, fontFamily: "Inter", fontSize: 30, fontWeight: 800, fill: GREEN }),
    ]),

    // grid + axis (start hidden)
    group({ id: "grid", x: 0, y: 0, opacity: 0 }, gridNodes),

    // candles
    ...candleNodes,

    // glowing price line + leading marker
    path({ id: "priceline", d: lineD, stroke: LINE, strokeWidth: 4, fill: "none", progress: 0, ...glow(LINE, 16) }),
    ellipse({ id: "dot", x: dotPts[0][0], y: dotPts[0][1], width: 26, height: 26, anchor: "center", fill: "#FFFFFF", opacity: 0, ...glow(LINE, 26) }),

    // pump glow burst behind the price (revealed at the end)
    ellipse({ id: "burst", x: 1610, y: 138, width: 700, height: 360, anchor: "center", fill: linearGradient([GREEN + "55", GREEN + "00"], { angle: 90 }), opacity: 0, blend: "screen" }),
  ],

  timeline: seq(
    // header + grid in
    beat("intro", {}, [seq(
      par(
        tween("tkr", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
        tween("live", { opacity: 1 }, { duration: 0.4 }),
        tween("livetx", { opacity: 1 }, { duration: 0.4 }),
        tween("price", { opacity: 1 }, { duration: 0.4 }),
        tween("grid", { opacity: 1 }, { duration: 0.5 }),
      ),
    )]),

    // candles draw on over time, line traces, marker rides, price ticks
    beat("reveal", {}, [par(
      tween("dot", { opacity: 1 }, { duration: 0.2 }),
      stagger(REVEAL, ...candleNodes.map((_, i) => tween(`c-${i}`, { opacity: 1 }, { duration: 0.22, ease: "easeOutQuad" }))),
      tween("priceline", { progress: 1 }, { duration: REVEAL_DUR, ease: "linear" }),
      motionPath("dot", dotPts, { duration: REVEAL_DUR, curviness: 0, label: "dotrun" }),
      priceSteps,
    )]),

    // the pump payoff
    beat("wow", {}, [seq(
      par(
        tween("price", { scale: 1.14, fill: GREEN, shadowBlur: 36 }, { duration: 0.4, ease: "easeOutBack", label: "flare" }),
        tween("badge", { opacity: 1, scale: 1 }, { duration: 0.4, ease: "easeOutBack" }),
        tween("pct", { content: pct }, { duration: 0.9, ease: "easeOutCubic" }),
        tween("burst", { opacity: 0.9 }, { duration: 0.4 }),
        tween("dot", { scale: 1.5 }, { duration: 0.4, ease: "easeOutBack" }),
      ),
      tween("price", { scale: 1.05 }, { duration: 0.2 }),
      wait(2.2, "end"),
    )]),
  ),

  behaviors: [
    oscillate("live", "opacity", { amplitude: 0.5, frequency: 1.2 }),     // blinking LIVE dot
    oscillate("dot", "shadowBlur", { amplitude: 8, frequency: 1.6 }, { from: 0.6, until: 12 }), // pulsing marker glow
  ],

  audio: {
    bgm: { synth: "pulse", gain: 0.16, fadeIn: 0.8, fadeOut: 2, duck: { depth: 0.4 } },
    cues: [
      { at: "reveal", sfx: "riser", gain: 0.4 },
      { at: "dotrun", sfx: "scan", gain: 0.3 },
      { at: "wow", sfx: "boom", gain: 0.6 },
      { at: "wow", offset: 0.1, sfx: "success", gain: 0.5 },
      { at: "wow", offset: 0.3, sfx: "sparkle", gain: 0.45 },
    ],
  },
});
