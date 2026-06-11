/**
 * Named parametric behaviors (Fran-style continuous-time functions).
 * Composed additively on top of the timeline value. All deterministic:
 * randomness comes from an explicit seed, never Math.random.
 */

import type { BehaviorIR } from "./ir.js";

export function sampleBehavior(b: BehaviorIR["behavior"], t: number): number {
  switch (b.name) {
    case "oscillate": {
      const { amplitude, frequency, phase = 0 } = b.params;
      return amplitude * Math.sin(2 * Math.PI * frequency * t + phase);
    }
    case "wiggle": {
      const { amplitude, frequency, seed } = b.params;
      return amplitude * valueNoise(t * frequency, seed);
    }
  }
}

/** Smooth value noise in [-1, 1] from a deterministic integer-lattice hash. */
function valueNoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f); // smoothstep
  const a = hash01(i, seed) * 2 - 1;
  const b = hash01(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

function hash01(n: number, seed: number): number {
  let h = (n * 374761393 + seed * 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}
