/**
 * Spatial query over the DisplayList — the spatial analog of `sceneManifest`.
 * `manifest` answers "what can I edit?" (addresses); this answers "where is it on
 * screen, and what's under a point?" at time t, so an embedded editor can draw
 * selection outlines, hit-test clicks, and place draggable handles (incl. motionPath
 * waypoints) — all composing back through the overlay model.
 *
 * Pure + deterministic: a function of `evaluate(compiled, t)`'s DisplayList (each op
 * already carries its source `id` + final scene-space `transform`, camera/perspective
 * baked) plus canvas-free Inter advances (`textMetrics`). No change to `evaluate`.
 */
import { cameraMatrix } from "./camera.js";
import type { CompiledScene } from "./compile.js";
import { evaluate, nodeParentMatrix, sampleProp, type DisplayOp, type Mat2D } from "./evaluate.js";
import type { NodeIR, TimelineIR } from "./ir.js";
import { pathBBox } from "./path.js";
import { INTER_ADVANCE, INTER_FALLBACK } from "./textMetrics.js";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A drawable node's geometry at time t. `corners` is the (possibly rotated) quad in scene coords; `bounds` is its AABB. */
export interface NodeGeometry {
  id: string;
  corners: [number, number][];
  bounds: Bounds;
}
/** A group's bounding box (the union of its descendant leaves' bounds). */
export interface GroupGeometry {
  id: string;
  bounds: Bounds;
}
/** A motionPath control point in scene coords — drag it → a `timeline.<label>.points` overlay patch. */
export interface Waypoint {
  label: string;
  target: string;
  index: number;
  x: number;
  y: number;
}
export interface SceneGeometry {
  time: number;
  size: { width: number; height: number };
  nodes: NodeGeometry[];
  groups: GroupGeometry[];
  waypoints: Waypoint[];
}

const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

function applyMat(m: Mat2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Laid-out width (px) of a string in Inter at `fontSize` — canvas-free and
 * deterministic, using the same advance table `splitText` lays glyphs with.
 */
export function textWidth(content: string, fontSize: number, weight: number, letterSpacing = 0): number {
  const chars = [...content];
  let total = 0;
  for (let i = 0; i < chars.length; i++) {
    const adv = (INTER_ADVANCE[weight]?.[chars[i]!] ?? INTER_FALLBACK[weight] ?? INTER_FALLBACK[400]!) * (fontSize / 100);
    total += adv + (i < chars.length - 1 ? letterSpacing : 0);
  }
  return total;
}

/** The scene-space corners of a drawable op (its local quad pushed through `op.transform`). Marker ops → []. */
function opCorners(op: DisplayOp): [number, number][] {
  switch (op.type) {
    case "rect":
    case "ellipse":
    case "image":
    case "video": {
      const { offsetX: x, offsetY: y, width: w, height: h } = op;
      return (
        [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ] as [number, number][]
      ).map(([px, py]) => applyMat(op.transform, px, py));
    }
    case "line":
      return [applyMat(op.transform, op.x1, op.y1), applyMat(op.transform, op.x2, op.y2)];
    case "text": {
      const w = textWidth(op.content, op.fontSize, op.fontWeight, op.letterSpacing);
      const h = op.fontSize * 1.2;
      const x0 = op.align === "right" ? -w : op.align === "center" ? -w / 2 : 0;
      const y0 = op.baseline === "bottom" ? -h : op.baseline === "middle" ? -h / 2 : 0;
      return (
        [
          [x0, y0],
          [x0 + w, y0],
          [x0 + w, y0 + h],
          [x0, y0 + h],
        ] as [number, number][]
      ).map(([px, py]) => applyMat(op.transform, px, py));
    }
    case "path": {
      const [x, y, w, h] = op.bbox ?? pathBBox(op.d);
      return (
        [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ] as [number, number][]
      ).map(([px, py]) => applyMat(op.transform, px, py));
    }
    default:
      return []; // matte / group-fx boundary markers have no drawable geometry
  }
}

function aabb(corners: [number, number][]): Bounds {
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The scene's root camera matrix at t (identity when the scene has no camera). Mirrors `evaluate`. */
function sceneCamera(compiled: CompiledScene, t: number): Mat2D {
  if (!compiled.hasCamera) return IDENTITY;
  const num = (p: string, f: number): number => {
    const v = sampleProp(compiled, t, "camera", p, f);
    return typeof v === "number" ? v : f;
  };
  return cameraMatrix(
    {
      x: num("x", compiled.ir.size.width / 2),
      y: num("y", compiled.ir.size.height / 2),
      zoom: num("zoom", 1),
      rotation: num("rotation", 0),
    },
    compiled.ir.size,
  );
}

function leafIds(node: NodeIR): string[] {
  return node.type === "group" ? node.children.flatMap(leafIds) : [node.id];
}

/**
 * All node + waypoint geometry at time `t` — the spatial analog of `sceneManifest`.
 * Compute once per frame; feed to `hitTest`, and read `bounds`/`waypoints` for handles.
 */
export function sceneGeometry(compiled: CompiledScene, t: number): SceneGeometry {
  const cornersById = new Map<string, [number, number][]>();
  const nodes: NodeGeometry[] = [];
  for (const op of evaluate(compiled, t)) {
    const corners = opCorners(op);
    if (corners.length === 0) continue; // marker op
    cornersById.set(op.id, corners);
    nodes.push({ id: op.id, corners, bounds: aabb(corners) });
  }

  // a group is boxed by the union of its descendant leaves
  const groups: GroupGeometry[] = [];
  const walkGroups = (ns: NodeIR[]): void => {
    for (const n of ns) {
      if (n.type !== "group") continue;
      const pts = leafIds(n).flatMap((id) => cornersById.get(id) ?? []);
      if (pts.length > 0) groups.push({ id: n.id, bounds: aabb(pts) });
      walkGroups(n.children);
    }
  };
  walkGroups(compiled.ir.nodes);

  // motionPath waypoints: each control point of a LABELLED path, in scene coords
  const cam = sceneCamera(compiled, t);
  const waypoints: Waypoint[] = [];
  const walkTl = (tl: TimelineIR | undefined): void => {
    if (!tl) return;
    if (tl.kind === "motionPath" && tl.label) {
      const parent = nodeParentMatrix(compiled, tl.target, t);
      if (parent) {
        tl.points.forEach(([px, py], index) => {
          const [lx, ly] = applyMat(parent, px, py);
          const [x, y] = applyMat(cam, lx, ly);
          waypoints.push({ label: tl.label!, target: tl.target, index, x, y });
        });
      }
    }
    if ("children" in tl) tl.children.forEach(walkTl);
  };
  walkTl(compiled.ir.timeline);

  return { time: t, size: compiled.ir.size, nodes, groups, waypoints };
}

function pointInPolygon(c: [number, number][], x: number, y: number): boolean {
  if (c.length < 3) return c.some(([px, py]) => Math.hypot(px - x, py - y) <= 16); // a line: near an endpoint
  let inside = false;
  for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
    const [xi, yi] = c[i]!;
    const [xj, yj] = c[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Topmost node (last-drawn) whose polygon contains the scene point (x,y), or null. */
export function hitTest(geometry: SceneGeometry, x: number, y: number): string | null {
  for (let i = geometry.nodes.length - 1; i >= 0; i--) {
    if (pointInPolygon(geometry.nodes[i]!.corners, x, y)) return geometry.nodes[i]!.id;
  }
  return null;
}
