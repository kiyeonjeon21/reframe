/**
 * figure() — a parametric DRESSED character, the sibling of `humanoid()`. Same
 * skeleton geometry (so `characterPreset` / `ikReach` / overlays apply unchanged),
 * but each bone carries a coloured, designed flat shape instead of a neon capsule.
 * Two styles — `clean` (corporate-flat, undraw register: one accent + neutrals,
 * minimal face, slim adult proportions) and `cute` (mascot: big head, full face).
 * Palette knobs re-skin it in one line; shadows are derived so a single `accent`
 * recolours the whole figure.
 *
 *   figure({ id: "fig", style: "clean", palette: { accent: "#3B82F6" } })
 *   characterPreset("walk", { target: "fig", at: [x, y] })   // drives it
 */

import { path } from "./dsl.js";
import type { NodeIR } from "./ir.js";
import { ovalPath, rig, type Bone, type RigOpts } from "./rig.js";

export type FigureStyle = "clean" | "cute";
export interface FigurePalette {
  skin?: string;
  hair?: string;
  top?: string;
  pants?: string;
  shoe?: string;
  accent?: string;
}
export interface FigureOpts extends RigOpts {
  /** "clean" (corporate-flat, default) | "cute" (mascot). */
  style?: FigureStyle;
  /** Colour overrides merged onto the per-style defaults. */
  palette?: FigurePalette;
  /** Draw minimal facial features (default true). `false` = faceless (pure undraw). */
  face?: boolean;
}

const K = 0.5523;
const n = (v: number) => Number(v.toFixed(2));
/** tapered rounded capsule (limbs): half-width a (top) → b (bottom), y0..y1. */
function limb(a: number, b: number, y0: number, y1: number): string {
  const ka = n(a * K), kb = n(b * K);
  return (
    `M ${-a} ${y0} C ${-a} ${n(y0 - ka)} ${-ka} ${n(y0 - a)} 0 ${n(y0 - a)} ` +
    `C ${ka} ${n(y0 - a)} ${a} ${n(y0 - ka)} ${a} ${y0} L ${b} ${y1} ` +
    `C ${b} ${n(y1 + kb)} ${kb} ${n(y1 + b)} 0 ${n(y1 + b)} ` +
    `C ${-kb} ${n(y1 + b)} ${-b} ${n(y1 + kb)} ${-b} ${y1} Z`
  );
}
/** tapered rounded RECTANGLE with flat top & bottom (torso/pelvis). */
function rrect(a: number, b: number, y0: number, y1: number, r: number): string {
  return (
    `M ${n(-a + r)} ${y0} L ${n(a - r)} ${y0} Q ${a} ${y0} ${a} ${n(y0 + r)} ` +
    `L ${b} ${n(y1 - r)} Q ${b} ${y1} ${n(b - r)} ${y1} ` +
    `L ${n(-b + r)} ${y1} Q ${-b} ${y1} ${-b} ${n(y1 - r)} ` +
    `L ${-a} ${n(y0 + r)} Q ${-a} ${y0} ${n(-a + r)} ${y0} Z`
  );
}

/** darken a #rrggbb by fraction f — derives tonal shadows from a base colour. */
function darken(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((v >> s) & 0xff) * (1 - f))));
  const hx = (x: number) => x.toString(16).padStart(2, "0");
  return `#${hx(ch(16))}${hx(ch(8))}${hx(ch(0))}`;
}

interface Pal {
  skin: string; skinSh: string; hair: string; hairSh: string;
  top: string; topSh: string; pants: string; pantsSh: string;
  shoe: string; shoeSh: string; eye: string; cheek: string; white: string; mouth: string;
}
const DEF: Record<FigureStyle, Required<Omit<FigurePalette, "accent">> & { accent: string }> = {
  clean: { skin: "#E9B58E", hair: "#2B313F", top: "#E86C4A", pants: "#39425C", shoe: "#20242F", accent: "#E86C4A" },
  cute: { skin: "#FFD2A6", hair: "#5B4636", top: "#FF7E5F", pants: "#3E6F8E", shoe: "#272B38", accent: "#FF7E5F" },
};
function resolvePal(style: FigureStyle, p: FigurePalette = {}): Pal {
  const d = DEF[style];
  const accent = p.accent ?? d.accent;
  const top = p.top ?? (style === "clean" ? accent : d.top); // clean: the top IS the accent
  const skin = p.skin ?? d.skin;
  const hair = p.hair ?? d.hair;
  const pants = p.pants ?? d.pants;
  const shoe = p.shoe ?? d.shoe;
  return {
    skin, skinSh: darken(skin, 0.12), hair, hairSh: darken(hair, 0.14),
    top, topSh: darken(top, 0.12), pants, pantsSh: darken(pants, 0.14),
    shoe, shoeSh: darken(shoe, 0.22), eye: "#2B313F", cheek: "#FF9E7E", white: "#FFFFFF", mouth: "#8A4233",
  };
}

