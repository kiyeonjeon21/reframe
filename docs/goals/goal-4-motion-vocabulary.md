# Goal 4 — Motion vocabulary (named, seeded, editable presets)

## Objective

Make motion **requestable without canning it.** Today a logo sting has one
hard-coded motion; a human can't say what they want (motion is recall-hard,
recognition-easy) and free-form generation is unspecifiable. The fix is a small
set of **named motion presets** — but each preset is a *seeded generator*, not a
frozen template, so the same name yields a family of distinct motions, never a
clone. Then expose the **edit points in the preview** (waypoint handles, timing)
so the last 20% is nudged by hand and survives regeneration.

This resolves the two-determinisms tension explicitly: **reproducibility**
(same seed → byte-identical, the thesis moat) is kept; **canned sameness** (the
real fear) is killed by seeded variation, and *the motion profiler proves it*.

Builds on goal-2 beats (the addressable retimable unit) and the `motionPath` /
vector `path` primitives (already landed).

## Anchor (extend, do not rebuild)

- `packages/core/src/dsl.ts` — presets compose existing factories (`motionPath`,
  `beat`, `path`, `tween`, `stagger`, the back/elastic/bounce eases). No new IR.
- `packages/core/src/presets.ts` — **new** module: `motionPreset(name, opts)`.
- `packages/core/src/behaviors.ts` — reuse the seeded value-noise behind
  `wiggle` for the deterministic PRNG (no `Math.random`, ever).
- `benchmark/harness/motion/` — the calibrated profiler is the **verifier**: it
  quantifies "are two motions different / still the same family / does energy↑
  raise overshoot."
- `packages/preview/` + `packages/core/src/compose.ts` — overlay can already
  patch node props and beat timing (`at`/`gap`/`scale`/`order`); add patching a
  `motionPath` step's `points` and draggable waypoint handles.
- `examples/logo-sting/` — re-author the sting to `motionPreset("reveal-orbit", …)`
  and let `generate.mts` take `--motion <name> [--energy h] [--seed n]`.

## Design decision (human — approve before building)

**1. A preset is a SEEDED GENERATOR, not a template.**
```ts
motionPreset("rise-settle", {
  target: "logo",           // the group/node id it drives
  energy: 0.7,              // 0..1  universal — settle ↔ springy overshoot
  speed: 1.0,              // universal — duration multiplier
  intensity: 0.5,          // signature knob (per preset: distance/orbitSize/spins…)
  from: "left",            // optional spatial knob where it applies
  seed: 3,                 // deterministic variation
}) // → TimelineIR (a beat)
```
The seed drives a deterministic PRNG that perturbs waypoints / micro-timing /
accents **within bounded ranges**. Same `(name,knobs,seed)` → identical IR
(reproducible). Different `seed` → measurably different motion that is still
recognizably the same preset family. This is the load-bearing decision: it is
*what makes presets not-canned*, and the verifier checks it directly.

**2. Universal 2-knob + signature-1-knob model (the shared language).**
Every preset takes `energy` + `speed` (universal) + ≤2 preset-specific knobs +
`seed`. Fixed knob→IR mapping (an approved table, calibration-gated):
- `energy` → ease selection (`easeInOutQuad → easeOutBack → easeOutElastic`) +
  overshoot magnitude.
- `speed` → beat time-scale (multiply offsets+durations, via goal-2 `scale`).
- signature knob → the preset's amplitude (orbit radius / rise distance / spins
  / scatter), in normalized 0..1 mapped to a fixed range.

**3. A preset emits a BEAT.** Reuses goal-2: the preset's steps are wrapped in
`beat(name, …)`, so the whole motion is one addressable, retimable unit and the
overlay/regen moat applies for free. `beat(name,{},…) ≡ seq` keeps it additive.

**4. Edit points = two layers, both on stable addresses.**
- **Knobs are base-regeneration inputs**, not overlay patches: changing `energy`
  in the preview re-runs the generator → new base IR (a "soft regen").
- **Hand nudges are overlay patches** that survive that regen: a dragged
  `motionPath` waypoint writes `timeline.<label>.points[i]`; beat timing writes
  `timeline.<beat>.{at,gap,scale}`. Both address stable labels, so a knob-driven
  base regen does not discard them. This is the thesis on a plate: knobs
  regenerate, hand-craft persists.

**v1 preset set (6):** `draw-bloom`, `punch-in`, `rise-settle`, `slide-bank`,
`reveal-orbit`, `spin-forge`. (`assemble` needs a multi-path rig and
`drift-cinematic` is a hold-layer — phase 2.)

## Verifier (self-checking)

> **Implementation note (verifier refinement).** The anti-canning / monotonicity
> gates are measured at the `evaluate()` **trajectory level** (sample the target
> group's transform over time via an always-visible probe child) rather than by
> rendering and profiling 48 mp4s. Same property — motion quantified, distinct
> yet same-family, energy↑→overshoot↑ — at a fraction of the cost, and pure/fast
> in `packages/core/test/presets.test.ts`. Calibrated band: `[D_lo, D_hi] =
> [0.003, 0.25]` (normalised RMS position distance / scene diagonal); measured
> spread on reveal-orbit/slide-bank/rise-settle is ~0.0045–0.084, comfortably
> inside it.


- **Reproducibility:** render `(preset,knobs,seed)` twice → byte-identical mp4
  (extend `determinism.test.ts`).
- **Anti-canning (headline):** for each preset, render seeds 1..8, profile each
  with the motion profiler, compute pairwise profile distance → assert it sits
  in an approved band `[D_lo, D_hi]`: `> D_lo` (genuinely different, not a
  clone) AND `< D_hi` (still the same family, not chaos).
- **Knob monotonicity:** `energy` ↑ → measured overshoot (extremum past target)
  ↑; `speed` ↑ → beat duration ↓. Calibration-gate style against the profiler.
- **Additivity:** every existing golden byte-identical; `beat(name,{},…) ≡ seq`.
- **Edit survival:** apply a preset, overlay-edit one waypoint + nudge beat
  timing, then change a knob (base regen via the generator) → both hand edits
  still apply at their addresses (regen-contract harness).
- **Preview:** `window.__store` exposes each `motionPath`'s waypoints and the
  preset beat's timing as editable; the emitted overlay patch addresses resolve.

## Done-when (numeric pass criteria)

1. 6 v1 presets implemented; each emits a `beat`.
2. Same `(name,knobs,seed)` → byte-identical render twice.
3. For ≥2 presets, 8-seed pairwise profile distances all within `[D_lo, D_hi]`
   (distinct AND same-family) — the anti-canning gate green.
4. `energy` and `speed` monotonic on the profiler for ≥2 presets.
5. All existing goldens byte-identical; `beat(name,{},…) ≡ seq` golden holds.
6. Waypoint + beat-timing overlay edits survive a knob-driven base regen.
7. Preview shows draggable waypoint handles + emits resolving overlay patches.
8. `logo-sting` re-authored onto a preset; `generate.mts --motion <name>` works
   on react/figma/vercel. `pnpm test` + `pnpm typecheck` green.

## Out-of-scope

- **NL → preset selection** (the LLM picks `{preset,knobs,seed}` from a prompt):
  that is the skill/prompt layer, trivial once this engine exists and not
  unit-verifiable here. The engine is *designed* for it (the AI emits structured
  params).
- New easing math; `assemble` / `drift-cinematic`; a full timeline GUI rebuild;
  per-logo automatic motion tailoring beyond the knobs; changing goal-2/non-preset
  compilation.
