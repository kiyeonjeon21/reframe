/**
 * Kinetic text — a deterministic per-glyph text splitter plus a library of
 * seeded effect generators (entrance / sustained / exit). The text analog of
 * `motionPreset` / `characterPreset`: `splitText()` lays a phrase out as
 * center-anchored `text` nodes (advances measured from the real font, so layout
 * matches the render), then `textIn` / `textLoop` / `textOut` animate the glyphs.
 *
 *   const T = splitText("MOTION IS DATA", { id: "t", x: 960, y: 470, fontSize: 130 });
 *   // nodes:     [...T.nodes]
 *   // timeline:  seq(textIn("typewriter", T), wait(2), textOut("shatter", T, { seed: 3 }))
 *   // behaviors: textLoop("wave", T, { from: 1.6, until: 3.6 })
 */

import { beat, par, seq, stagger, text, tween, wait, oscillate, type BehaviorWindow } from "./dsl.js";
import type { AudioCueIR, BehaviorIR, NodeIR, TimelineIR } from "./ir.js";
import { INTER_ADVANCE, INTER_FALLBACK } from "./textMetrics.js";

export type FontWeight = 400 | 700 | 800;

export interface SplitOpts {
  /** Id PREFIX → glyph ids `${id}-${i}`. */
  id: string;
  /** Anchor point of the line. */
  x: number;
  y: number;
  fontSize: number;
  fontWeight?: FontWeight;
  fill?: string;
  /** Extra px between glyphs (tracking). */
  letterSpacing?: number;
  /** Horizontal alignment about `x` (default "center"). */
  align?: "left" | "center";
  /** Animate per glyph or per word (default "glyph"). */
  unit?: "glyph" | "word";
  /** Starting opacity of the nodes (default 0, for entrances). */
  opacity?: number;
}

export interface Glyph {
  id: string;
  /** The character (glyph unit) or word (word unit). */
  ch: string;
  /** Home centre (the laid-out resting position). */
  x: number;
  y: number;
  /** This unit's advance width in px. */
  advance: number;
  /** Index in declaration order. */
  i: number;
}

