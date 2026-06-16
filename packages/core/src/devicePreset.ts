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
 *
 * Layout/teardown helpers: `deviceScreen` (content-local screen bounds),
 * `deviceScreenCenter` (device-local screen origin — slide `${id}-screen` against
 * it to eject the panel for an exploded view), `deviceBounds` (full frame
 * footprint — for laying many devices on a grid).
 */

import { ellipse, group, path, rect, text } from "./dsl.js";
import type { NodeIR } from "./ir.js";

export const DEVICE_PRESET_NAMES = ["phone", "tablet", "laptop", "browser", "watch", "monitor", "tv", "foldable", "terminal", "car"] as const;
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
  /** Browser/terminal address-bar text. */
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

/** The clipped screen group: bg + a `${id}-content` handle the caller animates. */
function screenGroup(id: string, p: Palette, o: DevicePresetOpts, cx: number, cy: number, dims: Required<ScreenRect>, content: NodeIR[]): NodeIR {
  return group({ id: `${id}-screen`, x: cx, y: cy, clip: { kind: "rect", x: -dims.width / 2, y: -dims.height / 2, width: dims.width, height: dims.height, radius: dims.radius } }, [
    rect({ id: `${id}-screenbg`, x: 0, y: 0, anchor: "center", width: dims.width, height: dims.height, fill: o.screen ?? p.screen }),
    group({ id: `${id}-content`, x: 0, y: 0 }, content),
  ]);
}

