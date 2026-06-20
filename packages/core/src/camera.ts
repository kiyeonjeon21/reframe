/**
 * The scene camera — a single affine viewport applied to the whole scene.
 *
 * Semantics (look-at): `camera.{x,y}` is the scene point centered in frame,
 * `zoom` scales about it, `rotation` (degrees) turns about it. Defaults
 * (`x=W/2, y=H/2, zoom=1, rotation=0`) are the identity, so a scene without a
 * camera renders byte-identically.
 *
 * The camera is animated through the SAME machinery as nodes: tween / motionPath /
 * behaviors targeting the reserved id `"camera"` with props x/y/zoom/rotation.
 * `cameraTo` is a thin readable wrapper. Because those are ordinary labeled
 * timeline steps, camera keyframes are overlay-addressable for free, so human
 * edits survive AI regeneration.
 */

import type { CameraIR, Ease, PropValue, Size, TimelineIR } from "./ir.js";
import type { Mat2D } from "./evaluate.js";
import { tween } from "./dsl.js";

/** Reserved timeline/behavior target id for the camera. */
export const CAMERA_ID = "camera";
/** The animatable camera props (look-at point + zoom + rotation + perspective). */
export const CAMERA_PROPS = ["x", "y", "zoom", "rotation", "perspective"] as const;

/**
 * The camera's affine matrix: `T(W/2,H/2) · R(rotation) · S(zoom) · T(-x,-y)`,
 * i.e. center the focal point, then zoom/rotate about the frame centre. Defaults
 * collapse to the identity.
 */
export function cameraMatrix(cam: CameraIR, size: Size): Mat2D {
  const W = size.width;
  const H = size.height;
  const x = cam.x ?? W / 2;
  const y = cam.y ?? H / 2;
  const zoom = cam.zoom ?? 1;
  const r = ((cam.rotation ?? 0) * Math.PI) / 180;
  const a = Math.cos(r) * zoom;
  const b = Math.sin(r) * zoom;
  // guard the negated shear so rotation 0 yields +0, not -0 — then an identity
  // camera is byte-identical to no camera at all.
  const c = b === 0 ? 0 : -b;
  const d = Math.cos(r) * zoom;
  return [a, b, c, d, W / 2 - a * x - c * y, H / 2 - b * x - d * y];
}

/**
 * Frame a scene-space bounding box in the viewport — returns `{ x, y, zoom }` to
 * spread into `cameraTo`, GUARANTEED not to clip the box. The visible scene rect
 * is `W/zoom × H/zoom` centred on `(x, y)`; fitting `box` (+ `margin` padding on
 * the tight axis) means `zoom = min(W/(box.w+2m), H/(box.h+2m))`, capped by
 * `maxZoom` so a tiny target doesn't zoom absurdly close.
 *
 *   cameraTo(cameraFit({ x: 200, y: 760, width: 740, height: 360 }, { margin: 90 }),
 *            { duration: 1, ease: "easeInOutCubic" })
 *
 * `box` is a top-left rect in scene coords (a centre-anchored panel at (px,py) of
 * size (pw,ph) is `{ x: px-pw/2, y: py-ph/2, width: pw, height: ph }`).
 */
export function cameraFit(
  box: { x: number; y: number; width: number; height: number },
  opts: { size?: Size; margin?: number; maxZoom?: number } = {},
): { x: number; y: number; zoom: number } {
  const W = opts.size?.width ?? 1920;
  const H = opts.size?.height ?? 1080;
  const m = opts.margin ?? 80;
  const fit = Math.min(W / (box.width + 2 * m), H / (box.height + 2 * m));
  const zoom = Math.min(fit, opts.maxZoom ?? 2.4);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, zoom };
}

/** Keyframe the camera: a `tween` on the reserved "camera" target. */
export function cameraTo(
  props: CameraIR,
  opts: { duration?: number; ease?: Ease; label?: string } = {},
): TimelineIR {
  return tween(CAMERA_ID, props as Record<string, PropValue>, opts);
}