const fp = (id: string, d: string, fill: string, stroke?: string, sw = 0, opacity = 1): NodeIR =>
  path({ id, d, x: 0, y: 0, fill, opacity, ...(stroke && sw > 0 ? { stroke, strokeWidth: sw } : {}) });

interface Parts {
  torso: (jid: string) => NodeIR[];
  head: (jid: string) => NodeIR[];
  upperArm: (jid: string) => NodeIR[];
  forearm: (jid: string) => NodeIR[];
  thigh: (jid: string) => NodeIR[];
  shin: (jid: string) => NodeIR[];
}

// --- clean / corporate-flat (undraw register) -----------------------------
function cleanParts(p: Pal, face: boolean): Parts {
  const HC = -42;
  return {
    upperArm: (j) => [fp(`${j}-sleeve`, limb(12, 10, 2, 58), p.top)],
    forearm: (j) => [
      fp(`${j}-elbow`, ovalPath(10, 10, 0, 3), p.skin),
      fp(`${j}-fore`, limb(10, 8, 2, 48), p.skin),
      fp(`${j}-hand`, ovalPath(11, 12, 0, 50), p.skin),
    ],
    thigh: (j) => [fp(`${j}-thigh`, limb(15, 13, 2, 72), p.pants)],
    shin: (j) => [
      fp(`${j}-knee`, ovalPath(13, 13, 0, 2), p.pants),
      fp(`${j}-shin`, limb(13, 11, 2, 62), p.pants),
      fp(`${j}-shoe`, ovalPath(15, 9, 4, 67), p.shoe),
    ],
    torso: (j) => [
      fp(`${j}-shadow`, rrect(38, 26, -28, 52, 20), p.topSh),
      fp(`${j}-top`, rrect(40, 27, -30, 52, 22), p.top),
      fp(`${j}-pelvis`, rrect(29, 24, 46, 104, 14), p.pants),
    ],
    head: (j) => [
      fp(`${j}-neck`, rrect(9, 9, 2, 22, 5), p.skin),
      fp(`${j}-skin`, ovalPath(42, 46, 0, HC), p.skin),
      fp(`${j}-hair`, ovalPath(44, 27, 0, HC - 31), p.hair),
      fp(`${j}-hairL`, ovalPath(8, 14, -39, HC - 18), p.hair),
      fp(`${j}-hairR`, ovalPath(8, 14, 39, HC - 18), p.hair),
      ...(face ? [fp(`${j}-eyeL`, ovalPath(5, 7, -14, HC + 2), p.eye), fp(`${j}-eyeR`, ovalPath(5, 7, 14, HC + 2), p.eye)] : []),
    ],
  };
}

// --- cute / mascot --------------------------------------------------------
const CUTE_HAIR =
  "M -64 -54 C -78 -96 -50 -126 0 -126 C 50 -126 78 -96 64 -54 " +
  "C 60 -34 48 -28 41 -33 C 35 -54 23 -60 9 -60 C 3 -60 -3 -60 -9 -60 " +
  "C -23 -60 -35 -54 -41 -33 C -48 -28 -60 -34 -64 -54 Z";