function buildDevice(name: DevicePresetName, id: string, p: Palette, o: DevicePresetOpts, content: NodeIR[]): NodeIR[] {
  const dims = screenDims(name, o);
  const sw = dims.width;
  const sh = dims.height;
  const screen = () => screenGroup(id, p, o, dims.cx, dims.cy, dims, content);
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
        screen(),
      ];
      if (name === "phone") {
        // dynamic-island pill on the "top" edge, home indicator opposite — swap to a side when landscape
        nodes.push(
          land
            ? rect({ id: `${id}-notch`, x: -sw / 2 + 16, y: 0, anchor: "center", width: 30, height: 96, fill: "#000000", radius: 15 })
            : rect({ id: `${id}-notch`, x: 0, y: -sh / 2 + 16, anchor: "center", width: 96, height: 30, fill: "#000000", radius: 15 }),
          land
            ? rect({ id: `${id}-home`, x: sw / 2 - 4, y: 0, anchor: "center", width: 5, height: 120, fill: p.detail, radius: 3 })
            : rect({ id: `${id}-home`, x: 0, y: sh / 2 - 18, anchor: "center", width: 120, height: 5, fill: p.detail, radius: 3 }),
        );
        if (!land) {
          // side hardware: power on the right, volume rocker on the left
          nodes.push(
            rect({ id: `${id}-pwr`, x: bodyW / 2, y: -bodyH * 0.1, anchor: "center", width: 4, height: 78, fill: p.detail, radius: 2 }),
            rect({ id: `${id}-volup`, x: -bodyW / 2, y: -bodyH * 0.16, anchor: "center", width: 4, height: 48, fill: p.detail, radius: 2 }),
            rect({ id: `${id}-voldn`, x: -bodyW / 2, y: -bodyH * 0.16 + 60, anchor: "center", width: 4, height: 48, fill: p.detail, radius: 2 }),
          );
        }
      } else {
        nodes.push(
          rect({ id: `${id}-camera`, x: land ? -sw / 2 - 14 : 0, y: land ? 0 : -sh / 2 - 14, anchor: "center", width: 8, height: 8, fill: p.detail, radius: 4 }),
          rect({ id: `${id}-pwr`, x: land ? -bodyW * 0.18 : bodyW * 0.18, y: land ? -bodyH / 2 : -bodyH / 2, anchor: "center", width: 60, height: 4, fill: p.detail, radius: 2 }),
        );
      }
      return nodes;
    }
    case "laptop": {
      // upper screen panel + hinge + a foreshortened deck (trapezoid path) with
      // a suggested keyboard (foreshortened key rows) + trackpad + feet
      const lidTop = dims.cy - (sh + 40) / 2;
      const keyRows = [0, 1, 2, 3].map((r) =>
        rect({ id: `${id}-keys${r}`, x: 0, y: 150 + r * 11, anchor: "center", width: 640 + r * 50, height: 6, fill: p.chrome, radius: 3 }),
      );
      return [
        path({ id: `${id}-base`, x: 0, y: 0, d: "M -450 140 L 450 140 L 520 196 L -520 196 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
        rect({ id: `${id}-foot-l`, x: -360, y: 198, anchor: "center", width: 70, height: 5, fill: p.detail, radius: 3 }),
        rect({ id: `${id}-foot-r`, x: 360, y: 198, anchor: "center", width: 70, height: 5, fill: p.detail, radius: 3 }),
        ...keyRows,
        rect({ id: `${id}-trackpad`, x: 0, y: 184, anchor: "center", width: 150, height: 8, fill: p.detail, radius: 4 }),
        rect({ id: `${id}-hinge`, x: 0, y: 134, anchor: "center", width: 900, height: 10, fill: p.detail, radius: 5 }),
        screen(),
        ellipse({ id: `${id}-webcam`, x: 0, y: lidTop + 14, anchor: "center", width: 6, height: 6, fill: p.detail }),
        rect({ id: `${id}-lid`, x: 0, y: dims.cy, anchor: "center", width: sw + 40, height: sh + 40, stroke: p.bodyStroke, strokeWidth: 2, radius: 18 }),
      ];
    }
    case "browser": {
      const winW = sw + 16;
      const winH = sh + 92; // 48 title bar + margins
      const barY = -winH / 2 + 24;
      return [
        rect({ id: `${id}-win`, x: 0, y: 0, anchor: "center", width: winW, height: winH, fill: p.chrome, stroke: p.bodyStroke, strokeWidth: 1.5, radius: 14 }),
        ellipse({ id: `${id}-dot1`, x: -winW / 2 + 30, y: barY, anchor: "center", width: 13, height: 13, fill: "#FF5F57" }),
        ellipse({ id: `${id}-dot2`, x: -winW / 2 + 54, y: barY, anchor: "center", width: 13, height: 13, fill: "#FEBC2E" }),
        ellipse({ id: `${id}-dot3`, x: -winW / 2 + 78, y: barY, anchor: "center", width: 13, height: 13, fill: "#28C840" }),
        // an active tab tucked under the lights
        rect({ id: `${id}-tab`, x: -winW / 2 + 230, y: barY, anchor: "center", width: 190, height: 30, fill: o.screen ?? p.screen, radius: 8 }),
        text({ id: `${id}-tabtext`, x: -winW / 2 + 156, y: barY, anchor: "center-left", content: "Overview", fontFamily: "Inter", fontSize: 13, fill: p.chromeText }),
        rect({ id: `${id}-urlpill`, x: 96, y: barY, anchor: "center", width: 700, height: 26, fill: o.screen ?? p.screen, stroke: p.bodyStroke, strokeWidth: 1, radius: 13 }),
        rect({ id: `${id}-lock`, x: 96 - 330, y: barY, anchor: "center", width: 8, height: 10, fill: p.chromeText, radius: 2 }),
        text({ id: `${id}-urltext`, x: 96 - 312, y: barY, anchor: "center-left", content: urlText(o.url), fontFamily: "Inter", fontSize: 14, fill: p.chromeText }),
        screen(),
      ];
    }
    case "watch": {
      const bw = sw + 36;
      const bh = sh + 36;
      return [
        // straps (drawn behind the body) flaring out top & bottom
        path({ id: `${id}-bandtop`, x: 0, y: -bh / 2 + 4, d: "M -78 0 L 78 0 L 64 -86 L -64 -86 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
        path({ id: `${id}-bandbot`, x: 0, y: bh / 2 - 4, d: "M -78 0 L 78 0 L 64 86 L -64 86 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
        rect({ id: `${id}-body`, x: 0, y: 0, anchor: "center", width: bw, height: bh, fill: p.body, stroke: p.bodyStroke, strokeWidth: 3, radius: 60 }),
        screen(),
        rect({ id: `${id}-crown`, x: bw / 2, y: -20, anchor: "center", width: 14, height: 40, fill: p.detail, radius: 6 }),
        rect({ id: `${id}-button`, x: bw / 2 - 2, y: 40, anchor: "center", width: 8, height: 34, fill: p.detail, radius: 4 }),
      ];
    }
    case "monitor": {
      const panelW = sw + 44;
      const panelH = sh + 60;
      return [
        rect({ id: `${id}-panel`, x: 0, y: 0, anchor: "center", width: panelW, height: panelH, fill: p.body, stroke: p.bodyStroke, strokeWidth: 2, radius: 16 }),
        screen(),
        ellipse({ id: `${id}-led`, x: panelW / 2 - 26, y: panelH / 2 - 16, anchor: "center", width: 6, height: 6, fill: "#28C840" }),
        rect({ id: `${id}-neck`, x: 0, y: panelH / 2 + 60, anchor: "center", width: 60, height: 120, fill: p.body }),
        path({ id: `${id}-stand`, x: 0, y: panelH / 2 + 60, d: "M -160 50 L 160 50 L 220 80 L -220 80 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
      ];
    }
    case "tv": {
      // thin-bezel wide panel on a centre pedestal stand
      const panelW = sw + 44;
      const panelH = sh + 48;
      const panelBottom = dims.cy + panelH / 2;
      return [
        rect({ id: `${id}-panel`, x: 0, y: dims.cy, anchor: "center", width: panelW, height: panelH, fill: p.body, stroke: p.bodyStroke, strokeWidth: 2, radius: 12 }),
        screen(),
        ellipse({ id: `${id}-brand`, x: 0, y: panelBottom - 12, anchor: "center", width: 6, height: 6, fill: p.detail }),
        rect({ id: `${id}-neck`, x: 0, y: panelBottom + 48, anchor: "center", width: 64, height: 96, fill: p.body }),
        path({ id: `${id}-stand`, x: 0, y: panelBottom + 96, d: "M -210 0 L 210 0 L 270 34 L -270 34 Z", fill: p.body, stroke: p.bodyStroke, strokeWidth: 2 }),
      ];
    }
    case "foldable": {
      // unfolded wide phone: centre crease, side hinge knuckles, dual camera
      const bodyW = sw + 40;
      const bodyH = sh + 40;
      return [
        rect({ id: `${id}-hinge-l`, x: -bodyW / 2, y: 0, anchor: "center", width: 8, height: bodyH * 0.5, fill: p.detail, radius: 4 }),
        rect({ id: `${id}-hinge-r`, x: bodyW / 2, y: 0, anchor: "center", width: 8, height: bodyH * 0.5, fill: p.detail, radius: 4 }),
        rect({ id: `${id}-body`, x: 0, y: 0, anchor: "center", width: bodyW, height: bodyH, fill: p.body, stroke: p.bodyStroke, strokeWidth: 2, radius: 28 }),
        screen(),
        rect({ id: `${id}-crease`, x: 0, y: 0, anchor: "center", width: 4, height: sh, fill: p.bodyStroke, radius: 2, opacity: 0.5 }),
        ellipse({ id: `${id}-cam1`, x: -10, y: -sh / 2 + 18, anchor: "center", width: 8, height: 8, fill: p.detail }),
        ellipse({ id: `${id}-cam2`, x: 10, y: -sh / 2 + 18, anchor: "center", width: 8, height: 8, fill: p.detail }),
      ];
    }
    case "terminal": {
      // a CLI window: title bar with lights, a centred prompt label, dark screen
      const winW = sw + 16;
      const winH = sh + 76; // 44 title bar
      return [
        rect({ id: `${id}-win`, x: 0, y: 0, anchor: "center", width: winW, height: winH, fill: p.chrome, stroke: p.bodyStroke, strokeWidth: 1.5, radius: 12 }),
        ellipse({ id: `${id}-dot1`, x: -winW / 2 + 28, y: -winH / 2 + 22, anchor: "center", width: 12, height: 12, fill: "#FF5F57" }),
        ellipse({ id: `${id}-dot2`, x: -winW / 2 + 50, y: -winH / 2 + 22, anchor: "center", width: 12, height: 12, fill: "#FEBC2E" }),
        ellipse({ id: `${id}-dot3`, x: -winW / 2 + 72, y: -winH / 2 + 22, anchor: "center", width: 12, height: 12, fill: "#28C840" }),
        rect({ id: `${id}-tab`, x: -winW / 2 + 170, y: -winH / 2 + 22, anchor: "center", width: 130, height: 24, fill: o.screen ?? p.screen, radius: 6 }),
        text({ id: `${id}-title`, x: -winW / 2 + 170, y: -winH / 2 + 22, anchor: "center", content: urlText(o.url ?? "zsh"), fontFamily: "Inter", fontSize: 13, fill: p.chromeText }),
        screen(),
      ];
    }
    case "car": {
      // wide rounded infotainment display in a dash bezel + a tuning knob & climate row
      const bodyW = sw + 60;
      const bodyH = sh + 60;
      return [
        rect({ id: `${id}-body`, x: 0, y: 0, anchor: "center", width: bodyW, height: bodyH, fill: p.body, stroke: p.bodyStroke, strokeWidth: 2, radius: 40 }),
        ellipse({ id: `${id}-knob`, x: -bodyW / 2 + 18, y: 0, anchor: "center", width: 22, height: 22, fill: p.body, stroke: p.detail, strokeWidth: 3 }),
        screen(),
        ellipse({ id: `${id}-btn1`, x: -44, y: sh / 2 + 16, anchor: "center", width: 12, height: 12, fill: p.detail }),
        ellipse({ id: `${id}-btn2`, x: 0, y: sh / 2 + 16, anchor: "center", width: 12, height: 12, fill: p.detail }),
        ellipse({ id: `${id}-btn3`, x: 44, y: sh / 2 + 16, anchor: "center", width: 12, height: 12, fill: p.detail }),
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
