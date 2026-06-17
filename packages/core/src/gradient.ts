/**
 * Gradient paints — the structured alternative to a solid color `fill`/`stroke`.
 *
 * Coordinates are normalized to the node's bounding box (0..1), so a gradient is
 * just an angle + color stops, independent of the node's size. The renderer maps
 * 0..1 → the node's local box and the paint is applied in node-local space, so
 * rotating/scaling the NODE moves the gradient with it (the "animated gradient"
 * idiom — gradients themselves are static this version). Pure + deterministic.
 */
import type { ColorStop, Gradient, Paint } from "./ir.js";

/** True when a paint is a gradient object (vs a plain color string). */
export function isGradient(p: Paint | undefined): p is Gradient {
  return (
    typeof p === "object" &&
    p !== null &&
    (p.kind === "linear" || p.kind === "radial" || p.kind === "conic")
  );
}

// Normalize `["#f00","#00f"]` → even offsets, or pass through `ColorStop[]`.
function toStops(stops: (string | ColorStop)[]): ColorStop[] {
  if (stops.length > 0 && typeof stops[0] === "object") return stops as ColorStop[];
  const cs = stops as string[];
  const n = cs.length;
  return cs.map((color, i) => ({ offset: n <= 1 ? 0 : i / (n - 1), color }));
}

/** A linear gradient. `angle` in degrees: 0 = left→right, 90 = top→bottom. */
export function linearGradient(stops: (string | ColorStop)[], opts: { angle?: number } = {}): Gradient {
  return { kind: "linear", ...(opts.angle !== undefined && { angle: opts.angle }), stops: toStops(stops) };
}

/** A radial gradient. `cx/cy` centre (0..1 of the box, default 0.5), `r` radius (0..1, default 0.5). */
export function radialGradient(
  stops: (string | ColorStop)[],
  opts: { cx?: number; cy?: number; r?: number } = {},
): Gradient {
  return {
    kind: "radial",
    ...(opts.cx !== undefined && { cx: opts.cx }),
    ...(opts.cy !== undefined && { cy: opts.cy }),
    ...(opts.r !== undefined && { r: opts.r }),
    stops: toStops(stops),
  };
}

/** A conic (angular sweep) gradient. `angle` start in degrees, `cx/cy` centre (0..1). */
export function conicGradient(
  stops: (string | ColorStop)[],
  opts: { angle?: number; cx?: number; cy?: number } = {},
): Gradient {
  return {
    kind: "conic",
    ...(opts.angle !== undefined && { angle: opts.angle }),
    ...(opts.cx !== undefined && { cx: opts.cx }),
    ...(opts.cy !== undefined && { cy: opts.cy }),
    stops: toStops(stops),
  };
}
