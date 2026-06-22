/**
 * Brand / design tokens as code. `brand` is the reframe house style (the values
 * documented in DESIGN.md); `theme(overrides)` returns a copy with `overrides`
 * deep-merged on top, so a consumer can define their own brand kit once and
 * reference it across scenes.
 *
 * Pure data: a theme emits nothing into the IR, so referencing a token in a scene
 * (`fill: brand.color.accent`) is byte-identical to writing the literal. This file
 * is the source of truth; DESIGN.md documents the same values.
 */
import type { EaseName, Size } from "./ir.js";

/** A text style bundle, spreadable into a `text()` node: `text({ ...brand.type.headline, content })`. */
export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing?: number;
}

export interface Theme {
  color: {
    bg: string;
    surface: string;
    surface2: string;
    fg: string;
    muted: string;
    mutedNeutral: string;
    accent: string;
    accent2: string;
    dataViz: string[];
  };
  type: {
    family: string;
    display: TypeStyle;
    headline: TypeStyle;
    body: TypeStyle;
    label: TypeStyle;
  };
  motion: {
    ease: { base: EaseName; enter: EaseName; exit: EaseName; playful: EaseName };
    energy: number;
    speed: number;
    dur: { micro: number; base: number; slow: number };
  };
  audio: { bgm: string[]; sfx: string[] };
  layout: {
    size: Size;
    fps: number;
    margin: number;
    radius: { bar: number; card: number; panel: number };
  };
}

/** The reframe house brand. Mirrors the DESIGN.md token front matter. */
export const brand: Theme = {
  color: {
    bg: "#0A0C14",
    surface: "#161922",
    surface2: "#1E222D",
    fg: "#FFFFFF",
    muted: "#8B93A7",
    mutedNeutral: "#8E8E93",
    accent: "#FF4D00",
    accent2: "#00C2A8",
    dataViz: ["#54D6C0", "#7C5CFF", "#FF6FA5", "#FFC861"],
  },
  type: {
    family: "Inter",
    display: { fontFamily: "Inter", fontSize: 92, fontWeight: 800 },
    headline: { fontFamily: "Inter", fontSize: 48, fontWeight: 700 },
    body: { fontFamily: "Inter", fontSize: 24, fontWeight: 400 },
    label: { fontFamily: "Inter", fontSize: 18, fontWeight: 600, letterSpacing: 2 },
  },
  motion: {
    ease: { base: "easeOutCubic", enter: "easeOutBack", exit: "easeInOutQuad", playful: "springBouncy" },
    energy: 0.5,
    speed: 1,
    dur: { micro: 0.3, base: 0.5, slow: 1.0 },
  },
  audio: {
    bgm: ["ambient-pad", "lofi", "pulse", "tension", "uplift"],
    sfx: ["whoosh", "thud", "pop", "click", "confirm", "shimmer", "swoosh", "keypress", "footstep"],
  },
  layout: {
    size: { width: 1920, height: 1080 },
    fps: 30,
    margin: 96,
    radius: { bar: 6, card: 24, panel: 56 },
  },
};

/** Recursive-partial of `Theme`: override any leaf or subtree; arrays are replaced whole. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge `over` onto `base`, returning a new object. Objects merge; scalars and arrays replace. Never mutates `base`. */
function mergeInto<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over as T) ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const bv = base[k];
    out[k] = isPlainObject(bv) && isPlainObject(v) ? mergeInto(bv, v) : v;
  }
  return out as T;
}

/** A theme with `overrides` deep-merged onto the house `brand`. Pure; never mutates `brand`. */
export function theme(overrides: DeepPartial<Theme> = {}): Theme {
  return mergeInto(brand, overrides);
}
