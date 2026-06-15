# Goal 1 — Reference → Motion

Extract a reference `.mp4`'s timing structure (what enters when, how fast, what
easing, what rhythm) as reframe timeline IR, re-applyable to other assets — the
"make it like this video, my brand" capability.

## Anchor (extend, don't rebuild)

- `benchmark/harness/motion/analyze.ts` — `MotionProfile` (per-frame `series`,
  `summary`). **Key gap:** `segments` are externally provided (analyze.ts:201);
  auto-segmentation is the heart of this goal.
- `blockflow.ts` (`analyzePair`); `expected-motion.ts` (analytic GT = verifier
  truth); `calibrate.ts` (gates C1–C7).
- `packages/core/src/ir.ts` (`TimelineIR`, `Ease` = emission target);
  `index.ts` (export new API).

## Design decision (FIXED — do not re-pick)

Intermediate representation `MotionSketch`:

```ts
interface MotionEvent {
  t0: number; t1: number;                 // onset, settle (s)
  kind: "enter"|"exit"|"move"|"scale"|"emphasis";
  region: { x:number; y:number; w:number; h:number }; // coarse activity bbox, NOT tracked
  magnitude: number;                      // displacement/scale delta, normalized
  easing: { class:string; thirdsRatio:number|null; reliable:boolean };
}
interface MotionSketch {
  duration:number; fps:number; events:MotionEvent[];
  rhythm:{ periodicityHz:number|null; beatCount:number };
}
```

1. **Region-anchored coarse bbox, NOT track-anchored.** Verifier is a
   same-scene round-trip (needs timing+easing, not object identity); the
   profiler is frame-pair block matching, not a tracker; a coarse region still
   separates concurrent spatially-distinct events. Tracking is deferred.
2. **Reuse the existing 3-signal decomposition; add exactly ONE new signed
   proxy** (no new vision; all gates calibrated vs `expected-motion.ts`):
   - translation → existing "moving" gate verbatim (integer displacement ≥1px
     AND best < 0.6×zeroSad).
   - appearance/scale → existing `nonGeometricRatio` above its threshold.
   - enter vs exit → NEW per-region **occupancy** (edge density / luma variance)
     SIGN: rising=enter, falling=exit. Sign only.
   - scale vs emphasis → persist-to-window-end vs return-to-baseline (reuse
     local-extremum logic).
   The occupancy sign is the ONLY new gate.
3. **Auto-segment by thresholding the activity signal vs the existing static
   floor with hysteresis; feed the UNCHANGED easing classifier** (only its
   input changes from hand-provided to detected). Hysteresis is a calibration
   gate vs `expected-motion.ts`.

## Deliverable

1. `extractMotionSketch(profile) → MotionSketch` — auto-segment, classify
   kind+easing, detect rhythm from `diffPeriodicityHz`.
2. `sketchToTimeline(sketch, nodeIds) → TimelineIR` — staggered tweens w/
   duration+ease reproducing the timing.
3. CLI: `reframe trace <ref.mp4>` prints the sketch; `--apply <scene.ts>`
   emits a timeline overlay.

## Verifier (self-contained round-trip)

```
scene A → render → ref.mp4 → extractMotionSketch → sketch
sketch + A's nodeIds → sketchToTimeline → timeline'
scene A w/ timeline' → render → rebuilt.mp4
profile(ref) vs profile(rebuilt)  within C1–C7 tolerance
```

Test `benchmark/harness/motion/trace.test.ts` on 4 analytic scenes (GT from
`expected-motion.ts`): pure enter/stagger, scale emphasis, periodic hold, two
spatially-separated concurrent enters.

## Done-when

- Onset error ≤1 frame, event count+kind exact on all 4.
- enter/exit sign correct; concurrent events stay separate (not merged).
- Easing class matches GT on `reliable` segments.
- Round-trip summary within `calibrate.ts` tolerances (occupancy-sign the only
  new gate, must pass vs `expected-motion.ts`).
- `pnpm test` + `pnpm typecheck` green; API exported from `index.ts`;
  determinism unaffected.

## Out-of-scope (v1)

- Per-object tracking; color/effect extraction; mapping onto a structurally
  different node set (goal-2); changing existing calibration thresholds.
