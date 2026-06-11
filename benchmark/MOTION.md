# Motion profiles — calibrated block-matching sweep

> Analyzer calibrated against analytic IR ground truth (7/7 gates,
> `harness/motion/calibration/calibration.json`). All speeds in full-res
> px/frame @30fps. 43 clips.

## Arm aggregates (main benchmark, 30 runs)

| metric | eDSL | HTML |
|---|---|---|
| mean speed (moving) | 14.7 | 16.0 |
| peak speed (p95) | 57.2 | 62.3 |
| exit peak speed (last 15%) | 35.3 | 48.6 |
| exit saturation rate | 0.05 | 0.14 |
| discontinuity spikes / clip | 0.00 | 0.00 |
| static fraction | 0.62 | 0.61 |

## Claim check 1 — "fast exits fall between filmstrip tiles"

Mean exit-peak speed: **41.9 px/frame**; the exit motion burst
(trailing pairs moving >10 px/frame) lasts **4.8 frames on
average** — shorter than the ~15-frame gap between the original uniform
filmstrip tiles, so a typical exit started and finished between two tiles.
Quantitative confirmation of the judges' structural blind spot. Clips whose
exit even saturated the ±48 px/frame tracker: 17/30.

## Claim check 2 — "imperceptible micro-pulse during holds"

| run | hold periodicity | static fraction |
|---|---|---|
| kinetic-typo-edsl-t1 | none | 14% |
| kinetic-typo-edsl-t2 | none | 32% |
| kinetic-typo-edsl-t3 | none | 19% |
| kinetic-typo-html-t1 | none | 25% |
| kinetic-typo-html-t2 | none | 26% |
| kinetic-typo-html-t3 | none | 23% |
| logo-reveal-edsl-t1 | none | 72% |
| logo-reveal-edsl-t2 | none | 69% |
| logo-reveal-edsl-t3 | none | 68% |
| logo-reveal-html-t1 | none | 72% |
| logo-reveal-html-t2 | none | 67% |
| logo-reveal-html-t3 | none | 67% |

Briefs asked for a continuous pulse/float during holds. A detected periodicity
with low static fraction = the pulse exists and moves pixels; "none" with a
high static fraction = the hold is genuinely frozen (what judges suspected
but could not quantify from tiles).

## Per-run table

| group | run | arm | mean speed | peak | spikes | static% | periodicity |
|---|---|---|---|---|---|---|---|
| benchmark | chart-buildup-edsl-t1 | edsl | 19.3 | 48 | 0 | 70 | — |
| benchmark | chart-buildup-edsl-t2 | edsl | 19.1 | 48 | 0 | 71 | — |
| benchmark | chart-buildup-edsl-t3 | edsl | 18.1 | 48 | 0 | 67 | — |
| benchmark | chart-buildup-html-t1 | html | 18.4 | 62 | 0 | 65 | — |
| benchmark | chart-buildup-html-t2 | html | 19.3 | 49 | 0 | 70 | — |
| benchmark | chart-buildup-html-t3 | html | 19.7 | 54 | 0 | 68 | — |
| benchmark | kinetic-typo-edsl-t1 | edsl | 10.9 | 68 | 0 | 14 | — |
| benchmark | kinetic-typo-edsl-t2 | edsl | 12.8 | 68 | 0 | 32 | — |
| benchmark | kinetic-typo-edsl-t3 | edsl | 13.1 | 68 | 0 | 19 | — |
| benchmark | kinetic-typo-html-t1 | html | 11.5 | 68 | 0 | 25 | — |
| benchmark | kinetic-typo-html-t2 | html | 17.8 | 68 | 0 | 26 | — |
| benchmark | kinetic-typo-html-t3 | html | 13.4 | 68 | 0 | 23 | — |
| benchmark | logo-reveal-edsl-t1 | edsl | 9.9 | 68 | 0 | 72 | — |
| benchmark | logo-reveal-edsl-t2 | edsl | 7.9 | 68 | 0 | 69 | — |
| benchmark | logo-reveal-edsl-t3 | edsl | 6.1 | 20 | 0 | 68 | — |
| benchmark | logo-reveal-html-t1 | html | 12.5 | 68 | 0 | 72 | — |
| benchmark | logo-reveal-html-t2 | html | 12.0 | 68 | 0 | 67 | — |
| benchmark | logo-reveal-html-t3 | html | 10.6 | 68 | 0 | 67 | — |
| benchmark | lower-third-edsl-t1 | edsl | 7.0 | 68 | 0 | 84 | — |
| benchmark | lower-third-edsl-t2 | edsl | 8.4 | 48 | 0 | 85 | — |
| benchmark | lower-third-edsl-t3 | edsl | 10.5 | 68 | 0 | 84 | — |
| benchmark | lower-third-html-t1 | html | 12.8 | 58 | 0 | 81 | — |
| benchmark | lower-third-html-t2 | html | 10.1 | 54 | 0 | 81 | — |
| benchmark | lower-third-html-t3 | html | 10.6 | 46 | 0 | 81 | — |
| benchmark | pilot-lower-third-edsl-t1 | edsl | 10.3 | 68 | 0 | 83 | — |
| benchmark | pilot-lower-third-html-t1 | html | 9.2 | 65 | 0 | 81 | — |
| benchmark | transition-edsl-t1 | edsl | 21.2 | 60 | 0 | 67 | — |
| benchmark | transition-edsl-t2 | edsl | 26.7 | 54 | 0 | 66 | — |
| benchmark | transition-edsl-t3 | edsl | 29.3 | 58 | 0 | 66 | — |
| benchmark | transition-html-t1 | html | 21.7 | 68 | 0 | 66 | — |
| benchmark | transition-html-t2 | html | 27.1 | 68 | 0 | 61 | — |
| benchmark | transition-html-t3 | html | 22.8 | 68 | 0 | 62 | — |
| benchmark-v2 | chart-buildup-edsl-t1 | edsl | 15.0 | 51 | 0 | 65 | — |
| benchmark-v2 | chart-buildup-edsl-t2 | edsl | 16.0 | 48 | 0 | 64 | — |
| benchmark-v2 | chart-buildup-edsl-t3 | edsl | 14.9 | 68 | 0 | 65 | — |
| regen | lr-t1-1 | regen | 14.5 | 60 | 0 | 70 | — |
| regen | lr-t2-1 | regen | 20.5 | 68 | 0 | 64 | — |
| regen | lr-t3-1 | regen | 11.0 | 68 | 0 | 83 | — |
| regen | lr-t4-1 | regen | 20.6 | 68 | 0 | 75 | — |
| regen | lt-t1-1 | regen | 13.4 | 68 | 0 | 86 | — |
| regen | lt-t2-1 | regen | 10.5 | 58 | 0 | 90 | — |
| regen | lt-t3-1 | regen | 39.0 | 68 | 0 | 95 | — |
| regen | lt-t4-1 | regen | 12.6 | 49 | 0 | 97 | — |
