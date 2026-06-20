/**
 * Device-mockup presets — a parametric vector frame (phone/laptop/browser/…) with
 * a CLIPPED screen "content slot". The sibling of motionPreset — that generates
 * a TimelineIR, this generates a NodeIR subtree. Pure primitives + clip, so no
 * assets and fully deterministic (plain JSON, no Date/random).
 *
 *   devicePreset("phone", { id: "hero", content: [ ...your UI nodes ] })
 *
 * Redesigned around three orthogonal layers (all back-compat; the public surface
 * and the stable ids `${id}` / `${id}-screen` / `${id}-content` are unchanged):
 *
 *  1. A `DeviceCtx` resolved once (palette + dims + material + style + a seeded
 *     PRNG) and threaded to every part.
 *  2. A small PARTS vocabulary (`slab`, `screenStack`, `phoneNotch`, …) where the
 *     material/lighting lives ONCE, so every chassis — and every future chassis —
 *     inherits the premium look for free.
 *  3. A `CHASSIS` registry (name → builder) that just ARRANGES parts; adding a
 *     device is one entry + one `SCREENS`/`BOUNDS` row, not a new `switch` arm.
 *
 * Material is PREMIUM by default (gradient body, ambient screen glow, soft contact
 * shadow, glass glare) — `material:"flat"` opts back to clean flat fills. `style`
 * picks "glass" (realistic) or "neon" (graphic, additive edge glow). Each instance
 * auto-varies from its `id` (a deterministic seed) within bounded, on-model ranges;
 * pass `seed` to pin or explore. A 2.5D vector tier — no true perspective.
 *
 * Each instance needs a distinct `id` (it prefixes every generated node id);
 * two with the same prefix collide via the scene's duplicate-id validation.
 *
 * Layout/teardown helpers: `deviceScreen` (content-local screen bounds),
 * `deviceScreenCenter` (device-local screen origin — slide `${id}-screen` against
 * it to eject the panel for an exploded view), `deviceBounds` (full frame
 * footprint — for laying many devices on a grid).
 */

import { ellipse, group, path, rect, text } from "./dsl.js";
import { dropShadow, glow } from "./effects.js";
import { linearGradient, radialGradient } from "./gradient.js";
import type { NodeIR, Paint } from "./ir.js";

export const DEVICE_PRESET_NAMES = ["phone", "tablet", "laptop", "browser", "watch", "monitor", "tv", "foldable", "terminal", "car"] as const;
export type DevicePresetName = (typeof DEVICE_PRESET_NAMES)[number];

/** Visual fidelity tier. `premium` (default) layers gradient/glow/shadow on top
 *  of the silhouette; `flat` is clean solid fills (lightest, golden-style). */
export type DeviceMaterial = "premium" | "flat";
/** Premium aesthetic. `glass` = realistic glass/metal + soft shadow; `neon` =
 *  flat body + additive edge glow (graphic, motion-graphics punch). */
export type DeviceStyle = "glass" | "neon";
/** Phone front-camera treatment. Defaults to the iOS-style dynamic island. */
export type DeviceNotch = "island" | "notch" | "punch" | "none";

export interface DevicePresetOpts {
  /** Id PREFIX for every generated node (default "device"). Make it unique per instance. */
  id?: string;
  /** Device-center placement (default 0,0). */
  x?: number;
  y?: number;
  /** Uniform scale (default 1). */
  scale?: number;
  /** Outer-group opacity (default 1) — handy to start hidden for an entrance. */
  opacity?: number;
  /** Body palette (default "dark"). */
  color?: "dark" | "light";
  /** Screen background fill override (default per palette). */
  screen?: string;
  /** Portrait/landscape — phone & tablet only (default "portrait"). */
  orientation?: "portrait" | "landscape";
  /** Nodes placed inside the screen (authored in screen-LOCAL centre coords), clipped. */
  content?: NodeIR[];
  /** Browser/terminal address-bar text. */
  url?: string;
  /** Visual tier (default "premium"). */
  material?: DeviceMaterial;
  /** Premium aesthetic (default "glass"). */
  style?: DeviceStyle;
  /** Deterministic variation. Omit ⇒ derived from `id` (each instance differs);
   *  same value ⇒ identical; different value ⇒ same family, varied. */
  seed?: number;
  /** Phone front-camera style (default "island"). */
  notch?: DeviceNotch;
}

