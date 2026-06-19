<!--
Thanks for the PR. Keep it focused; describe the change and why.
See AGENTS.md for the repo map and conventions, CONTRIBUTING.md for the ground rules.
-->

## What & why

<!-- What does this change, and what problem does it solve? Link any issue (e.g. Closes #12). -->

## Type

<!-- Delete what doesn't apply. -->

- feat / fix / docs / refactor / test / chore

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] New behavior has a test
- [ ] Scenes stay pure functions of time (no `Date` / `Math.random()`; `wiggle`/a `seed`)
- [ ] Golden snapshots (`packages/core/test/__snapshots__`) are unchanged — or the change is **intentional and explained below**
- [ ] Stable addresses preserved — I did not rename node `id`s, state names, or timeline `label`s for concepts that survive (see `docs/guides/regen-contract.md`)
- [ ] I did not edit recorded measurements under `benchmark/` to change numbers
- [ ] I have read and agree to the [CLA](../CLA.md) (opening this PR confirms agreement)

## Golden snapshot changes

<!-- If any snapshot changed, explain why it is correct and not a regression. Otherwise write "none". -->

none

## Demo (optional)

<!-- For motion/render changes, a screenshot or a short mp4/gif of the result helps a lot. -->
