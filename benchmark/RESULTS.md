# Benchmark results: reframe eDSL vs HTML+GSAP

> **Framing**: 30 runs is a directional signal with qualitative
> failure analysis — NOT a statistically significant comparison. Read the
> rationales and failure modes, not just the means.

## arm: edsl

- runs: 15
- first-attempt render success: 15/15
- eventual render success (≤2 repairs): 15/15
- mean repair rounds: 0.00
- mean judge total (/25): 20.40 (n=15)
  - fidelity: 4.07
  - layout: 4.47
  - motion: 3.80
  - polish: 4.20
  - overall: 3.87
- mean LOC: 131.53

## arm: html

- runs: 15
- first-attempt render success: 15/15
- eventual render success (≤2 repairs): 15/15
- mean repair rounds: 0.00
- mean judge total (/25): 21.47 (n=15)
  - fidelity: 4.27
  - layout: 4.53
  - motion: 4.07
  - polish: 4.53
  - overall: 4.07
- mean LOC: 128.00

## Per-run table

| task | arm | trial | render | repairs | static | judge total | overall |
|---|---|---|---|---|---|---|---|
| chart-buildup | edsl | 1 | ok | 0 |  | 17 | 3 |
| chart-buildup | edsl | 2 | ok | 0 |  | 17 | 3 |
| chart-buildup | edsl | 3 | ok | 0 |  | 23 | 4 |
| chart-buildup | html | 1 | ok | 0 |  | 24 | 5 |
| chart-buildup | html | 2 | ok | 0 |  | 25 | 5 |
| chart-buildup | html | 3 | ok | 0 |  | 22 | 4 |
| kinetic-typo | edsl | 1 | ok | 0 |  | 20 | 4 |
| kinetic-typo | edsl | 2 | ok | 0 |  | 19 | 4 |
| kinetic-typo | edsl | 3 | ok | 0 |  | 18 | 3 |
| kinetic-typo | html | 1 | ok | 0 |  | 18 | 3 |
| kinetic-typo | html | 2 | ok | 0 |  | 20 | 4 |
| kinetic-typo | html | 3 | ok | 0 |  | 21 | 4 |
| logo-reveal | edsl | 1 | ok | 0 |  | 21 | 4 |
| logo-reveal | edsl | 2 | ok | 0 |  | 20 | 4 |
| logo-reveal | edsl | 3 | ok | 0 |  | 22 | 4 |
| logo-reveal | html | 1 | ok | 0 |  | 23 | 4 |
| logo-reveal | html | 2 | ok | 0 |  | 21 | 4 |
| logo-reveal | html | 3 | ok | 0 |  | 21 | 4 |
| lower-third | edsl | 1 | ok | 0 |  | 22 | 4 |
| lower-third | edsl | 2 | ok | 0 |  | 24 | 5 |
| lower-third | edsl | 3 | ok | 0 |  | 22 | 4 |
| lower-third | html | 1 | ok | 0 |  | 24 | 5 |
| lower-third | html | 2 | ok | 0 |  | 24 | 5 |
| lower-third | html | 3 | ok | 0 |  | 23 | 4 |
| transition | edsl | 1 | ok | 0 |  | 21 | 4 |
| transition | edsl | 2 | ok | 0 |  | 20 | 4 |
| transition | edsl | 3 | ok | 0 |  | 20 | 4 |
| transition | html | 1 | ok | 0 |  | 14 | 2 |
| transition | html | 2 | ok | 0 |  | 20 | 4 |
| transition | html | 3 | ok | 0 |  | 22 | 4 |

_(4 pilot runs excluded from aggregates.)_