interface Palette {
  body: string;
  bodyStroke: string;
  /** Premium glass body gradient (top-light → bottom-dark). */
  bodyGrad: [string, string];
  screen: string;
  detail: string;
  chrome: string;
  /** Premium glass chrome gradient (window/title-bar bodies). */
  chromeGrad: [string, string];
  chromeText: string;
  /** Premium ambient screen-glow tint. */
  ambient: string;
}
const DARK: Palette = {
  body: "#15161C",
  bodyStroke: "#2A2D38",
  bodyGrad: ["#272A35", "#0E0F15"],
  screen: "#0E0F15",
  detail: "#3A3D48",
  chrome: "#1B1D24",
  chromeGrad: ["#23262F", "#141620"],
  chromeText: "#9AA0AD",
  ambient: "#9FB4FF",
};
const LIGHT: Palette = {
  body: "#E7E9EE",
  bodyStroke: "#C3C7D1",
  bodyGrad: ["#FAFBFD", "#D4D8E1"],
  screen: "#FFFFFF",
  detail: "#AEB3C0",
  chrome: "#F2F3F6",
  chromeGrad: ["#FCFCFE", "#E2E5EC"],
  chromeText: "#5B606C",
  ambient: "#7C9BFF",
};

/** Neon accents — seed-picked so neon devices vary in hue per instance. */
const NEON_ACCENTS = ["#00E5FF", "#FF3DCB", "#7C5CFF", "#3DFF88", "#FF7A00"];

interface ScreenRect {
  width: number;
  height: number;
  radius: number;
  /** Screen-group centre in device-local coords (default 0,0). */
  cx?: number;
  cy?: number;
}
/** Portrait screen content area per device (content-local, centred). `cx/cy` is
 *  where the screen sits inside the frame (some chassis offset the panel). */
const SCREENS: Record<DevicePresetName, ScreenRect> = {
  phone: { width: 352, height: 736, radius: 38 },
  tablet: { width: 544, height: 764, radius: 18 },
  laptop: { width: 840, height: 520, radius: 8, cy: -150 },
  browser: { width: 984, height: 568, radius: 6, cy: 24 },
  watch: { width: 184, height: 224, radius: 44 },
  monitor: { width: 1056, height: 600, radius: 6 },
  tv: { width: 1280, height: 720, radius: 8, cy: -24 },
  foldable: { width: 760, height: 560, radius: 20 },
  terminal: { width: 900, height: 560, radius: 6, cy: 18 },
  car: { width: 1000, height: 520, radius: 24 },
};

/** Full frame footprint per device (incl. chrome/stand) — for grid layout. */
const BOUNDS: Record<DevicePresetName, { width: number; height: number }> = {
  phone: { width: 392, height: 812 },
  tablet: { width: 600, height: 820 },
  laptop: { width: 1100, height: 650 },
  browser: { width: 1000, height: 660 },
  watch: { width: 220, height: 300 },
  monitor: { width: 1120, height: 860 },
  tv: { width: 1340, height: 920 },
  foldable: { width: 800, height: 600 },
  terminal: { width: 916, height: 636 },
  car: { width: 1060, height: 600 },
};

const isLandscape = (name: DevicePresetName, o: DevicePresetOpts): boolean =>
  (name === "phone" || name === "tablet") && o.orientation === "landscape";

function screenDims(name: DevicePresetName, o: DevicePresetOpts): Required<ScreenRect> {
  const d = SCREENS[name];
  const base = { cx: d.cx ?? 0, cy: d.cy ?? 0 };
  return isLandscape(name, o)
    ? { width: d.height, height: d.width, radius: d.radius, ...base }
    : { width: d.width, height: d.height, radius: d.radius, ...base };
}

/** The screen's content area (content-local coords: origin 0,0 = screen centre,
 *  pre-scale). Author/scroll `content` against these bounds. */
export function deviceScreen(name: DevicePresetName, opts: DevicePresetOpts = {}): { x: number; y: number; width: number; height: number; radius: number } {
  const d = screenDims(name, opts);
  return { x: 0, y: 0, width: d.width, height: d.height, radius: d.radius };
}

/** The screen group's centre in device-LOCAL coords. Slide `${id}-screen` against
 *  this (e.g. `y: deviceScreenCenter(name).y + 160`) to eject the panel from the
 *  frame for an exploded / teardown view. */
