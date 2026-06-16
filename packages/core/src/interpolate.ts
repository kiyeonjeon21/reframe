import type { Ease, PropValue } from "./ir.js";

type EaseFn = (u: number) => number;

// expressive-ease constants (GSAP / easings.net defaults)
const BACK_C1 = 1.70158;
const BACK_C2 = BACK_C1 * 1.525;
const BACK_C3 = BACK_C1 + 1;
const ELASTIC_C4 = (2 * Math.PI) / 3;
const ELASTIC_C5 = (2 * Math.PI) / 4.5;

/** Canonical 4-segment bounce; the in/inout variants are reflections of it. */
function easeOutBounce(u: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (u < 1 / d1) return n1 * u * u;
  if (u < 2 / d1) return n1 * (u -= 1.5 / d1) * u + 0.75;
  if (u < 2.5 / d1) return n1 * (u -= 2.25 / d1) * u + 0.9375;
  return n1 * (u -= 2.625 / d1) * u + 0.984375;
}

const EASE_TABLE: Record<string, EaseFn> = {
  linear: (u) => u,
  easeInQuad: (u) => u * u,
  easeOutQuad: (u) => 1 - (1 - u) * (1 - u),
  easeInOutQuad: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
  easeInCubic: (u) => u ** 3,
  easeOutCubic: (u) => 1 - (1 - u) ** 3,
  easeInOutCubic: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
  easeInQuart: (u) => u ** 4,
  easeOutQuart: (u) => 1 - (1 - u) ** 4,
  easeInOutQuart: (u) => (u < 0.5 ? 8 * u ** 4 : 1 - (-2 * u + 2) ** 4 / 2),
  easeInExpo: (u) => (u === 0 ? 0 : 2 ** (10 * u - 10)),
  easeOutExpo: (u) => (u === 1 ? 1 : 1 - 2 ** (-10 * u)),
  easeInOutExpo: (u) =>
    u === 0 ? 0 : u === 1 ? 1 : u < 0.5 ? 2 ** (20 * u - 10) / 2 : (2 - 2 ** (-20 * u + 10)) / 2,
  // --- expressive eases (GSAP's signature feel) — standard Penner equations ---
  // back: overshoots past the target then settles (pop / snap)
  easeInBack: (u) => BACK_C3 * u ** 3 - BACK_C1 * u * u,
  easeOutBack: (u) => 1 + BACK_C3 * (u - 1) ** 3 + BACK_C1 * (u - 1) ** 2,
  easeInOutBack: (u) =>
    u < 0.5
      ? ((2 * u) ** 2 * ((BACK_C2 + 1) * 2 * u - BACK_C2)) / 2
      : ((2 * u - 2) ** 2 * ((BACK_C2 + 1) * (2 * u - 2) + BACK_C2) + 2) / 2,
  // elastic: rings around the target before settling (playful spring)
  easeInElastic: (u) =>
    u === 0 ? 0 : u === 1 ? 1 : -(2 ** (10 * u - 10)) * Math.sin((u * 10 - 10.75) * ELASTIC_C4),
  easeOutElastic: (u) =>
    u === 0 ? 0 : u === 1 ? 1 : 2 ** (-10 * u) * Math.sin((u * 10 - 0.75) * ELASTIC_C4) + 1,
  easeInOutElastic: (u) =>
    u === 0
      ? 0
      : u === 1
        ? 1
        : u < 0.5
          ? -(2 ** (20 * u - 10) * Math.sin((20 * u - 11.125) * ELASTIC_C5)) / 2
          : (2 ** (-20 * u + 10) * Math.sin((20 * u - 11.125) * ELASTIC_C5)) / 2 + 1,
  // bounce: drops and bounces to rest (lands without overshoot)
  easeInBounce: (u) => 1 - easeOutBounce(1 - u),
  easeOutBounce,
  easeInOutBounce: (u) =>
    u < 0.5 ? (1 - easeOutBounce(1 - 2 * u)) / 2 : (1 + easeOutBounce(2 * u - 1)) / 2,
};

export const EASE_NAMES = Object.keys(EASE_TABLE) as import("./ir.js").EaseName[];

export function resolveEase(ease: Ease | undefined): EaseFn {
  if (ease === undefined) return EASE_TABLE.linear!;
  if (typeof ease === "string") {
    const fn = EASE_TABLE[ease];
    if (!fn) throw new Error(`unknown ease "${ease}" — valid: ${Object.keys(EASE_TABLE).join(", ")}`);
    return fn;
  }
  return cubicBezierEase(...ease.cubicBezier);
}

