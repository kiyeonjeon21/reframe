# reframe — instructions for coding agents

Shared guide for any agent working in this repo (Claude Code reads it via
`@AGENTS.md` in `CLAUDE.md`; Codex reads `AGENTS.md` natively). This file is the
source of truth — put durable project instructions here, not in tool-specific
files, so both tools stay in sync.

Declarative motion graphics research prototype. The loop: `scene.ts` (eDSL →
plain-JSON IR) → preview editing (recorded as non-destructive overlay JSON) →
deterministic mp4 render. Human edits survive AI regeneration of the base.

## Commands

- `pnpm reframe render <scene.ts|.html> [--overlay f] [-o out]` — mp4 into `out/`
- `pnpm reframe batch <scene.ts> <data.json|csv>` — one mp4 per row (row keys are overlay addresses like `nodes.<id>.<prop>`)
- `pnpm reframe logo <logo.svg | brand-slug> [--motion <preset>] [--energy n] [--seed n]` — animate a logo into a sting (published CLI command; `packages/render-cli/src/logoSting.ts`)
- `pnpm reframe preview` / `new <name>` / `motion <mp4>` / `trace <ref.mp4>` / `guide [--regen]` / `demo`
- `pnpm test` (vitest), `pnpm typecheck`

## Authoring scenes — read the guide first

Before writing or modifying any scene (.ts), **read
`benchmark/guides/edsl-guide.md`** — it is the complete, current syntax.
A scene `.ts` file can live anywhere on disk — `render`/`batch` bundle it with
esbuild and resolve `@reframe/core` themselves, and the preview lists scenes
from the invoking directory alongside `examples/scenes/`. The repo's showcase
scenes stay in `examples/scenes/`. Scenes must be pure functions of time:
no `Math.random()`/`Date` (use `wiggle` with a seed, or pass a `seed` knob).

## Motion vocabulary (presets, path node, motionPath)

- `motionPreset(name, { target, energy, speed, intensity, from, seed })`
  (`packages/core/src/presets.ts`) returns a goal-2 `beat`. Six presets:
  draw-bloom, punch-in, rise-settle, slide-bank, reveal-orbit, spin-forge. Each
  is a **seeded generator**, not a template: same `(name,knobs,seed)` → identical
  IR; a different `seed` varies it within the same family (gated by the
  trajectory tests in `packages/core/test/presets.test.ts`).
- `path` node — vector SVG (`d`) with `progress` draw-on and `originX/Y` pivot.
- `motionPath(target, points, opts)` — Catmull-Rom curve driving x/y (+ tangent
  `autoRotate`); holds the end. Pure math in `packages/core/src/path.ts`.
- Logo sting: `examples/logo-sting/` (`generate.mts` + `template.ts`); a sample
  `logo.svg` is committed.

## Regeneration contract — stable addresses

When regenerating or rewriting an existing scene, **never rename node `id`s,
state names, or timeline `label`s** for concepts that survive the redesign —
overlay documents hold human edits at those addresses. Full contract:
`docs/regen-contract.md`. Overlay schema by example:
`examples/overlays/brand-edits.json`.

## Repo map

- `packages/core` — eDSL/IR/compile/evaluate/composeScene, presets, path,
  motionPath (zero deps; tests in `test/`)
- `packages/renderer-canvas` — DisplayList → Canvas 2D
- `packages/render-cli` — Playwright capture + ffmpeg; `reframe.ts` is the user CLI
- `packages/preview` — Vite editor (edits → overlay draft, `window.__store` debug hook)
- `packages/reframe-video` — the published npm package (see Release below)
- `skills/reframe/SKILL.md` + `.claude-plugin/` — the Claude Code plugin
- `examples/` — scenes, overlays, edit-survival demo, logo-sting
- `benchmark/` — measurement artifacts (LLM benchmark, regen experiment, motion
  profiler). These are recorded experimental results — do not regenerate or
  edit them to make numbers look different.

## Release (npm)

Only `packages/reframe-video` is published; the other packages are `private`
and inlined into it by the build (esbuild + `REFRAME_PACKAGED`). To cut a
release: bump `packages/reframe-video/package.json` `version`, commit, then push
a matching `v<version>` tag. The `.github/workflows/publish.yml` action builds
and runs `npm publish` with the `NPM_TOKEN` repo secret. Manual fallback:
`pnpm --filter reframe-video build && cd packages/reframe-video && npm publish`.
Never commit `.env` (it holds `NPM_TOKEN`; it is gitignored).

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

## Agent interop (Claude Code ↔ Codex)

- This file (`AGENTS.md`) is the shared brain. Keep durable instructions here.
- `CLAUDE.md` is just `@AGENTS.md` plus Claude-only notes.
- Claude-only config lives in `.claude/settings.json` (committed: permissions;
  personal overrides go in the gitignored `.claude/settings.local.json`). Codex
  has no equivalent committed hook/permission file, so don't encode required
  behavior in hooks — put it here as instructions both tools read.
