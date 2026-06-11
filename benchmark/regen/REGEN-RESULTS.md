# Regeneration-contract compliance results

> 8 real AI regenerations, contract text verbatim, no measurement
> hints. Directional (n=8); see REGEN-ANALYSIS.md for the reading.

## Aggregates

- validate+render pass: 8/8
- integrityOk (runtime contract): 8/8
- mean node id recall: 100%
- mean state name recall: 100%
- mean timeline label recall: 100%

## Per-run table

| run | difficulty | validate | render | node recall | state recall | label recall | lost (unexpected) | typeChanged | probe orphans |
|---|---|---|---|---|---|---|---|---|---|
| lr-t1 | easy/restyle | ok | ok | 100% | 100% | 100% | — | — | none |
| lr-t2 | medium/re-choreograph | ok | ok | 100% | 100% | 100% | — | — | none |
| lr-t3 | hard/overhaul | ok | ok | 100% | 100% | 100% | — | — | none |
| lr-t4 | trap/add-remove-retype | ok | ok | 100% | 100% | 100% | — | disc(ellipse→rect) | removedNode:1 |
| lt-t1 | easy/restyle | ok | ok | 100% | 100% | 100% | — | — | none |
| lt-t2 | medium/re-choreograph | ok | ok | 100% | 100% | 100% | — | — | none |
| lt-t3 | hard/overhaul | ok | ok | 100% | 100% | 100% | — | — | none |
| lt-t4 | trap/add-remove-retype | ok | ok | 100% | 100% | 100% | — | bar(rect→line) | removedNode:1 typeChange:3 |