/** CSS-style cubic-bezier((0,0) p1 p2 (1,1)) solved by Newton + bisection fallback. */
function cubicBezierEase(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const bez = (a: number, b: number) => (t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const bx = bez(x1, x2);
  const by = bez(y1, y2);
  const dbx = (t: number) =>
    3 * x1 * (1 - t) * (1 - 3 * t) + 3 * x2 * t * (2 - 3 * t) + 3 * t * t;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 8; i++) {
      const err = bx(t) - u;
      if (Math.abs(err) < 1e-6) return by(t);
      const d = dbx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = u;
    while (hi - lo > 1e-6) {
      if (bx(t) < u) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return by(t);
  };
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isColor(v: PropValue): v is string {
  return typeof v === "string" && HEX_COLOR.test(v);
}

function parseColor(hex: string): [number, number, number, number] {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.padEnd(8, "f"), 16);
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function formatColor([r, g, b, a]: [number, number, number, number]): string {
  const hex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return a >= 255 ? `#${hex(r)}${hex(g)}${hex(b)}` : `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
}

/**
 * Interpolate two prop values at progress u (already eased).
 * number↔number lerps, color↔color lerps in RGB, two *compatible* SVG path
 * `d` strings morph vertex-by-vertex (the Lottie-style shape tween), anything
 * else switches discretely.
 */
export function lerpValue(from: PropValue, to: PropValue, u: number): PropValue {
  if (typeof from === "number" && typeof to === "number") {
    return from + (to - from) * u;
  }
  if (isColor(from) && isColor(to)) {
    const a = parseColor(from);
    const b = parseColor(to);
    return formatColor([
      a[0] + (b[0] - a[0]) * u,
      a[1] + (b[1] - a[1]) * u,
      a[2] + (b[2] - a[2]) * u,
      a[3] + (b[3] - a[3]) * u,
    ]);
  }
  if (looksLikePath(from) && looksLikePath(to)) {
    const a = tokenizePath(from);
    const b = tokenizePath(to);
    if (a && b && morphCompatible(a, b)) return morphPath(a, b, u);
    return u < 0.5 ? from : to; // incompatible shapes: swap at the midpoint
  }
  return to;
}

// --- SVG path morphing ----------------------------------------------------
// A path `d` is animatable: tween it between two poses and the vertices lerp.
// This only fires when BOTH endpoints look like path data; everything else
// (text, "none", arbitrary strings) is left to the discrete switch above.

type PathCmd = { cmd: string; nums: number[] };

const PATH_BODY = /^[\sMmLlHhVvCcSsQqTtAaZz0-9.,eE+-]+$/;
function looksLikePath(v: PropValue): v is string {
  return typeof v === "string" && /^\s*[Mm]/.test(v) && PATH_BODY.test(v);
}

const PATH_TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
function tokenizePath(d: string): PathCmd[] | null {
  const out: PathCmd[] = [];
  let cur: PathCmd | null = null;
  let m: RegExpExecArray | null;
  PATH_TOKEN.lastIndex = 0;
  while ((m = PATH_TOKEN.exec(d))) {
    if (m[1]) out.push((cur = { cmd: m[1], nums: [] }));
    else if (m[2]) {
      if (!cur) return null; // a number before any command — not valid path data
      cur.nums.push(parseFloat(m[2]));
    }
  }
  return out.length ? out : null;
}

/** Same command sequence and arg counts, and no arc (A/a) whose 0/1 flags
 * can't be linearly interpolated — only then can we morph vertex-by-vertex. */
function morphCompatible(a: PathCmd[], b: PathCmd[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i]!;
    const cb = b[i]!;
    if (ca.cmd !== cb.cmd || ca.nums.length !== cb.nums.length) return false;
    if (ca.cmd === "A" || ca.cmd === "a") return false;
  }
  return true;
}

const fmtNum = (v: number): string => {
  const r = Number(v.toFixed(3));
  return Object.is(r, -0) ? "0" : String(r);
};

function morphPath(a: PathCmd[], b: PathCmd[], u: number): string {
  let s = "";
  for (let i = 0; i < a.length; i++) {
    const an = a[i]!.nums;
    const bn = b[i]!.nums;
    s += (i ? " " : "") + a[i]!.cmd;
    for (let j = 0; j < an.length; j++) s += " " + fmtNum(an[j]! + (bn[j]! - an[j]!) * u);
  }
  return s;
}
