/**
 * Device-mockup presets: a parametric vector frame (phone/laptop/browser/…) with
 * a CLIPPED screen "content slot". The sibling of motionPreset — that generates
 * a TimelineIR, this generates a NodeIR subtree. Pure primitives + clip, so no
 * assets and fully deterministic (plain JSON, no Date/random). A 2.5D vector
 * tier — no true perspective.
 *
 *   devicePreset("phone", { id: "hero", content: [ ...your UI nodes ] })
 *
 * Each instance needs a distinct `id` (it prefixes every generated node id);
 * two with the same prefix collide via the scene's duplicate-id validation.
 */

import { ellipse, group, path, rect, text } from "./dsl.js";
import type { NodeIR } from "./ir.js";

export const DEVICE_PRESET_NAMES = ["phone", "tablet", "laptop", "browser", "watch", "monitor"] as const;
export type DevicePresetName = (typeof DEVICE_PRESET_NAMES)[number];

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
  /** Browser address-bar text. */
  url?: string;
}

interface Palette {
  body: string;
  bodyStroke: string;
  screen: string;
  detail: string;
  chrome: string;
  chromeText: string;
}
const DARK: Palette = { body: "#15161C", bodyStroke: "#2A2D38", screen: "#0E0F15", detail: "#3A3D48", chrome: "#1B1D24", chromeText: "#9AA0AD" };
const LIGHT: Palette = { body: "#E7E9EE", bodyStroke: "#C3C7D1", screen: "#FFFFFF", detail: "#AEB3C0", chrome: "#F2F3F6", chromeText: "#5B606C" };

interface ScreenRect {
  width: number;
  height: number;
  radius: number;
}
/** Portrait screen content area per device (content-local, centred). */
const SCREENS: Record<DevicePresetName, ScreenRect> = {
  phone: { width: 352, height: 736, radius: 38 },
  tablet: { width: 544, height: 764, radius: 18 },
  laptop: { width: 840, height: 520, radius: 8 },
  browser: { width: 984, height: 568, radius: 6 },
  watch: { width: 184, height: 224, radius: 44 },
  monitor: { width: 1056, height: 600, radius: 6 },
};

const isLandscape = (name: DevicePresetName, o: DevicePresetOpts): boolean =>
  (name === "phone" || name === "tablet") && o.orientation === "landscape";

function screenDims(name: DevicePresetName, o: DevicePresetOpts): ScreenRect {
  const d = SCREENS[name];
  return isLandscape(name, o) ? { width: d.height, height: d.width, radius: d.radius } : d;
}

/** The screen's content area (content-local coords: origin 0,0 = screen centre,
 *  pre-scale). Author/scroll `content` against these bounds. */
export function deviceScreen(name: DevicePresetName, opts: DevicePresetOpts = {}): { x: number; y: number; width: number; height: number; radius: number } {
  const d = screenDims(name, opts);
  return { x: 0, y: 0, width: d.width, height: d.height, radius: d.radius };
}

/** The clipped screen group: bg + a `${id}-content` handle the caller animates. */
function screenGroup(id: string, p: Palette, o: DevicePresetOpts, cx: number, cy: number, dims: ScreenRect, content: NodeIR[]): NodeIR {
  return group({ id: `${id}-screen`, x: cx, y: cy, clip: { kind: "rect", x: -dims.width / 2, y: -dims.height / 2, width: dims.width, height: dims.height, radius: dims.radius } }, [
    rect({ id: `${id}-screenbg`, x: 0, y: 0, anchor: "center", width: dims.width, height: dims.height, fill: o.screen ?? p.screen }),
    group({ id: `${id}-content`, x: 0, y: 0 }, content),
  ]);
}

