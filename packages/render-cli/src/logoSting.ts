/**
 * Logo sting: turn any SVG (a local file, or a simple-icons brand slug) into an
 * animated logo reveal scene. Used by the `reframe logo` command. Pure scene
 * construction here; the caller renders the returned SceneIR.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  scene,
  rect,
  path,
  text,
  group,
  seq,
  par,
  tween,
  wait,
  motionPreset,
  type PresetName,
  type PresetRig,
  type SceneIR,
} from "@reframe/core";

export const LOGO_PRESETS: PresetName[] = [
  "draw-bloom",
  "punch-in",
  "rise-settle",
  "slide-bank",
  "reveal-orbit",
  "spin-forge",
];

export interface LogoStingData {
  name: string;
  paths: { d: string; fill: string }[];
  viewBox: { minX: number; minY: number; w: number; h: number };
  motion?: PresetName;
  energy?: number;
  speed?: number;
  intensity?: number;
  from?: "left" | "right" | "top" | "bottom";
  seed?: number;
}

const titleCase = (s: string) =>
  s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

async function loadSvg(arg: string): Promise<{ svg: string; name: string }> {
  if (existsSync(arg)) {
    return { svg: await readFile(arg, "utf8"), name: arg.split("/").pop()!.replace(/\.svg$/i, "") };
  }
  const slug = arg.toLowerCase().replace(/[^a-z0-9]/g, "");
  const r = await fetch(`https://cdn.simpleicons.org/${slug}`);
  if (!r.ok) throw new Error(`no local file "${arg}", and simple-icons has no "${slug}" (${r.status})`);
  return { svg: await r.text(), name: arg };
}

/** Is a hex colour too dark to read on the near-black stage? */
function tooDark(hex: string): boolean {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 40;
}

function parseSvg(svg: string): Pick<LogoStingData, "paths" | "viewBox"> {
  let viewBox = { minX: 0, minY: 0, w: 100, h: 100 };
  const vb = svg.match(/viewBox\s*=\s*"([\d.\-\s]+)"/i);
  if (vb) {
    const [a, b, c, d] = vb[1]!.trim().split(/\s+/).map(Number);
    viewBox = { minX: a!, minY: b!, w: c!, h: d! };
  } else {
    const w = svg.match(/\bwidth\s*=\s*"([\d.]+)/i);
    const h = svg.match(/\bheight\s*=\s*"([\d.]+)/i);
    if (w && h) viewBox = { minX: 0, minY: 0, w: +w[1]!, h: +h[1]! };
  }
  const rootFill = svg.match(/<svg[^>]*\bfill\s*=\s*"(#[0-9a-fA-F]{3,8})"/)?.[1];
  const fallback = rootFill && !tooDark(rootFill) ? rootFill : "#E6EDF3";

  const paths: { d: string; fill: string }[] = [];
  const re = /<path\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const tag = m[0];
    const d = tag.match(/\bd\s*=\s*"([^"]+)"/)?.[1];
    if (!d) continue;
    let fill = tag.match(/\bfill\s*=\s*"(#[0-9a-fA-F]{3,8})"/)?.[1] ?? fallback;
    if (tooDark(fill)) fill = fallback;
    paths.push({ d, fill });
  }
  return { paths, viewBox };
}

export interface LogoOpts {
  motion?: string | undefined;
  energy?: number | undefined;
  speed?: number | undefined;
  intensity?: number | undefined;
  from?: string | undefined;
  seed?: number | undefined;
}

const FROMS = ["left", "right", "top", "bottom"] as const;

/** Load + parse an SVG (file or brand slug) into renderable scene data. */
export async function resolveLogo(
  arg: string,
  displayName: string | undefined,
  opts: LogoOpts,
): Promise<{ data: LogoStingData; slug: string }> {
  if (opts.motion && !LOGO_PRESETS.includes(opts.motion as PresetName)) {
    throw new Error(`unknown --motion "${opts.motion}". options: ${LOGO_PRESETS.join(", ")}`);
  }
  const { svg, name } = await loadSvg(arg);
  const { paths, viewBox } = parseSvg(svg);
  if (paths.length === 0) throw new Error("no <path> elements found — logo stings need a path-based SVG");
  const from = FROMS.includes(opts.from as (typeof FROMS)[number])
    ? (opts.from as LogoStingData["from"])
    : undefined;
  const data: LogoStingData = {
    name: displayName ?? titleCase(name),
    paths,
    viewBox,
    ...(opts.motion && { motion: opts.motion as PresetName }),
    ...(opts.energy !== undefined && { energy: opts.energy }),
    ...(opts.speed !== undefined && { speed: opts.speed }),
    ...(opts.intensity !== undefined && { intensity: opts.intensity }),
    ...(from && { from }),
    ...(opts.seed !== undefined && { seed: opts.seed }),
  };
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "logo";
  return { data, slug };
}

const BG = "#0D1117";
const FG = "#E6EDF3";
const MUTED = "#8B949E";
const LOGO_PX = 520;

export function buildLogoSting(d: LogoStingData): SceneIR {
  const W = 1080;
  const H = 1080;
  const CX = 540;
  const CY = 500;
  const vcx = d.viewBox.minX + d.viewBox.w / 2;
  const vcy = d.viewBox.minY + d.viewBox.h / 2;
  const fit = LOGO_PX / Math.max(d.viewBox.w, d.viewBox.h);
  const sw = 2.2 / fit;

  const fills = d.paths.map((p, i) =>
    path({ id: `fill-${i}`, d: p.d, originX: vcx, originY: vcy, x: 0, y: 0, fill: p.fill, opacity: 0 }),
  );
  const inks = d.paths.map((p, i) =>
    path({ id: `ink-${i}`, d: p.d, originX: vcx, originY: vcy, x: 0, y: 0, stroke: p.fill, strokeWidth: sw, progress: 0 }),
  );

  const rig: PresetRig = {
    group: "logo",
    center: [CX, CY],
    baseScale: fit,
    fills: fills.map((n) => n.id),
    inks: inks.map((n) => n.id),
  };

  return scene({
    id: "logo-sting",
    size: { width: W, height: H },
    fps: 30,
    background: BG,
    nodes: [
      rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: BG }),
      group({ id: "logo", x: CX, y: CY, scale: fit }, [...fills, ...inks]),
      text({ id: "word", x: CX, y: 905, anchor: "center", content: d.name, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: FG, opacity: 0 }),
      text({ id: "made", x: CX, y: 968, anchor: "center", content: "made with reframe", fontFamily: "Inter", fontSize: 20, fill: MUTED, opacity: 0 }),
    ],
    timeline: seq(
      motionPreset(d.motion ?? "reveal-orbit", {
        target: rig,
        ...(d.energy !== undefined && { energy: d.energy }),
        ...(d.speed !== undefined && { speed: d.speed }),
        ...(d.intensity !== undefined && { intensity: d.intensity }),
        ...(d.from !== undefined && { from: d.from }),
        ...(d.seed !== undefined && { seed: d.seed }),
      }),
      par(
        tween("word", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "word" }),
        seq(wait(0.2), tween("made", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" })),
      ),
      wait(0.8, "hold"),
    ),
  });
}
