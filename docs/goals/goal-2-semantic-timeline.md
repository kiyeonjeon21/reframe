# Goal 2 — Semantic timeline (Beats over the frame-level timeline)

## Objective

Raise the timeline from frame-level steps to **semantic beats** — "brand
reveal", "product appears", "feature cards cascade", "CTA emphasis" — so that
both human revision and AI regeneration operate on meaningful units instead of
raw tweens. This is the conceptual keystone: it is the unit goal-1's extracted
sketch maps onto, and the unit goal-driven revisions ("make beat 3 faster")
address.

## Anchor (extend, do not rebuild)

- `packages/core/src/ir.ts` — `TimelineIR` union; add the Beat concept here.
- `packages/core/src/compile.ts` — `labelTimes: Map<string, LabelSpan>` and the
  `walk`/`walkInner` traversal. Beats extend this addressing, not replace it.
- `packages/core/src/dsl.ts` — add the `beat()` factory next to seq/par/stagger.
- `packages/core/src/compose.ts` — overlay timeline patches currently target
  `label`s. Beat-level patches (retime/reorder a whole beat) extend this.
- `packages/preview/` — the editor's timeline view groups by beat.

## Design decision (human — approve before building)

What exactly is a Beat? Proposed (review/adjust):

```ts
// a Beat is a named, retimable, reorderable span that wraps timeline steps
beat("feature-cascade", { at?: number, gap?: number }, [
  stagger(0.1, ...cards.map(c => to(`${c}-in`, { duration: 0.5 }))),
])
```

**Decisions (v1) — made; each rationale IS the constraint it enforces:**

1. **Container, NOT annotation.** A Beat is a `TimelineIR` node that wraps
   steps — structurally a *named group*. Rationale: reorder/retime are natural
   on a subtree (move/transform the node) and painful as metadata over a flat
   timeline (you'd splice PropertySegments). The beat's `name` is a stable
   address that reuses the exact label-addressing the overlay moat already
   depends on — `beatTimes` is just the subset of label spans that came from
   beat nodes, so no new addressing machinery. Authoring beats is opt-in;
   value accrues only to scenes that adopt them.

2. **Rigid translation + proportional time-stretch; NEVER elastic re-flow.**
   The verifier itself forces this: "move the beat +1.0s → the child step's
   absolute time shifts by exactly +1.0s" is only true if the beat is a rigid
   block whose interior keeps relative offsets. Beat ops are: `at`/`gap` →
   rigid translation of the whole span; `scale`/`duration` → multiply every
   child offset AND duration by one factor (preserves interior rhythm); `order`
   → reorder beats within their parent seq. All three preserve relative
   interior structure, which is *exactly why* sub-beat overlay edits survive: a
   child edit addresses a label whose position-within-beat is unchanged — only
   the beat origin moved. Elastic re-flow would re-choreograph the interior,
   destroying authored timing and every sub-beat edit. Wrong.

3. **Additive by lowering.** Before timing, a beat lowers to its grouping
   (`seq` by default, `par` if `parallel: true`); beat opts then apply as
   transforms on the lowered span. So `beat(name, {}, children)` is
   byte-identical to `seq(children)`, and a scene with no beats compiles
   exactly as today — the easing/segment/PropertySegment machinery is never
   touched. Enforce with a golden test asserting `beat(name, {}, [...]) ≡
   seq([...])`.

## Deliverable

1. `beat(name, opts, children)` DSL factory + `BeatIR` in the timeline union.
2. `compile.ts`: beats produce `beatTimes: Map<string, LabelSpan>` alongside
   `labelTimes`; child labels resolve relative to their beat.
3. `compose.ts`: overlay can patch a beat (`timeline.<beat>.at`,
   `.gap`, `.order`) and child label edits survive a beat move.
4. Preview: timeline strip renders beats as collapsible groups; the
   `window.__store` debug hook exposes beat structure.

## Verifier

- **Additivity**: re-run `pnpm test` — every existing golden snapshot
  unchanged (beats are opt-in; a scene with no beats compiles identically).
- **Beat retime survival**: take a scene with a beat containing a labeled step
  + an overlay editing that step's color; move the beat +1.0s via overlay;
  assert (a) the step's color edit still applies, (b) the step's absolute time
  shifted by exactly +1.0s. Extend `packages/render-cli/scripts/verify-editor.ts`
  or add a core test.
- **Reorder**: swap two beats via overlay `order`; assert child label times
  recompute and no edit is dropped (orphan report empty).

## Done-when

- All existing goldens byte-identical (additivity proven).
- Beat retime: child overlay edit survives, time shift exact (test asserts both).
- `pnpm test` + `pnpm typecheck` green; preview shows beat grouping.
- One example scene converted to beats (e.g. `examples/scenes/reframe-demo.ts`
  chapters become beats) renders byte-identically to its pre-beat output.

## Out-of-scope

- Auto-naming beats from content (that is an LLM-authoring concern, not core).
- Inter-element dependency edges (the full "motion graph" — separate later goal).
- Changing how non-beat timelines compile.
