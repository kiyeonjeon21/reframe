# Regeneration-contract compliance experiment

Measures whether real AI agents keep node ids / state names / timeline labels
stable when regenerating a scene, given only the contract text in
`docs/regen-contract.md` (verbatim — its practicality is what's under test).

## Matrix

2 base scenes (logo-reveal, lower-third — literal ids only; code-implicit ids
like `bar-${i}` are a confound, deferred) × 4 difficulty briefs × 1 trial = 8
generations. Difficulties: T1 restyle (easy, expect 100%), T2 re-choreograph
(state-rename temptation is the key probe), T3 layout overhaul (hard), T4
add/remove/retype (trap: a briefed removal SHOULD orphan; a concept-surviving
type change — disc ellipse→rect, bar rect→line — should keep its id).

## Generation prompt (per run, fresh-context subagent)

1. The contract blockquote from docs/regen-contract.md, verbatim.
2. The format guide docs/guides/edsl-guide.md, in full.
3. The current scene source (examples/scenes/<base>.ts), in full.
4. The redesign brief (briefs/<taskId>.md).
5. Output instruction: write exactly one file runs/<taskId>-1/attempt-0/scene.ts.

Subagents are NOT told about the probe or any measurement — the experiment
measures whether the contract text alone steers behavior.

## Measurement

`tsx benchmark/regen/harness/measure.ts <runDir>` — set-based recall (A),
probe-overlay composition with orphan classification (B; A and B cross-check
each other), validate/render/static gates (C). Calibrated against the
known-violation fixture examples/scenes/logo-reveal-regen.ts (expected:
recall 0.80, one renamedNode orphan, integrityOk).

`tsx benchmark/regen/harness/summarize.ts` → REGEN-RESULTS.md.
Qualitative reading + manual concept-drift spot-check → REGEN-ANALYSIS.md.

## Pass criteria

- Runtime contract: integrityOk 8/8 (anything less is a compose bug).
- Prompt contract: T1 recall 100%; T1+T2 node ≥95% / state ≥90%; T3+T4 ≥80%
  with the T4 concept-surviving-type-change ids kept 2/2; validate+render ≥7/8.
- Shortfall ⇒ not "experiment failed" but contract-hardening directions
  (explicit id manifest in the prompt, post-regen id-diff lint), argued from
  the orphan-kind distribution.
