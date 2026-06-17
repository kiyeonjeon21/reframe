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

/**
 * A loose bounding box `[x, y, w, h]` from a path `d`'s coordinate extents — used
 * only to map a gradient across the shape. Exact for M/L/C/Q/S/T paths (every
 * number is an x/y coord, control points included); loose for the rare H/V/A.
 */
export function pathBBox(d: string): [number, number, number, number] {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums || nums.length < 2) return [0, 0, 1, 1];
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]!);
    const y = parseFloat(nums[i + 1]!);
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  }
  const w = maxx - minx;
  const h = maxy - miny;
  return [minx, miny, w > 0 ? w : 1, h > 0 ? h : 1];
}

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

/**
 * Position on the spline at progress u in [0,1]. `curviness` scales the
 * Catmull-Rom tangents (GSAP's idea): 1 = standard smooth (the default and the
 * byte-exact original), 0 = straight lines / sharp corners, >1 = looser/loopier.
 */
export function pathPoint(points: Pt[], closed: boolean, u: number, curviness = 1): Pt {
  const n = points.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [points[0]![0], points[0]![1]];
  const segs = segCountOf(points, closed);
  const { i, t } = locate(segs, u);
  const [p0, p1, p2, p3] = controls(points, closed, i);
  const t2 = t * t;
  const t3 = t2 * t;
  if (curviness === 1) {
    // unchanged Catmull-Rom basis — byte-identical to before
    const f = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  // Hermite form with curviness-scaled tangents m = curviness * (next - prev)/2
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const k = curviness * 0.5;
  const H = (a: number, b: number, c: number, d: number) =>
    h00 * b + h10 * k * (c - a) + h01 * c + h11 * k * (d - b);
  return [H(p0[0], p1[0], p2[0], p3[0]), H(p0[1], p1[1], p2[1], p3[1])];
}

/** Tangent angle (degrees) at progress u — the direction of travel along the path. */
export function pathTangentAngle(points: Pt[], closed: boolean, u: number, curviness = 1): number {
  const n = points.length;
  if (n < 2) return 0;
  const segs = segCountOf(points, closed);
  const { i, t } = locate(segs, u);
  const [p0, p1, p2, p3] = controls(points, closed, i);
  const t2 = t * t;
  let dx: number;
  let dy: number;
  if (curviness === 1) {
    const d = (a: number, b: number, c: number, e: number) =>
      0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - e) * t + 3 * (-a + 3 * b - 3 * c + e) * t2);
    dx = d(p0[0], p1[0], p2[0], p3[0]);
    dy = d(p0[1], p1[1], p2[1], p3[1]);
  } else {
    const g00 = 6 * t2 - 6 * t;
    const g10 = 3 * t2 - 4 * t + 1;
    const g01 = -6 * t2 + 6 * t;
    const g11 = 3 * t2 - 2 * t;
    const k = curviness * 0.5;
    const D = (a: number, b: number, c: number, e: number) =>
      g00 * b + g10 * k * (c - a) + g01 * c + g11 * k * (e - b);
    dx = D(p0[0], p1[0], p2[0], p3[0]);
    dy = D(p0[1], p1[1], p2[1], p3[1]);
  }
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