export function deviceScreenCenter(name: DevicePresetName, opts: DevicePresetOpts = {}): { x: number; y: number } {
  const d = screenDims(name, opts);
  return { x: d.cx, y: d.cy };
}

/** Full frame footprint (width/height incl. chrome & stands) in device-local
 *  units — use it to scale many devices onto a shared grid. */
export function deviceBounds(name: DevicePresetName, opts: DevicePresetOpts = {}): { width: number; height: number } {
  const b = BOUNDS[name];
  return isLandscape(name, opts) ? { width: b.height, height: b.width } : { ...b };
}

/** Map a SCREEN-LOCAL point (origin = screen centre, the coords `content` is
 *  authored in) to absolute SCENE coords, given the same `opts` passed to
 *  `devicePreset`. For aiming a `cursor` at on-screen UI. */
export function deviceScreenPoint(name: DevicePresetName, opts: DevicePresetOpts, local: [number, number]): [number, number] {
  const c = deviceScreenCenter(name, opts);
  const s = opts.scale ?? 1;
  return [(opts.x ?? 0) + s * (c.x + local[0]), (opts.y ?? 0) + s * (c.y + local[1])];
}

// ── seeded variation (mulberry32, replicated from presets.ts so determinism
//    matches the rest of the vocabulary exactly; no Math.random, ever) ──
function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** FNV-1a string hash → a stable integer seed from the instance id. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── the resolved per-instance context every part reads from ──
interface DeviceCtx {
  id: string;
  palette: Palette;
  material: DeviceMaterial;
  style: DeviceStyle;
  /** Premium neon accent (also used as the glass body-stroke hint). */
  accent: string;
  /** Outer scale — premium effects are screen-pixel space, so they're pre-scaled
   *  by this to stay proportional on a shrunk device. */
  s: number;
  rng: () => number;
  /** Symmetric jitter in [-amp, amp]. */
  jit: (amp: number) => number;
  o: DevicePresetOpts;
}

function makeCtx(opts: DevicePresetOpts): DeviceCtx {
  const id = opts.id ?? "device";
  const palette = opts.color === "light" ? LIGHT : DARK;
  const material: DeviceMaterial = opts.material ?? "premium";
  const style: DeviceStyle = opts.style ?? "glass";
  const seed = (opts.seed ?? hashId(id)) >>> 0;
  const rng = makeRng(seed + 1);
  const accent = NEON_ACCENTS[Math.floor(rng() * NEON_ACCENTS.length)] ?? NEON_ACCENTS[0]!;
  return {
    id,
    palette,
    material,
    style,
    accent,
    s: opts.scale ?? 1,
    rng,
    jit: (amp: number) => (rng() - 0.5) * 2 * amp,
    o: opts,
  };
}

const isPremium = (c: DeviceCtx) => c.material === "premium";
const isNeon = (c: DeviceCtx) => c.material === "premium" && c.style === "neon";

// ── parts: the ONE place material + lighting + jitter live ──

/** Body/panel/window fill: flat & neon use the solid; glass uses a gradient pair. */
function premiumFill(c: DeviceCtx, solid: string, grad: [string, string]): Paint {
  if (!isPremium(c) || c.style === "neon") return solid;
  return linearGradient(grad, { angle: 125 + c.jit(12) });
}
/** Primary-body stroke colour: neon glows on its accent edge. */
const bodyStroke = (c: DeviceCtx, fallback: string): string => (isNeon(c) ? c.accent : fallback);
/** Premium light: a soft contact shadow (glass) or an additive edge glow (neon),
 *  pre-scaled to the device scale. Flat ⇒ nothing (golden-safe — no op fields). */
function bodyFx(c: DeviceCtx): Record<string, number | string> {
  if (!isPremium(c)) return {};
  return isNeon(c)
    ? glow(c.accent, (24 + c.jit(5)) * c.s)
    : dropShadow("rgba(0,0,0,0.5)", 46 * c.s, 0, 24 * c.s);
}

/** The chassis slab — body/panel rect with premium fill, stroke and light. */
function slab(c: DeviceCtx, suffix: string, x: number, y: number, w: number, h: number, r: number, grad: [string, string], solid: string, strokeC: string): NodeIR {
  return rect({
    id: `${c.id}-${suffix}`,
    x,
    y,
    anchor: "center",
    width: w,
    height: h,
    radius: r,
    fill: premiumFill(c, solid, grad),
    stroke: bodyStroke(c, strokeC),
    strokeWidth: isNeon(c) ? 2.5 : 2,
    ...bodyFx(c),
  });
}

