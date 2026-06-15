# Contributing to reframe

Thanks for your interest. reframe is early alpha, so issues, ideas, and PRs are
all welcome. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Dev setup

```bash
brew install ffmpeg                       # system dep (or apt install ffmpeg)
pnpm install
pnpm exec playwright install chromium     # one-time (postinstall is blocked)
pnpm test          # vitest
pnpm typecheck
```

`AGENTS.md` is the working guide for the repo (commands, repo map, conventions,
release). Read it before larger changes. Scene syntax lives in
`benchmark/guides/edsl-guide.md`.

## Ground rules

- **Determinism is the contract.** Scenes are pure functions of time: no
  `Math.random()` or `Date` (use `wiggle`/a `seed`). The golden snapshots in
  `packages/core/test/__snapshots__` encode it; an unexpected change there is a
  regression to explain, not to bless.
- **Stable addresses survive regeneration.** Don't rename node `id`s, state
  names, or timeline `label`s for concepts that persist a redesign (see
  `docs/regen-contract.md`).
- **Don't edit `benchmark/` results** to change numbers; they are recorded
  measurements.
- Keep `pnpm test` and `pnpm typecheck` green. New behavior needs a test.

## Pull requests

1. Fork and branch from `main`.
2. Make the change with tests; run `pnpm test` and `pnpm typecheck`.
3. Open a PR describing the change and why. CI runs typecheck + tests.

Maintainers handle releases (tag-triggered npm publish); contributors don't need
to bump versions.