function cuteParts(p: Pal, face: boolean): Parts {
  const HC = -50;
  return {
    upperArm: (j) => [fp(`${j}-sleeve`, limb(15, 13, 2, 58), p.top, p.topSh, 2.5)],
    forearm: (j) => [
      fp(`${j}-elbow`, ovalPath(12, 12, 0, 3), p.skin, p.skinSh, 2.5),
      fp(`${j}-fore`, limb(12, 10, 2, 46), p.skin, p.skinSh, 2.5),
      fp(`${j}-hand`, ovalPath(13, 14, 0, 50), p.skin, p.skinSh, 2.5),
    ],
    thigh: (j) => [fp(`${j}-thigh`, limb(19, 16, 2, 72), p.pants, p.pantsSh, 2.5)],
    shin: (j) => [
      fp(`${j}-knee`, ovalPath(16, 16, 0, 2), p.pants, p.pantsSh, 2.5),
      fp(`${j}-shin`, limb(15, 12, 2, 60), p.pants, p.pantsSh, 2.5),
      fp(`${j}-shoe`, ovalPath(18, 11, 5, 66), p.shoe, darken(p.shoe, 0.25), 2.5),
    ],
    torso: (j) => [
      fp(`${j}-shadow`, rrect(40, 34, -18, 52, 16), p.topSh),
      fp(`${j}-top`, rrect(42, 35, -20, 52, 18), p.top, p.topSh, 2.5),
      fp(`${j}-pelvis`, rrect(36, 30, 46, 104, 16), p.pants, p.pantsSh, 2.5),
    ],
    head: (j) => [
      fp(`${j}-neck`, ovalPath(15, 12, 0, 12), p.skinSh),
      fp(`${j}-skin`, ovalPath(42, 46, 0, HC + 4), p.skin, p.skinSh, 2.5),
      fp(`${j}-cheekL`, ovalPath(11, 8, -40, HC + 22), p.cheek, undefined, 0, 0.5),
      fp(`${j}-cheekR`, ovalPath(11, 8, 40, HC + 22), p.cheek, undefined, 0, 0.5),
      fp(`${j}-hair`, CUTE_HAIR, p.hair, p.hairSh, 2),
      ...(face
        ? [
            fp(`${j}-eyeL`, ovalPath(10, 13, -25, HC + 8), p.eye),
            fp(`${j}-eyeR`, ovalPath(10, 13, 25, HC + 8), p.eye),
            fp(`${j}-glL`, ovalPath(3.4, 3.4, -28, HC + 3), p.white),
            fp(`${j}-glR`, ovalPath(3.4, 3.4, 22, HC + 3), p.white),
            path({ id: `${j}-mouth`, d: "M -15 0 Q 0 15 15 0", x: 0, y: HC + 28, fill: "none", stroke: p.mouth, strokeWidth: 5 }),
          ]
        : []),
    ],
  };
}

/** The shared skeleton — identical to `humanoid()` for the legs/joints that
 * `characterPreset` and `ikReach` depend on; only the shapes vary by style. */
function buildSkeleton(id: string, S: Parts): Bone {
  const arm = (side: "L" | "R", x: number, r1: number, r2: number): Bone => ({
    name: `armUpper${side}`, at: [x, -14], length: 60, width: 0, rotation: r1, shape: S.upperArm(`${id}-armUpper${side}`),
    children: [{ name: `armLower${side}`, at: [0, 60], length: 56, width: 0, rotation: r2, shape: S.forearm(`${id}-armLower${side}`) }],
  });
  const leg = (side: "L" | "R", x: number, r1: number, r2: number): Bone => ({
    name: `legUpper${side}`, at: [x, 76], length: 76, width: 0, rotation: r1, shape: S.thigh(`${id}-legUpper${side}`),
    children: [{ name: `legLower${side}`, at: [0, 76], length: 72, width: 0, rotation: r2, shape: S.shin(`${id}-legLower${side}`) }],
  });
  return {
    name: "chest", at: [0, 0], shape: S.torso(`${id}-chest`),
    children: [
      { name: "head", at: [0, -42], rotation: 0, shape: S.head(`${id}-head`) },
      arm("L", -40, 8, 6), arm("R", 40, -8, -6),
      leg("L", -20, 3, -2), leg("R", 20, -3, 2),
    ],
  };
}

export function figure(opts: FigureOpts = {}): NodeIR {
  const style = opts.style ?? "clean";
  const pal = resolvePal(style, opts.palette);
  const face = opts.face ?? true;
  const id = opts.id ?? "figure";
  const parts = style === "clean" ? cleanParts(pal, face) : cuteParts(pal, face);
  const rigOpts: RigOpts = { id };
  if (opts.x !== undefined) rigOpts.x = opts.x;
  if (opts.y !== undefined) rigOpts.y = opts.y;
  if (opts.scale !== undefined) rigOpts.scale = opts.scale;
  if (opts.opacity !== undefined) rigOpts.opacity = opts.opacity;
  return rig(buildSkeleton(id, parts), rigOpts);
}