/** The clipped screen group: bg + premium ambient wash + the `${id}-content`
 *  handle the caller animates + a premium glass glare on top. Ids unchanged. */
function screenStack(c: DeviceCtx, cx: number, cy: number, dims: Required<ScreenRect>, content: NodeIR[]): NodeIR {
  const children: NodeIR[] = [
    rect({ id: `${c.id}-screenbg`, x: 0, y: 0, anchor: "center", width: dims.width, height: dims.height, fill: c.o.screen ?? c.palette.screen }),
  ];
  if (isPremium(c)) {
    // ambient glow rising from the lower screen (cool wash for glass, accent for neon)
    const tint = isNeon(c) ? c.accent : c.palette.ambient;
    children.push(
      rect({
        id: `${c.id}-ambient`,
        x: 0,
        y: 0,
        anchor: "center",
        width: dims.width,
        height: dims.height,
        fill: radialGradient([`${tint}33`, `${tint}00`], { cy: 0.32, r: 0.72 }),
        opacity: isNeon(c) ? 0.55 : 0.32,
        blend: "screen",
      }),
    );
  }
  children.push(group({ id: `${c.id}-content`, x: 0, y: 0 }, content));
  if (isPremium(c) && c.style === "glass") {
    // a diagonal sheen across the glass — clipped to the screen, screen-blended
    const ang = 22 + c.jit(9);
    children.push(
      rect({
        id: `${c.id}-glare`,
        x: -dims.width * 0.18,
        y: 0,
        anchor: "center",
        width: dims.width * 0.46,
        height: dims.height * 1.8,
        fill: "#FFFFFF",
        opacity: 0.05 + Math.abs(c.jit(0.025)),
        rotation: ang,
        blend: "screen",
      }),
    );
  }
  return group({ id: `${c.id}-screen`, x: cx, y: cy, clip: { kind: "rect", x: -dims.width / 2, y: -dims.height / 2, width: dims.width, height: dims.height, radius: dims.radius } }, children);
}

/** Phone front-camera treatment (portrait). Id stays `${id}-notch` for every style. */
function phoneNotch(c: DeviceCtx, style: DeviceNotch, sh: number): NodeIR | null {
  const yTop = -sh / 2 + 16;
  switch (style) {
    case "none":
      return null;
    case "punch":
      return rect({ id: `${c.id}-notch`, x: 0, y: yTop + 2, anchor: "center", width: 18, height: 18, fill: "#000000", radius: 9 });
    case "notch":
      return rect({ id: `${c.id}-notch`, x: 0, y: -sh / 2 + 11, anchor: "center", width: 150, height: 26, fill: "#000000", radius: 13 });
    case "island":
    default:
      return rect({ id: `${c.id}-notch`, x: 0, y: yTop, anchor: "center", width: 96, height: 30, fill: "#000000", radius: 15 });
  }
}

const urlText = (url: string | undefined): string => {
  const u = url ?? "reframe.video";
  return u.length > 70 ? `${u.slice(0, 67)}…` : u;
};

