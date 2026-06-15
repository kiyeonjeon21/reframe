# Goal 1.5 — Harden Reference→Motion for real video

Goal-1's extractor is 7/7 on clean analytic scenes but breaks on a real product
video (Notion sample, 60fps, white UI). Headline failure: continuous ambient
activity (cursor, typing, micro-animation) never returns to a static floor, so
the spatio-temporal connected-components merged an 11-SECOND full-frame "enter"
([3.18,14.47]). Also: thresholds tuned for high-contrast-on-dark mis-fire on a
light low-contrast UI, and periodicity reads a spurious 5Hz. The manifesto's
first promise is "upload a reference video → extract motion structure", so this
must hold on real footage, not just authored scenes.

## Anchor (extend, don't rebuild)

- `benchmark/harness/motion/sketch.ts` — extractMotionSketch (segmentation,
  grouping, classification). The fixes live here.
- `benchmark/harness/motion/trace.ts` — add real-video gates alongside the
  analytic ones.
- `benchmark/harness/motion/grid.ts`, `analyze.ts` — the signals are fine;
  don't change the calibrated `analyzePair`/C1–C7.

## Design decisions (FIXED — do not re-pick)

1. **Discrete vs continuous regime.** An event whose duration exceeds
   `CONTINUOUS_FRAC × clipDuration` (start 0.35) is CONTINUOUS activity, not a
   discrete event — exclude it from `events` (it is noise filtering, not silent
   edit loss). This alone kills the 11s merge. Real discrete entrances/
   transitions are short fractions of a clip; an 11s/17s=0.65 span is
   definitionally ambient. Don't split it into fake sub-events.
2. **Background-relative activity thresholds.** Replace the fixed HI/LO=1.5/0.8
   (8-bit) with thresholds derived from the clip's OWN cellDiff distribution
   (e.g. noise floor = a low percentile, HI = floor + k·spread), floored by a
   small absolute so a truly static clip stays empty. This transfers across
   contrast/background. MUST keep the analytic scenes at HI≈their current
   behaviour (they still pass 7/7).
3. **Real video in the verifier — structural sanity, not accuracy.** The Notion
   ref has no ground truth (not authored), so its gates assert ROBUSTNESS (no
   absurd event, sane count, no full-clip merge), while the 4 analytic scenes
   remain the ACCURACY gates (onset/kind/separation). The ref gate runs only
   when `refs/notion-sample.mov` is present (it is gitignored, 10MB); skip
   loudly when absent so CI still runs the analytic gates.

## Deliverable

1. `sketch.ts`: continuous-event exclusion (decision 1) + background-relative
   thresholds (decision 2). Keep the existing kind/occupancy/easing logic.
2. `trace.ts`: real-video gates against `refs/notion-sample.mov` (`--fps 60`):
   - no event longer than `CONTINUOUS_FRAC × duration` (the 11s bug is gone);
   - no single event spans the busy 3–14s region;
   - event count in a sane band (e.g. 3..40), not 1 giant nor fragmented.
   Conditional on the ref existing.

## Verifier

- `tsx benchmark/harness/motion/trace.ts` — the 7 analytic gates STILL pass
  (no regression), plus the new ref gates pass when the mov is present.
- Manual sanity: `pnpm reframe trace refs/notion-sample.mov --fps 60` no longer
  emits the 11s full-frame event; the opening transition still reads as
  enter/exit.

## Done-when

- Analytic gates: still 7/7 (onset 0-frame err, kinds, separation, periodicity).
- C1–C7 calibration still 7/7 (profiler untouched).
- Ref gates pass: longest event ≤ `CONTINUOUS_FRAC × duration`, count in band,
  no full-clip merge.
- `pnpm test` + `pnpm typecheck` green; determinism unaffected.

## Out-of-scope (v1.5)

- Scene-transition vs element-enter as distinct kinds (region area already
  distinguishes them; defer a `transition` kind).
- Per-object tracking; accuracy GT for real video (no source available).
- Changing the calibrated profiler or its C1–C7 thresholds.
