# reframe — instructions for Claude

Declarative motion graphics research prototype. The loop: `scene.ts` (eDSL →
plain-JSON IR) → preview editing (recorded as non-destructive overlay JSON) →
deterministic mp4 render. Human edits survive AI regeneration of the base.

## Commands

- `pnpm reframe render <scene.ts|.html> [--overlay f] [-o out]` — mp4 into `out/`
- `pnpm reframe batch <scene.ts> <data.json|csv>` — one mp4 per row (row keys are overlay addresses like `nodes.<id>.<prop>`)
- `pnpm reframe preview` / `new <name>` / `motion <mp4>` / `guide [--regen]` / `demo`
- `pnpm test` (vitest), `pnpm typecheck`

## Authoring scenes — read the guide first

Before writing or modifying any scene (.ts), **read
`benchmark/guides/edsl-guide.md`** — it is the complete, current syntax.
Scenes live in `examples/scenes/` (the preview's scene list and `@reframe/core`
workspace resolution only work there) and must be pure functions of time:
no `Math.random()`/`Date` (use `wiggle` with a seed).

## Regeneration contract — stable addresses

When regenerating or rewriting an existing scene, **never rename node `id`s,
state names, or timeline `label`s** for concepts that survive the redesign —
overlay documents hold human edits at those addresses. Full contract:
`docs/regen-contract.md`. Overlay schema by example:
`examples/overlays/brand-edits.json`.

## Repo map

- `packages/core` — eDSL/IR/compile/evaluate/composeScene (zero deps; tests in `test/`)
- `packages/renderer-canvas` — DisplayList → Canvas 2D
- `packages/render-cli` — Playwright capture + ffmpeg; `reframe.ts` is the user CLI
- `packages/preview` — Vite editor (edits → overlay draft, `window.__store` debug hook)
- `examples/` — scenes, overlays, edit-survival demo
- `benchmark/` — measurement artifacts (LLM benchmark, regen experiment, motion
  profiler). These are recorded experimental results — do not regenerate or
  edit them to make numbers look different.

## Gotchas

- ffmpeg is a system dependency; Playwright chromium needs a one-time
  `pnpm exec playwright install chromium` (postinstall is blocked).
- Bundled fonts: Inter 400/700/800 only — other families silently fall back.
- Audio: `scene.audio` cues anchor to timeline labels (they survive retiming);
  sfx are procedurally synthesized, CC0 samples live in `assets/sfx/`
  (LICENSE.md records provenance). Determinism contract covers the AudioPlan
  and WAV bytes, not AAC-encoded mp4 bytes.
- Golden snapshots in `packages/core/test/__snapshots__` encode the determinism
  contract; if they change unexpectedly, that's a regression, not noise.
