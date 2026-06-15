/**
 * MotionPath geometry — a Catmull-Rom spline through waypoints, evaluated as a
 * pure function of progress u in [0,1]. Used by evaluate() to drive a node's
 * x/y (and, with autoRotate, rotation along the tangent) along a curve.
 *
 * Pure math, no DOM: same result in Node (tests/golden) and the browser
 * renderer. Uniform parameterisation — each segment owns an equal slice of u.
 * Good for hand-authored sting waypoints; centripetal can come later if uneven
 * spacing ever overshoots.
 */

export type Pt = [number, number];

/** Resolve a global u into a segment index and local t in [0,1]. */
function locate(segCount: number, u: number): { i: number; t: number } {
  if (segCount <= 0) return { i: 0, t: 0 };
  const clamped = Math.max(0, Math.min(1, u));
  const scaled = clamped * segCount;
  let i = Math.floor(scaled);
  if (i >= segCount) i = segCount - 1; // u === 1 lands on the last segment
  return { i, t: scaled - i };
}

/** The four control points for the segment starting at index i (clamped/​wrapped ends). */
function controls(points: Pt[], closed: boolean, i: number): [Pt, Pt, Pt, Pt] {
  const n = points.length;
  const at = (k: number): Pt => {
    if (closed) return points[((k % n) + n) % n]!;
    return points[Math.max(0, Math.min(n - 1, k))]!;
  };
  return [at(i - 1), at(i), at(i + 1), at(i + 2)];
}

function segCountOf(points: Pt[], closed: boolean): number {
  const n = points.length;
  if (n < 2) return 0;
  return closed ? n : n - 1;
}

/** Position on the spline at progress u in [0,1]. */
export function pathPoint(points: Pt[], closed: boolean, u: number): Pt {
  const n = points.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [points[0]![0], points[0]![1]];
  const segs = segCountOf(points, closed);
  const { i, t } = locate(segs, u);
  const [p0, p1, p2, p3] = controls(points, closed, i);
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** Tangent angle (degrees) at progress u — the direction of travel along the path. */
export function pathTangentAngle(points: Pt[], closed: boolean, u: number): number {
  const n = points.length;
  if (n < 2) return 0;
  const segs = segCountOf(points, closed);
  const { i, t } = locate(segs, u);
  const [p0, p1, p2, p3] = controls(points, closed, i);
  const t2 = t * t;
  const d = (a: number, b: number, c: number, e: number) =>
    0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - e) * t + 3 * (-a + 3 * b - 3 * c + e) * t2);
  const dx = d(p0[0], p1[0], p2[0], p3[0]);
  const dy = d(p0[1], p1[1], p2[1], p3[1]);
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
