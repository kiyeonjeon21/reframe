# GitHub year probe — any handle → 3D contribution flythrough

A repo-only generator that turns **any** GitHub handle's contribution graph into the
"GitHub year in 3D" flythrough (the generalized, data-driven cousin of the hand-tuned
flagship `examples/scenes/github-year.ts`). This is the self-serve **probe**: a script
you run to make shareable videos and measure interest, not a shipped npm command.

## Run

```sh
pnpm exec tsx examples/gh-year-probe/generate.mts <handle> [-o out.mp4]
# e.g.
pnpm exec tsx examples/gh-year-probe/generate.mts torvalds -o out/torvalds.mp4
```

It scrapes the public contributions calendar, bakes the data into a scene, and renders
an mp4 (needs ffmpeg + the one-time `pnpm exec playwright install chromium`).

## How it works

- **`generate.mts`** — scrapes `github.com/users/<handle>/contributions` (no auth/token),
  reconstructs the 7×N week grid + metrics (total, busiest day, longest streak, months),
  bakes them into a temp `_gen.ts`, and renders it with the reframe CLI. Fetch once →
  bake → deterministic render (same boundary as `examples/gh-video`).
- **`buildScene.ts`** — `buildGitHubYear(data)`, a **pure function** of the data that
  derives the whole arc: it finds the active week range, splits it into acts, locates the
  busiest month for the dive + callout, tracks the camera along the activity, ticks the
  counter, travels the month label, and ends by flattening the perspective into the
  familiar wide grid. Same data → identical scene → identical render.

## Caveats

- **Public contributions only.** The no-auth scrape sees what a logged-out visitor sees,
  so private-repo activity is not counted (an authenticated GraphQL fetch would include
  it, at the cost of needing a token). Numbers match the public profile graph.
- The flagship `github-year.ts` stays hand-tuned for its bespoke five-act narrative; this
  generator trades that bespoke polish for working on **any** dataset.
- Scraping depends on GitHub's current markup; if the calendar HTML changes, the parser in
  `generate.mts` may need an update.