function buildDevice(name: DevicePresetName, id: string, p: Palette, o: DevicePresetOpts, content: NodeIR[]): NodeIR[] {
  const dims = screenDims(name, o);
  const sw = dims.width;
  const sh = dims.height;
  switch (name) {
    case "phone":
    case "tablet": {
      const bezel = name === "phone" ? 20 : 28;
      const bodyW = sw + bezel * 2;
      const bodyH = sh + bezel * 2;
      const bodyR = name === "phone" ? 54 : 34;
      const land = isLandscape(name, o);
      const nodes: NodeIR[] = [
        rect({ id: `${id}-body`, x: 0, y: 0, anchor: "center", width: bodyW, height: bodyH, fill: p.body, stroke: p.bodyStroke, strokeWidth: 2, radius: bodyR }),
        screenGroup(id, p, o, 0, 0, dims, content),
      ];
      if (name === "phone") {
        // notch on the "top" edge, home indicator opposite — swap to a side when landscape
        nodes.push(
          land
            ? rect({ id: `${id}-notch`, x: -sw / 2 - 8, y: 0, anchor: "center", width: 34, height: 120, fill: "#000000", radius: 17 })
            : rect({ id: `${id}-notch`, x: 0, y: -sh / 2 - 8, anchor: "center", width: 120, height: 34, fill: "#000000", radius: 17 }),
          land
            ? rect({ id: `${id}-home`, x: sw / 2 - 4, y: 0, anchor: "center", width: 5, height: 120, fill: p.detail, radius: 3 })
            : rect({ id: `${id}-home`, x: 0, y: sh / 2 - 18, anchor: "center", width: 120, height: 5, fill: p.detail, radius: 3 }),
        );
      } else {
        nodes.push(rect({ id: `${id}-camera`, x: land ? -sw / 2 - 14 : 0, y: land ? 0 : -sh / 2 - 14, anchor: "center", width: 8, height: 8, fill: p.detail, radius: 4 }));
      }
      return nodes;
    }
    case "laptop": {
      // upper screen panel + hinge + a foreshortened deck (trapezoid path)
      return [
        path({ id: `${id}-base`, x: 0, y: 0, d: "M -450 140 L 450 140 L 520 196 L -520 196 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
        rect({ id: `${id}-trackpad`, x: 0, y: 196, anchor: "center", width: 120, height: 10, fill: p.detail, radius: 5 }),
        rect({ id: `${id}-hinge`, x: 0, y: 134, anchor: "center", width: 900, height: 10, fill: p.detail, radius: 5 }),
        screenGroup(id, p, o, 0, -150, dims, content),
        rect({ id: `${id}-lid`, x: 0, y: -150, anchor: "center", width: sw + 40, height: sh + 40, stroke: p.bodyStroke, strokeWidth: 2, radius: 18 }),
      ];
    }
    case "browser": {
      const winW = sw + 16;
      const winH = sh + 92; // 48 title bar + margins
      return [
        rect({ id: `${id}-win`, x: 0, y: 0, anchor: "center", width: winW, height: winH, fill: p.chrome, stroke: p.bodyStroke, strokeWidth: 1.5, radius: 14 }),
        ellipse({ id: `${id}-dot1`, x: -winW / 2 + 30, y: -winH / 2 + 24, anchor: "center", width: 13, height: 13, fill: "#FF5F57" }),
        ellipse({ id: `${id}-dot2`, x: -winW / 2 + 54, y: -winH / 2 + 24, anchor: "center", width: 13, height: 13, fill: "#FEBC2E" }),
        ellipse({ id: `${id}-dot3`, x: -winW / 2 + 78, y: -winH / 2 + 24, anchor: "center", width: 13, height: 13, fill: "#28C840" }),
        rect({ id: `${id}-urlpill`, x: 40, y: -winH / 2 + 24, anchor: "center", width: 760, height: 26, fill: o.screen ?? p.screen, stroke: p.bodyStroke, strokeWidth: 1, radius: 13 }),
        text({ id: `${id}-urltext`, x: 40 - 360, y: -winH / 2 + 24, anchor: "center-left", content: urlText(o.url), fontFamily: "Inter", fontSize: 14, fill: p.chromeText }),
        screenGroup(id, p, o, 0, 24, dims, content),
      ];
    }
    case "watch": {
      return [
        rect({ id: `${id}-body`, x: 0, y: 0, anchor: "center", width: sw + 36, height: sh + 36, fill: p.body, stroke: p.bodyStroke, strokeWidth: 3, radius: 60 }),
        screenGroup(id, p, o, 0, 0, dims, content),
        rect({ id: `${id}-crown`, x: (sw + 36) / 2, y: -20, anchor: "center", width: 14, height: 40, fill: p.detail, radius: 6 }),
        rect({ id: `${id}-button`, x: (sw + 36) / 2 - 2, y: 40, anchor: "center", width: 8, height: 34, fill: p.detail, radius: 4 }),
      ];
    }
    case "monitor": {
      return [
        rect({ id: `${id}-panel`, x: 0, y: 0, anchor: "center", width: sw + 44, height: sh + 60, fill: p.body, stroke: p.bodyStroke, strokeWidth: 2, radius: 16 }),
        screenGroup(id, p, o, 0, 0, dims, content),
        rect({ id: `${id}-neck`, x: 0, y: (sh + 60) / 2 + 60, anchor: "center", width: 60, height: 120, fill: p.body }),
        path({ id: `${id}-stand`, x: 0, y: (sh + 60) / 2 + 60, d: "M -160 50 L 160 50 L 220 80 L -220 80 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
      ];
    }
  }
}

const urlText = (url: string | undefined): string => {
  const u = url ?? "reframe.video";
  return u.length > 70 ? `${u.slice(0, 67)}…` : u;
};

/** Build a device-mockup frame (a group) with a clipped screen content slot. */
export function devicePreset(name: DevicePresetName, opts: DevicePresetOpts = {}): NodeIR {
  const id = opts.id ?? "device";
  const p = opts.color === "light" ? LIGHT : DARK;
  const children = buildDevice(name, id, p, opts, opts.content ?? []);
  return group(
    {
      id,
      x: opts.x ?? 0,
      y: opts.y ?? 0,
      ...(opts.scale !== undefined && opts.scale !== 1 && { scale: opts.scale }),
      ...(opts.opacity !== undefined && opts.opacity !== 1 && { opacity: opts.opacity }),
    },
    children,
  );
}
