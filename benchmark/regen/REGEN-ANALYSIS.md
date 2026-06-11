# Regeneration-contract compliance — qualitative reading

> Companion to the auto-generated REGEN-RESULTS.md. 8 real AI regenerations
> (2 base scenes × 4 difficulty briefs, fresh-context agents, contract text
> verbatim, no measurement hints). n=8 — directional.

## Headline

**The one-paragraph contract was sufficient: 100% recall on node ids, state
names, and timeline labels across every difficulty tier, including the traps.**
All pass criteria were exceeded (target was ≥80% on hard/trap tiers; measured
100%). 8/8 regenerations validated and rendered first-attempt; the runtime
integrity guarantee held 8/8 (every probed address surfaced as applied or
orphaned — zero silent drops, zero compose throws).

## The traps behaved exactly as the contract intends

- **Briefed removals orphaned correctly**: lr-t4 removed `tagline`, lt-t4
  removed `role` as instructed — both surfaced as `removedNode` orphans in the
  probe, which is the desired behavior (a deleted concept's edits *should*
  orphan, loudly).
- **Concept-surviving type changes kept their ids, 2/2**: lr-t4's `disc`
  became a rounded-square badge (ellipse→rect) and lt-t4's `bar` became a
  stroked line (rect→line) — both kept their ids, and the probe's
  type-detector props flagged the changes as `typeChange` orphans rather than
  losing the whole node. lt-t4's extra typeChange counts come from state
  probes touching now-invalid props (`height` on a line) — correctly skipped
  per-prop while `opacity` edits on the same node still applied.
- **New elements got new ids everywhere** (bg-ring/bg-rule in lr-t3,
  handle/dot-left/dot-right in lt-t4): no id was recycled onto a different
  concept. Manual spot-check found zero false positives.

## Why this might be easier than it looks (honest caveats)

1. **Single-shot, small scenes, literal ids.** 4–5 nodes with semantic names
   (`disc`, `bar`) make keeping ids the path of least resistance. The deferred
   hard case is code-implicit ids (`bar-${i}` loops) and long multi-turn
   editing sessions where drift accumulates.
2. **The contract sat adjacent to the source.** In a real product the contract
   would live in a system prompt far from the scene; attention dilution
   untested.
3. **Same model family generated and complied.** A weaker or different model
   may need the hardening fallbacks (id manifest in the prompt, post-regen
   id-diff lint) — which the orphan report already makes cheap to build.

## Addendum: code-implicit ids (the deferred hard case)

The original experiment used only literal ids and deferred loop-generated ids
(`bar-${i}`) as a confound. Three follow-up runs on chart-buildup closed that
gap (cb-t1/t2/t3 in the results table): **3/3 first-attempt renders, 100%
node/state/label recall.**

- **Restyle** (cb-t1): trivially clean.
- **Layout transposition** (cb-t2, vertical→horizontal bars with new
  choreography): the model kept the `.map()` structure and the `bar-${i}`
  scheme; new decorations (grid/tick lines) got new ids.
- **Data-count trap** (cb-t3, 5 daily bars → 4 quarterly bars): exactly the
  contract-correct outcome — `bar-4`/`value-4`/`label-4` disappeared (matching
  `expectedRemoved`), surviving indices kept their ids while their content
  changed from weekdays to quarters.

The feared failure mode (rewriting the loop with a new id scheme like
`bar-q1`) did not occur. Caveat unchanged: still single-shot; multi-turn
drift remains untested.

## What this buys the thesis

The edit-survival story no longer rests on a hand-written regeneration: a
real agent, told once, kept every stable address while completely redesigning
layout, choreography, and even node types. Combined with the Phase 2 result
(orphans are always loud), the failure mode hierarchy is now:

1. Contract followed (measured: the common case) → edits survive.
2. Contract broken → edits orphan with a diagnosis naming the likely rename.
3. Never: silent edit loss or a render failure caused by base drift.
