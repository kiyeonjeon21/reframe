/**
 * Block-matching motion estimation over grayscale frame pairs.
 *
 * Three-signal decomposition per pair:
 *  - block displacement (geometric motion, sub-pixel via parabola fit)
 *  - pixel difference energy (total visual change, incl. fades/pops)
 *  - match residual (change displacement cannot explain — fades score high)
 *
 * Hand-rolled on purpose: the analytic-GT calibration gates (C1..C7) verify
 * its accuracy, which is the usual reason not to hand-roll CV.
 */

export interface BlockFlowOptions {
  width: number;
  height: number;
  /** Downscale factor to full resolution (reported speeds are multiplied). */
  scale: number;
  blockSize: number;
  /** Max displacement searched, in analysis px. */
  searchRadius: number;
  /** Per-pixel abs-diff for a pixel to count as "changed" (codec-noise aware). */
  changedThreshold: number;
  /** Mean abs-diff for a block to be analyzed at all. */
  blockActivityThreshold: number;
  /** Displacement (analysis px) above which a block counts as moving. */
  movingThreshold: number;
}

export const DEFAULT_OPTIONS: Omit<BlockFlowOptions, "width" | "height"> = {
  scale: 4, // 480x270 analysis of 1920x1080
  blockSize: 16,
  searchRadius: 12,
  changedThreshold: 2,
  blockActivityThreshold: 1.5,
  movingThreshold: 0.3,
};

export interface PairStats {
  /** Mean speed of moving blocks, FULL-RES px/frame. 0 if nothing moves. */
  blockSpeedMean: number;
  /** P95 block speed, full-res px/frame. */
  blockSpeedP95: number;
  /** Moving blocks / analyzed (active) blocks. 0 when no active blocks. */
  movingFraction: number;
  /** Mean |Δ| over all pixels (8-bit). */
  diffMean: number;
  /** Fraction of pixels with |Δ| > changedThreshold. */
  changedFraction: number;
  /** Mean per-pixel best-match SAD over active blocks — unexplained change. */
  matchResidual: number;
  /**
   * Σ bestSAD / Σ zeroSAD over active blocks. Geometric motion finds a good
   * match (→0); fades/pops can't be explained by any displacement (→1).
   */
  nonGeometricRatio: number;
  /** Fraction of active blocks whose best match hit the search border. */
  saturatedFraction: number;
  activeBlocks: number;
}

function blockSad(
  prev: Uint8Array,
  next: Uint8Array,
  width: number,
  bx: number,
  by: number,
  dx: number,
  dy: number,
  size: number,
): number {
  let sad = 0;
  for (let y = 0; y < size; y++) {
    let nextRow = (by + y) * width + bx;
    let prevRow = (by + y + dy) * width + bx + dx;
    for (let x = 0; x < size; x++) {
      sad += Math.abs(next[nextRow + x]! - prev[prevRow + x]!);
    }
  }
  return sad;
}

/** Sub-pixel offset from a 1D parabola through (left, best, right). */
function parabola(left: number, best: number, right: number): number {
  const denom = left - 2 * best + right;
  if (denom <= 0) return 0;
  return Math.max(-0.5, Math.min(0.5, (left - right) / (2 * denom)));
}

export function analyzePair(
  prev: Uint8Array,
  next: Uint8Array,
  opts: BlockFlowOptions,
): PairStats {
  const { width, height, scale, blockSize, searchRadius: R, changedThreshold } = opts;

  // --- whole-frame difference signals ---
  let diffSum = 0;
  let changed = 0;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(next[i]! - prev[i]!);
    diffSum += d;
    if (d > changedThreshold) changed++;
  }
  const diffMean = diffSum / n;
  const changedFraction = changed / n;

  // --- block matching over active blocks ---
  const speeds: number[] = [];
  let movingCount = 0;
  let saturatedCount = 0;
  let residualSum = 0;
  let zeroSadSum = 0;
  let bestSadSum = 0;
  let activeBlocks = 0;
  const pxPerBlock = blockSize * blockSize;

  for (let by = R; by + blockSize + R <= height; by += blockSize) {
    for (let bx = R; bx + blockSize + R <= width; bx += blockSize) {
      const zeroSad = blockSad(prev, next, width, bx, by, 0, 0, blockSize);
      if (zeroSad / pxPerBlock < opts.blockActivityThreshold) continue;
      activeBlocks++;

      // Flat synthetic graphics produce exact SAD ties along untextured
      // directions (a vertical edge constrains dx but not dy). A small
      // displacement penalty resolves ties toward the smallest motion
      // instead of the scan order — without it, tied blocks report |d|=R.
      const PENALTY = 2;
      let best = zeroSad;
      let bestScore = zeroSad;
      let bestDx = 0;
      let bestDy = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx === 0 && dy === 0) continue;
          const sad = blockSad(prev, next, width, bx, by, dx, dy, blockSize);
          const score = sad + PENALTY * (Math.abs(dx) + Math.abs(dy));
          if (score < bestScore) {
            bestScore = score;
            best = sad;
            bestDx = dx;
            bestDy = dy;
          }
        }
      }

      // Sub-pixel refinement when the optimum is interior.
      let fx = bestDx;
      let fy = bestDy;
      if (Math.abs(bestDx) < R) {
        fx += parabola(
          blockSad(prev, next, width, bx, by, bestDx - 1, bestDy, blockSize),
          best,
          blockSad(prev, next, width, bx, by, bestDx + 1, bestDy, blockSize),
        );
      }
      if (Math.abs(bestDy) < R) {
        fy += parabola(
          blockSad(prev, next, width, bx, by, bestDx, bestDy - 1, blockSize),
          best,
          blockSad(prev, next, width, bx, by, bestDx, bestDy + 1, blockSize),
        );
      }

      const speed = Math.hypot(fx, fy);
      residualSum += best / pxPerBlock;
      zeroSadSum += zeroSad;
      bestSadSum += best;
      if (Math.abs(bestDx) >= R || Math.abs(bestDy) >= R) saturatedCount++;
      // "Moving" requires (a) a nonzero integer displacement — sub-pixel
      // parabola offsets at d=(0,0) on fading content are refinement noise —
      // and (b) that the displacement explains at least 40% of the change;
      // fading glyphs find accidental matches that only explain ~30%.
      if (
        (bestDx !== 0 || bestDy !== 0) &&
        speed > opts.movingThreshold &&
        best < 0.6 * zeroSad
      ) {
        movingCount++;
        speeds.push(speed * scale);
      }
    }
  }

  speeds.sort((a, b) => a - b);
  const matchResidual = activeBlocks > 0 ? residualSum / activeBlocks : 0;
  return {
    blockSpeedMean: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    blockSpeedP95: speeds.length ? speeds[Math.min(speeds.length - 1, Math.floor(speeds.length * 0.95))]! : 0,
    movingFraction: activeBlocks > 0 ? movingCount / activeBlocks : 0,
    diffMean,
    changedFraction,
    matchResidual,
    nonGeometricRatio: zeroSadSum > 0 ? Math.min(1, bestSadSum / zeroSadSum) : 0,
    saturatedFraction: activeBlocks > 0 ? saturatedCount / activeBlocks : 0,
    activeBlocks,
  };
}