export interface TextBlock {
  nodes: NodeIR[];
  glyphs: Glyph[];
  ids: string[];
  /** Total laid-out width in px. */
  width: number;
  x: number;
  y: number;
  fontSize: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fract = (v: number) => v - Math.floor(v);
/** stateless per-glyph hash in [0,1) — reproducible, order-independent. */
const rand = (i: number, salt: number) => fract(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);
const dur = (base: number, sp: number) => base / sp;
const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@";

const advance = (ch: string, weight: FontWeight, fontSize: number): number =>
  (INTER_ADVANCE[weight]?.[ch] ?? INTER_FALLBACK[weight]!) * (fontSize / 100);

// ---------------------------------------------------------------- splitText
export function splitText(textStr: string, opts: SplitOpts): TextBlock {
  const { id, x, y, fontSize } = opts;
  const weight = opts.fontWeight ?? 800;
  const fill = opts.fill ?? "#FFFFFF";
  const ls = opts.letterSpacing ?? 0;
  const align = opts.align ?? "center";
  const unit = opts.unit ?? "glyph";
  const opacity = opts.opacity ?? 0;
  const chars = [...textStr];

  // total line width = Σ advances + tracking between glyphs
  let total = 0;
  chars.forEach((ch, i) => {
    total += advance(ch, weight, fontSize) + (i < chars.length - 1 ? ls : 0);
  });
  let cursor = align === "center" ? x - total / 2 : x;

  const glyphs: Glyph[] = [];
  const nodes: NodeIR[] = [];
  const mk = (ch: string, cx: number, adv: number, lsProp?: number) => {
    const g: Glyph = { id: `${id}-${glyphs.length}`, ch, x: cx, y, advance: adv, i: glyphs.length };
    glyphs.push(g);
    nodes.push(
      text({
        id: g.id, x: cx, y, content: ch, fontFamily: "Inter", fontSize, fontWeight: weight, fill,
        anchor: "center", opacity, ...(lsProp ? { letterSpacing: lsProp } : {}),
      }),
    );
  };

  if (unit === "word") {
    // group runs of non-spaces into word nodes; spaces only advance the cursor
    let i = 0;
    while (i < chars.length) {
      if (chars[i] === " ") {
        cursor += advance(" ", weight, fontSize) + ls;
        i++;
        continue;
      }
      let word = "";
      let w = 0;
      const startCursor = cursor;
      while (i < chars.length && chars[i] !== " ") {
        const a = advance(chars[i]!, weight, fontSize);
        word += chars[i];
        w += a + (chars[i + 1] && chars[i + 1] !== " " ? ls : 0);
        i++;
      }
      mk(word, startCursor + w / 2, w, ls);
      cursor = startCursor + w + ls;
    }
  } else {
    chars.forEach((ch) => {
      const a = advance(ch, weight, fontSize);
      if (ch !== " ") mk(ch, cursor + a / 2, a);
      cursor += a + ls;
    });
  }

  return { nodes, glyphs, ids: glyphs.map((g) => g.id), width: total, x, y, fontSize };
}

// --------------------------------------------------------------- effect ctx
interface FxOpts {
  speed?: number;
  energy?: number;
  seed?: number;
  stagger?: number;
  label?: string;
}
interface Ctx {
  sp: number;
  e: number;
  seed: number;
  fs: number;
  stag: number | undefined;
}
const ctx = (o: FxOpts): Ctx => ({
  sp: Math.max(0.25, o.speed ?? 1),
  e: clamp01(o.energy ?? 0.5),
  seed: o.seed ?? 0,
  fs: 0,
  stag: o.stagger,
});

// ------------------------------------------------------------------- textIn
export type TextInName = "typewriter" | "cascade" | "rise" | "bounce" | "assemble" | "decode";
const IN_STAGGER: Record<TextInName, number> = { typewriter: 0.065, cascade: 0.04, rise: 0.03, bounce: 0.045, assemble: 0.05, decode: 0.05 };

function glyphIn(name: TextInName, g: Glyph, c: Ctx): TimelineIR {
  const set = (props: Record<string, number | string>) => tween(g.id, props, { duration: 0.001 });
  const rs = (salt: number) => rand(g.i, salt + c.seed);
  switch (name) {
    case "typewriter":
      return tween(g.id, { opacity: 1 }, { duration: dur(0.04, c.sp), ease: "linear" });
    case "cascade":
      return seq(
        set({ y: g.y + 56, opacity: 0 }),
        par(tween(g.id, { opacity: 1 }, { duration: dur(0.22, c.sp), ease: "easeOutQuad" }),
            tween(g.id, { y: g.y }, { duration: dur(0.34, c.sp), ease: "easeOutCubic" })),
      );
    case "rise":
      return seq(
        set({ y: g.y + 36, opacity: 0 }),
        par(tween(g.id, { opacity: 1 }, { duration: dur(0.3, c.sp), ease: "easeOutQuad" }),
            tween(g.id, { y: g.y }, { duration: dur(0.4, c.sp), ease: "easeOutQuad" })),
      );
    case "bounce":
      return seq(
        set({ y: g.y - 80 * (0.6 + c.e), opacity: 0, scale: 0.7 }),
        par(tween(g.id, { opacity: 1 }, { duration: dur(0.2, c.sp), ease: "easeOutQuad" }),
            tween(g.id, { y: g.y, scale: 1 }, { duration: dur(0.7, c.sp), ease: "easeOutBounce" })),
      );
    case "assemble":
      return seq(
        set({ x: g.x + (rs(11) - 0.5) * 1000 * (0.5 + c.e), y: g.y + (rs(12) - 0.5) * 640, rotation: (rs(13) - 0.5) * 200, scale: 0.4, opacity: 0 }),
        par(tween(g.id, { opacity: 1 }, { duration: dur(0.4, c.sp), ease: "easeOutQuad" }),
            tween(g.id, { x: g.x, y: g.y, rotation: 0, scale: 1 }, { duration: dur(0.8, c.sp), ease: "easeOutExpo" })),
      );
    case "decode": {
      const steps = 4 + Math.floor(rs(7) * 3);
      const flicker: TimelineIR[] = [set({ opacity: 1 })];
      for (let k = 0; k < steps; k++) {
        flicker.push(tween(g.id, { content: SCRAMBLE[Math.floor(rand(g.i, 20 + k + c.seed) * SCRAMBLE.length)]! }, { duration: dur(0.05, c.sp), ease: "linear" }));
      }
      flicker.push(tween(g.id, { content: g.ch }, { duration: dur(0.05, c.sp), ease: "linear" }));
      return seq(...flicker);
    }
  }
}

export function textIn(name: TextInName, block: TextBlock, opts: FxOpts = {}): TimelineIR {
  const c = { ...ctx(opts), fs: block.fontSize };
  const interval = (c.stag ?? IN_STAGGER[name]) / c.sp;
  return beat(opts.label ?? `text-in-${name}`, {}, [stagger(interval, ...block.glyphs.map((g) => glyphIn(name, g, c)))]);
}

// ----------------------------------------------------------------- textLoop
export type TextLoopName = "wave" | "shimmer" | "wobble" | "float";
export interface TextLoopOpts extends BehaviorWindow {
  amplitude?: number;
  frequency?: number;
  /** phase offset per glyph (the travelling-wave speed). */
  phaseStep?: number;
}
export function textLoop(name: TextLoopName, block: TextBlock, opts: TextLoopOpts = {}): BehaviorIR[] {
  const win: BehaviorWindow = { ...(opts.from !== undefined && { from: opts.from }), ...(opts.until !== undefined && { until: opts.until }), ...(opts.ramp !== undefined && { ramp: opts.ramp }) };
  const f = opts.frequency ?? (name === "wave" ? 0.9 : name === "shimmer" ? 1.4 : 0.7);
  const ps = opts.phaseStep ?? 0.55;
  return block.glyphs.map((g, i) => {
    switch (name) {
      case "wave": return oscillate(g.id, "y", { amplitude: opts.amplitude ?? 9, frequency: f, phase: i * ps }, win);
      case "shimmer": return oscillate(g.id, "opacity", { amplitude: opts.amplitude ?? 0.25, frequency: f, phase: i * ps }, win);
      case "wobble": return oscillate(g.id, "rotation", { amplitude: opts.amplitude ?? 6, frequency: f, phase: i * ps }, win);
      case "float": return oscillate(g.id, "y", { amplitude: opts.amplitude ?? 5, frequency: f, phase: i * ps }, win);
    }
  });
}

// ------------------------------------------------------------------ textOut
export type TextOutName = "shatter" | "fly" | "dissolve" | "fall" | "collapse";
const OUT_STAGGER: Record<TextOutName, number> = { shatter: 0.02, fly: 0.012, dissolve: 0, fall: 0.02, collapse: 0.02 };

function glyphOut(name: TextOutName, g: Glyph, c: Ctx, block: TextBlock, dir: [number, number]): TimelineIR {
  const rs = (salt: number) => rand(g.i, salt + c.seed);
  switch (name) {
    case "shatter":
      return par(
        tween(g.id, { x: g.x + (rs(21) - 0.5) * 1100 * (0.6 + c.e), y: g.y + (rs(22) - 0.5) * 760 }, { duration: dur(0.7, c.sp), ease: "easeInCubic" }),
        tween(g.id, { rotation: (rs(23) - 0.5) * 300, opacity: 0 }, { duration: dur(0.7, c.sp), ease: "easeInQuad" }),
      );
    case "fly":
      return par(
        tween(g.id, { x: g.x + dir[0] * 1200, y: g.y + dir[1] * 1200 }, { duration: dur(0.6, c.sp), ease: "easeInCubic" }),
        tween(g.id, { opacity: 0 }, { duration: dur(0.5, c.sp), ease: "easeInQuad" }),
      );
    case "dissolve":
      return seq(wait(rs(31) * 0.5), par(
        tween(g.id, { opacity: 0 }, { duration: dur(0.4, c.sp), ease: "easeInQuad" }),
        tween(g.id, { scale: 1.4 }, { duration: dur(0.4, c.sp), ease: "easeOutQuad" }),
      ));
    case "fall":
      return par(
        tween(g.id, { y: g.y + 700 + rs(41) * 200 }, { duration: dur(0.8, c.sp), ease: "easeInQuad" }),
        tween(g.id, { rotation: (rs(42) - 0.5) * 120, opacity: 0 }, { duration: dur(0.8, c.sp), ease: "easeInQuad" }),
      );
    case "collapse":
      return par(
        tween(g.id, { x: block.x, y: block.y, scale: 0.2 }, { duration: dur(0.5, c.sp), ease: "easeInBack" }),
        tween(g.id, { opacity: 0 }, { duration: dur(0.5, c.sp), ease: "easeInQuad" }),
      );
  }
}

export interface TextOutOpts extends FxOpts {
  /** direction for "fly" (default up). */
  dir?: [number, number];
}
export function textOut(name: TextOutName, block: TextBlock, opts: TextOutOpts = {}): TimelineIR {
  const c = { ...ctx(opts), fs: block.fontSize };
  const dir = opts.dir ?? [0, -1];
  const steps = block.glyphs.map((g) => glyphOut(name, g, c, block, dir));
  const interval = (c.stag ?? OUT_STAGGER[name]) / c.sp;
  const body = interval > 0 ? stagger(interval, ...steps) : par(...steps);
  return beat(opts.label ?? `text-out-${name}`, {}, [body]);
}

// ------------------------------------------------------------- typing audio
export interface TypeCueOpts {
  /** the timeline label the typewriter `textIn` starts at. */
  at: string | number;
  /** seconds between keystrokes (match the textIn stagger / speed). */
  interval?: number;
  gain?: number;
  /** offset of the first key from `at`. */
  offset?: number;
}
/** Per-glyph CC0 keypress for `textIn("typewriter", …)`. */
export function textTypeCues(block: TextBlock, opts: TypeCueOpts): AudioCueIR[] {
  const interval = opts.interval ?? 0.065;
  const gain = opts.gain ?? 0.4;
  const off = opts.offset ?? 0;
  const KEYS = ["001", "004", "007", "010", "014"];
  return block.glyphs.map((g, i) => ({
    at: opts.at,
    offset: off + i * interval,
    file: `keypress-${KEYS[i % KEYS.length]}.wav`,
    gain: gain + 0.2 * rand(i, 31),
  }));
}
