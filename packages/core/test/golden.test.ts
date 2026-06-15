/**
 * Determinism golden tests: snapshot the DisplayList of every example scene
 * at fixed sample times. Catches any regression in compile/evaluate without
 * comparing pixels.
 */

import { describe, expect, it } from "vitest";
import { compileScene, evaluate, type SceneIR } from "../src/index.js";

// The byte-exact DisplayList snapshots are authored on the maintainer's machine.
// Transcendental eases (exp/pow) differ by a last ULP across CPUs/libm, so the
// snapshot is only byte-stable on the same platform family — it runs locally as
// the canonical guard, but is skipped in CI (process.env.CI). The same-machine
// round-trip determinism check below still runs everywhere. The real cross-
// machine contract (byte-identical mp4 frames) is covered by
// packages/render-cli/test/determinism.test.ts.
const IN_CI = !!process.env.CI;

import lowerThird from "../../../examples/scenes/lower-third.js";
import chartBuildup from "../../../examples/scenes/chart-buildup.js";
import kineticTypo from "../../../examples/scenes/kinetic-typo.js";
import logoReveal from "../../../examples/scenes/logo-reveal.js";
import transition from "../../../examples/scenes/transition.js";
import glyphReveal from "../../../examples/scenes/glyph-reveal.js";

const scenes: SceneIR[] = [lowerThird, chartBuildup, kineticTypo, logoReveal, transition, glyphReveal];

describe("example scenes golden snapshots", () => {
  for (const s of scenes) {
    it.skipIf(IN_CI)(`${s.id} evaluates deterministically`, () => {
      const compiled = compileScene(s);
      const duration = compiled.duration;
      expect(duration).toBeGreaterThan(0);
      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        const t = duration * frac;
        expect({ t: frac, ops: evaluate(compiled, t) }).toMatchSnapshot();
      }
    });

    it(`${s.id} round-trips through JSON`, () => {
      const compiled = compileScene(s);
      const roundTripped = compileScene(JSON.parse(JSON.stringify(s)) as SceneIR);
      expect(evaluate(roundTripped, compiled.duration / 2)).toEqual(
        evaluate(compiled, compiled.duration / 2),
      );
    });
  }
});