// ── the chassis registry: each entry ARRANGES parts (no raw palette painting) ──
const CHASSIS: Record<DevicePresetName, (c: DeviceCtx, dims: Required<ScreenRect>, content: NodeIR[]) => NodeIR[]> = {
  phone: (c, dims, content) => phoneOrTablet("phone", c, dims, content),
  tablet: (c, dims, content) => phoneOrTablet("tablet", c, dims, content),
  laptop: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const lidTop = dims.cy - (sh + 40) / 2;
    const keyRows = [0, 1, 2, 3].map((r) =>
      rect({ id: `${c.id}-keys${r}`, x: 0, y: 150 + r * 11, anchor: "center", width: 640 + r * 50, height: 6, fill: p.chrome, radius: 3 }),
    );
    return [
      path({ id: `${c.id}-base`, x: 0, y: 0, d: "M -450 140 L 450 140 L 520 196 L -520 196 Z", fill: premiumFill(c, p.body, p.bodyGrad), stroke: bodyStroke(c, p.bodyStroke), strokeWidth: isNeon(c) ? 2.5 : 2, ...bodyFx(c) }),
      rect({ id: `${c.id}-foot-l`, x: -360, y: 198, anchor: "center", width: 70, height: 5, fill: p.detail, radius: 3 }),
      rect({ id: `${c.id}-foot-r`, x: 360, y: 198, anchor: "center", width: 70, height: 5, fill: p.detail, radius: 3 }),
      ...keyRows,
      rect({ id: `${c.id}-trackpad`, x: 0, y: 184, anchor: "center", width: 150, height: 8, fill: p.detail, radius: 4 }),
      rect({ id: `${c.id}-hinge`, x: 0, y: 134, anchor: "center", width: 900, height: 10, fill: p.detail, radius: 5 }),
      screenStack(c, dims.cx, dims.cy, dims, content),
      ellipse({ id: `${c.id}-webcam`, x: 0, y: lidTop + 14, anchor: "center", width: 6, height: 6, fill: p.detail }),
      rect({ id: `${c.id}-lid`, x: 0, y: dims.cy, anchor: "center", width: sw + 40, height: sh + 40, stroke: bodyStroke(c, p.bodyStroke), strokeWidth: 2, radius: 18 }),
    ];
  },
  browser: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const winW = sw + 16;
    const winH = sh + 92; // 48 title bar + margins
    const barY = -winH / 2 + 24;
    return [
      rect({ id: `${c.id}-win`, x: 0, y: 0, anchor: "center", width: winW, height: winH, fill: premiumFill(c, p.chrome, p.chromeGrad), stroke: bodyStroke(c, p.bodyStroke), strokeWidth: 1.5, radius: 14, ...bodyFx(c) }),
      ellipse({ id: `${c.id}-dot1`, x: -winW / 2 + 30, y: barY, anchor: "center", width: 13, height: 13, fill: "#FF5F57" }),
      ellipse({ id: `${c.id}-dot2`, x: -winW / 2 + 54, y: barY, anchor: "center", width: 13, height: 13, fill: "#FEBC2E" }),
      ellipse({ id: `${c.id}-dot3`, x: -winW / 2 + 78, y: barY, anchor: "center", width: 13, height: 13, fill: "#28C840" }),
      // an active tab tucked under the lights
      rect({ id: `${c.id}-tab`, x: -winW / 2 + 230, y: barY, anchor: "center", width: 190, height: 30, fill: c.o.screen ?? p.screen, radius: 8 }),
      text({ id: `${c.id}-tabtext`, x: -winW / 2 + 156, y: barY, anchor: "center-left", content: "Overview", fontFamily: "Inter", fontSize: 13, fill: p.chromeText }),
      rect({ id: `${c.id}-urlpill`, x: 96, y: barY, anchor: "center", width: 700, height: 26, fill: c.o.screen ?? p.screen, stroke: p.bodyStroke, strokeWidth: 1, radius: 13 }),
      rect({ id: `${c.id}-lock`, x: 96 - 330, y: barY, anchor: "center", width: 8, height: 10, fill: p.chromeText, radius: 2 }),
      text({ id: `${c.id}-urltext`, x: 96 - 312, y: barY, anchor: "center-left", content: urlText(c.o.url), fontFamily: "Inter", fontSize: 14, fill: p.chromeText }),
      screenStack(c, dims.cx, dims.cy, dims, content),
    ];
  },
  watch: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const bw = sw + 36;
    const bh = sh + 36;
    return [
      // straps (drawn behind the body) flaring out top & bottom
      path({ id: `${c.id}-bandtop`, x: 0, y: -bh / 2 + 4, d: "M -78 0 L 78 0 L 64 -86 L -64 -86 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
      path({ id: `${c.id}-bandbot`, x: 0, y: bh / 2 - 4, d: "M -78 0 L 78 0 L 64 86 L -64 86 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
      slab(c, "body", 0, 0, bw, bh, 60, p.bodyGrad, p.body, p.bodyStroke),
      screenStack(c, dims.cx, dims.cy, dims, content),
      rect({ id: `${c.id}-crown`, x: bw / 2, y: -20, anchor: "center", width: 14, height: 40, fill: p.detail, radius: 6 }),
      rect({ id: `${c.id}-button`, x: bw / 2 - 2, y: 40, anchor: "center", width: 8, height: 34, fill: p.detail, radius: 4 }),
    ];
  },
  monitor: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const panelW = sw + 44;
    const panelH = sh + 60;
    return [
      slab(c, "panel", 0, 0, panelW, panelH, 16, p.bodyGrad, p.body, p.bodyStroke),
      screenStack(c, dims.cx, dims.cy, dims, content),
      ellipse({ id: `${c.id}-led`, x: panelW / 2 - 26, y: panelH / 2 - 16, anchor: "center", width: 6, height: 6, fill: "#28C840" }),
      rect({ id: `${c.id}-neck`, x: 0, y: panelH / 2 + 60, anchor: "center", width: 60, height: 120, fill: p.body }),
      path({ id: `${c.id}-stand`, x: 0, y: panelH / 2 + 60, d: "M -160 50 L 160 50 L 220 80 L -220 80 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
    ];
  },
  tv: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const panelW = sw + 44;
    const panelH = sh + 48;
    const panelBottom = dims.cy + panelH / 2;
    return [
      slab(c, "panel", 0, dims.cy, panelW, panelH, 12, p.bodyGrad, p.body, p.bodyStroke),
      screenStack(c, dims.cx, dims.cy, dims, content),
      ellipse({ id: `${c.id}-brand`, x: 0, y: panelBottom - 12, anchor: "center", width: 6, height: 6, fill: p.detail }),
      rect({ id: `${c.id}-neck`, x: 0, y: panelBottom + 48, anchor: "center", width: 64, height: 96, fill: p.body }),
      path({ id: `${c.id}-stand`, x: 0, y: panelBottom + 96, d: "M -210 0 L 210 0 L 270 34 L -270 34 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
    ];
  },
  foldable: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const bodyW = sw + 40;
    const bodyH = sh + 40;
    return [
      rect({ id: `${c.id}-hinge-l`, x: -bodyW / 2, y: 0, anchor: "center", width: 8, height: bodyH * 0.5, fill: p.detail, radius: 4 }),
      rect({ id: `${c.id}-hinge-r`, x: bodyW / 2, y: 0, anchor: "center", width: 8, height: bodyH * 0.5, fill: p.detail, radius: 4 }),
      slab(c, "body", 0, 0, bodyW, bodyH, 28, p.bodyGrad, p.body, p.bodyStroke),
      screenStack(c, dims.cx, dims.cy, dims, content),
      rect({ id: `${c.id}-crease`, x: 0, y: 0, anchor: "center", width: 4, height: sh, fill: p.bodyStroke, radius: 2, opacity: 0.5 }),
      ellipse({ id: `${c.id}-cam1`, x: -10, y: -sh / 2 + 18, anchor: "center", width: 8, height: 8, fill: p.detail }),
      ellipse({ id: `${c.id}-cam2`, x: 10, y: -sh / 2 + 18, anchor: "center", width: 8, height: 8, fill: p.detail }),
    ];
  },
  terminal: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const winW = sw + 16;
    const winH = sh + 76; // 44 title bar
    return [
      rect({ id: `${c.id}-win`, x: 0, y: 0, anchor: "center", width: winW, height: winH, fill: premiumFill(c, p.chrome, p.chromeGrad), stroke: bodyStroke(c, p.bodyStroke), strokeWidth: 1.5, radius: 12, ...bodyFx(c) }),
      ellipse({ id: `${c.id}-dot1`, x: -winW / 2 + 28, y: -winH / 2 + 22, anchor: "center", width: 12, height: 12, fill: "#FF5F57" }),
      ellipse({ id: `${c.id}-dot2`, x: -winW / 2 + 50, y: -winH / 2 + 22, anchor: "center", width: 12, height: 12, fill: "#FEBC2E" }),
      ellipse({ id: `${c.id}-dot3`, x: -winW / 2 + 72, y: -winH / 2 + 22, anchor: "center", width: 12, height: 12, fill: "#28C840" }),
      rect({ id: `${c.id}-tab`, x: -winW / 2 + 170, y: -winH / 2 + 22, anchor: "center", width: 130, height: 24, fill: c.o.screen ?? p.screen, radius: 6 }),
      text({ id: `${c.id}-title`, x: -winW / 2 + 170, y: -winH / 2 + 22, anchor: "center", content: urlText(c.o.url ?? "zsh"), fontFamily: "Inter", fontSize: 13, fill: p.chromeText }),
      screenStack(c, dims.cx, dims.cy, dims, content),
    ];
  },
  car: (c, dims, content) => {
    const p = c.palette;
    const sw = dims.width, sh = dims.height;
    const bodyW = sw + 60;
    const bodyH = sh + 60;
    return [
      slab(c, "body", 0, 0, bodyW, bodyH, 40, p.bodyGrad, p.body, p.bodyStroke),
      ellipse({ id: `${c.id}-knob`, x: -bodyW / 2 + 18, y: 0, anchor: "center", width: 22, height: 22, fill: p.body, stroke: p.detail, strokeWidth: 3 }),
      screenStack(c, dims.cx, dims.cy, dims, content),
      ellipse({ id: `${c.id}-btn1`, x: -44, y: sh / 2 + 16, anchor: "center", width: 12, height: 12, fill: p.detail }),
      ellipse({ id: `${c.id}-btn2`, x: 0, y: sh / 2 + 16, anchor: "center", width: 12, height: 12, fill: p.detail }),
      ellipse({ id: `${c.id}-btn3`, x: 44, y: sh / 2 + 16, anchor: "center", width: 12, height: 12, fill: p.detail }),
    ];
  },
};

/** phone & tablet share a body + the side-hardware arrangement. */
function phoneOrTablet(name: "phone" | "tablet", c: DeviceCtx, dims: Required<ScreenRect>, content: NodeIR[]): NodeIR[] {
  const p = c.palette;
  const sw = dims.width, sh = dims.height;
  const bezel = name === "phone" ? 20 : 28;
  const bodyW = sw + bezel * 2;
  const bodyH = sh + bezel * 2;
  const bodyR = name === "phone" ? 54 : 34;
  const land = isLandscape(name, c.o);
  const nodes: NodeIR[] = [
    slab(c, "body", 0, 0, bodyW, bodyH, bodyR, p.bodyGrad, p.body, p.bodyStroke),
    screenStack(c, dims.cx, dims.cy, dims, content),
  ];
  if (name === "phone") {
    // dynamic-island pill on the "top" edge, home indicator opposite — swap to a side when landscape
    if (land) {
      nodes.push(
        rect({ id: `${c.id}-notch`, x: -sw / 2 + 16, y: 0, anchor: "center", width: 30, height: 96, fill: "#000000", radius: 15 }),
        rect({ id: `${c.id}-home`, x: sw / 2 - 4, y: 0, anchor: "center", width: 5, height: 120, fill: p.detail, radius: 3 }),
      );
    } else {
      const notch = phoneNotch(c, c.o.notch ?? "island", sh);
      if (notch) nodes.push(notch);
      nodes.push(
        rect({ id: `${c.id}-home`, x: 0, y: sh / 2 - 18, anchor: "center", width: 120, height: 5, fill: p.detail, radius: 3 }),
        // side hardware: power on the right, volume rocker on the left
        rect({ id: `${c.id}-pwr`, x: bodyW / 2, y: -bodyH * 0.1, anchor: "center", width: 4, height: 78, fill: p.detail, radius: 2 }),
        rect({ id: `${c.id}-volup`, x: -bodyW / 2, y: -bodyH * 0.16, anchor: "center", width: 4, height: 48, fill: p.detail, radius: 2 }),
        rect({ id: `${c.id}-voldn`, x: -bodyW / 2, y: -bodyH * 0.16 + 60, anchor: "center", width: 4, height: 48, fill: p.detail, radius: 2 }),
      );
    }
  } else {
    nodes.push(
      rect({ id: `${c.id}-camera`, x: land ? -sw / 2 - 14 : 0, y: land ? 0 : -sh / 2 - 14, anchor: "center", width: 8, height: 8, fill: p.detail, radius: 4 }),
      rect({ id: `${c.id}-pwr`, x: land ? -bodyW * 0.18 : bodyW * 0.18, y: land ? -bodyH / 2 : -bodyH / 2, anchor: "center", width: 60, height: 4, fill: p.detail, radius: 2 }),
    );
  }
  return nodes;
}

/** Build a device-mockup frame (a group) with a clipped screen content slot. */
export function devicePreset(name: DevicePresetName, opts: DevicePresetOpts = {}): NodeIR {
  const c = makeCtx(opts);
  const dims = screenDims(name, opts);
  const children = CHASSIS[name](c, dims, opts.content ?? []);
  return group(
    {
      id: c.id,
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      ...(opts.scale !== undefined && opts.scale !== 1 && { scale: opts.scale }),
      ...(opts.opacity !== undefined && opts.opacity !== 1 && { opacity: opts.opacity }),
    },
    children,
  );
}
