/**
 * Coarse spatial binning of the motion signals — additive to the whole-frame
 * profiler. The frame-scalar `analyzePair` provably cannot separate two
 * concurrent events in different screen regions (both just raise global diff),
 * so reference→motion needs a spatial dimension. This bins the SAME signals
 * (no new CV) plus one new single-frame `occupancy` (edge density) that gives
 * enter (rising) vs exit (falling) per region.
 */

export interface GridSpec {
  cols: number;
  rows: number;
}

export const DEFAULT_GRID: GridSpec = { cols: 8, rows: 5 };

const cellOf = (x: number, y: number, w: number, h: number, spec: GridSpec): number => {
  const c = Math.min(spec.cols - 1, Math.floor((x * spec.cols) / w));
  const r = Math.min(spec.rows - 1, Math.floor((y * spec.rows) / h));
  return r * spec.cols + c;
};

/** Mean |next-prev| per cell over a frame pair (spatial bin of diffMean). */
export function cellDiff(
  prev: Uint8Array,
  next: Uint8Array,
  w: number,
  h: number,
  spec: GridSpec,
): number[] {
  const n = spec.cols * spec.rows;
  const sum = new Array<number>(n).fill(0);
  const cnt = new Array<number>(n).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = cellOf(x, y, w, h, spec);
      sum[idx]! += Math.abs(next[y * w + x]! - prev[y * w + x]!);
      cnt[idx]!++;
    }
  }
  return sum.map((s, i) => (cnt[i] ? s / cnt[i]! : 0));
}

/**
 * Per-cell occupancy of a single frame = mean local gradient magnitude
 * (edge density). Rises when structured content fills a region, falls when it
 * empties — the signed signal that distinguishes enter from exit.
 */
export function frameOccupancy(frame: Uint8Array, w: number, h: number, spec: GridSpec): number[] {
  const n = spec.cols * spec.rows;
  const sum = new Array<number>(n).fill(0);
  const cnt = new Array<number>(n).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const here = frame[y * w + x]!;
      const gx = x + 1 < w ? Math.abs(frame[y * w + x + 1]! - here) : 0;
      const gy = y + 1 < h ? Math.abs(frame[(y + 1) * w + x]! - here) : 0;
      const idx = cellOf(x, y, w, h, spec);
      sum[idx]! += gx + gy;
      cnt[idx]!++;
    }
  }
  return sum.map((s, i) => (cnt[i] ? s / cnt[i]! : 0));
}
