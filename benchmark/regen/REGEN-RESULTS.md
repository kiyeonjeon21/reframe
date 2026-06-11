# Regeneration-contract compliance results

> 11 real AI regenerations, contract text verbatim, no measurement
> hints. Directional (n=11); see REGEN-ANALYSIS.md for the reading.

## Aggregates

- validate+render pass: 11/11
- integrityOk (runtime contract): 11/11
- mean node id recall: 100%
- mean state name recall: 100%
- mean timeline label recall: 100%

## Per-run table

| run | difficulty | validate | render | node recall | state recall | label recall | lost (unexpected) | typeChanged | probe orphans |
|---|---|---|---|---|---|---|---|---|---|
| cb-t1 | easy/restyle (implicit ids) | ok | ok | 100% | 100% | 100% | — | — | none |
| cb-t2 | hard/overhaul (implicit ids) | ok | ok | 100% | 100% | 100% | — | — | none |
| cb-t3 | trap/data-count-change (implicit ids) | ok | ok | 100% | 100% | 100% | — | — | removedNode:3 |
| lr-t1 | easy/restyle | ok | ok | 100% | 100% | 100% | — | — | none |
| lr-t2 | medium/re-choreograph | ok | ok | 100% | 100% | 100% | — | — | none |
| lr-t3 | hard/overhaul | ok | ok | 100% | 100% | 100% | — | — | none |
| lr-t4 | trap/add-remove-retype | ok | ok | 100% | 100% | 100% | — | disc(ellipse→rect) | removedNode:1 |
| lt-t1 | easy/restyle | ok | ok | 100% | 100% | 100% | — | — | none |
| lt-t2 | medium/re-choreograph | ok | ok | 100% | 100% | 100% | — | — | none |
| lt-t3 | hard/overhaul | ok | ok | 100% | 100% | 100% | — | — | none |
| lt-t4 | trap/add-remove-retype | ok | ok | 100% | 100% | 100% | — | bar(rect→line) | removedNode:1 typeChange:3 |
