# Goal 5 — Motion ops library + add-motion in the editor

## Objective

reframe can move/style a node via tweens / motionPath / behaviors, and has a
logo-specific `motionPreset` vocabulary, but there's no **named library of the
everyday motion ops** (rotate, zoom, ken-burns, slide, fade, draw-on, pulse)
that apply to **any** node (text, logo paths, shapes), and **no way to ADD
motion to a node in the preview** — the overlay only *patches existing* labeled
steps. Bring a GSAP-style op toolkit that is authorable in code AND
addable/editable in the editor, folding back to code. Builds on `motionPreset`,
the tween/motionPath/behavior primitives, and the preview editing loop.

## The load-bearing change

The overlay today can only patch motion that already exists, plus `addNodes`.
To "add a ken-burns to this logo" or "add a rotate to this text" from the
editor, the overlay needs to **ADD timeline steps**, not just patch them. So the
keystone is a new overlay verb `addTimeline` (mirrors `addNodes`).

## Anchor (extend, don't rebuild)

- `packages/core/src/presets.ts` → sibling `motionOps.ts`: `motionOp(name,
  target, opts)` over the existing dsl factories (no new IR).
- `packages/core/src/dsl.ts` — the `tween`/`to`/`motionPath`/`oscillate`/`wiggle`
  it composes; `compose.ts` — the new `addTimeline` overlay verb + `OverlayDoc`.
- `packages/preview/{main.ts,panel.ts}` — an "add motion ▸ <op>" affordance on
  the selected node, per-op knobs, and the Tier-1 trail as a preview.
- `examples/{logo-sting,scenes}` — ops on a logo (rotate/zoom/ken-burns) and on
  text (fade/slide-in).

## Decisions (fixed — do not re-pick)

1. **A motion op is a parameterized fragment over existing primitives, not new
   IR.** `motionOp(name, target, opts) → { setup?, timeline }` emitting
   tween/motionPath/behavior wrapped in a labeled `beat`. Op set: `rotate`,
   `zoom` (scale pop), `ken-burns` (slow scale + drift), `slide-in` (from a
   direction), `fade`, `draw-on` (path progress), `pulse` (oscillate). Targets
   **any** node by id; `energy`/`speed`/`amount` knobs like presets.
2. **Adding motion in the editor = a new overlay verb `addTimeline:
   TimelineIR[]`** that appends fragments to the scene timeline (mirroring
   `addNodes`), composed in `par` with the base under stable beat labels so the
   added op is then patchable AND foldable. `composeScene` appends + validates +
   reports orphans if the target id is gone.
3. **Additive + determinism-safe.** No base scene uses `addTimeline`, so every
   golden stays byte-identical; ops compose on top of a node's existing
   animation; folding an added op to code is a literal `motionOp(...)` call
   (hand-authored scenes) or stays an overlay (preset scenes).

## Deliverable

1. `motionOps.ts`: `motionOp(name, target, opts)` for ~7 ops, each a labeled
   beat of existing primitives; exported.
2. `compose.ts`: `addTimeline` overlay verb (append, validate, report) + type.
3. preview: select a node → "add motion ▸ <op>" → writes `addTimeline`; per-op
   knobs editable; Tier-1 trail preview; fold to code.
4. ops on a logo (rotate/zoom/ken-burns) and text (fade/slide-in).

## Verifier

- Each op renders byte-identical twice; every existing golden byte-identical.
- `addTimeline` compose: base + an overlay adding "ken-burns" on a node renders
  the drift; a bad target id orphans loudly (regen-contract harness).
- Editor fold: add an op in the preview, `exportDraft` (has `addTimeline`), fold
  to a `motionOp(...)` literal → re-render **byte-identical** to the overlay
  render (the loop's fold proof).
- `pnpm test` + `pnpm typecheck` green.

## Done-when

~7 ops each emitting a labeled beat; `addTimeline` overlay verb + validation +
orphan report; preview add-motion affordance + per-op knobs + trail preview; ops
demonstrated on a logo AND text; an editor-added op folds to code byte-identical
to its overlay render; all goldens byte-identical; tests + typecheck green.

## Out-of-scope

Physics/inertia/throw; scroll/observer/draggable (no DOM in a video framework);
parametric easing beyond `cubicBezier`; a full timeline-track GUI; autonomous AI
op selection (that's the chat co-pilot / a later skill layer).
