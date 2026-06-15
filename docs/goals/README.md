# reframe → Motion IDE: goal-driven roadmap

These are **autonomous-agent goals** (Codex-style), not a product spec. The
product vision ("AI-native After Effects") is a research program; these goals
are the verifiable engineering steps that move reframe toward it without
handing an agent something open-ended enough to hallucinate.

## The contract every goal here obeys

A goal is only a goal if it has a **verifier** — an executable check that
proves it worked. Without one it is a wish, and an autonomous agent will
produce plausible garbage against it. Each goal below specifies:

- **Anchor** — existing files to extend (never greenfield)
- **Deliverable** — one concept
- **Design decision (human)** — the load-bearing representation choice. This is
  flagged explicitly and must be reviewed/approved before the agent builds on
  it. Do NOT let the agent invent these silently; they are where the actual
  novelty lives, and a coding agent implements specs — it does not invent
  representations.
- **Verifier** — how the agent checks its own work
- **Done-when** — numeric pass criteria
- **Out-of-scope** — what not to touch

## Why reframe is the right substrate for agent autonomy

reframe already ships the verifier infrastructure these goals lean on:
golden snapshots (`packages/core/test/__snapshots__`), the calibrated motion
profiler with analytic ground-truth gates (`benchmark/harness/motion/`),
byte-determinism (`packages/render-cli/test/determinism.test.ts`), and the
overlay/regen survival harnesses. An agent can verify itself here. That is the
reason to build ON this repo rather than start over.

## What reframe already has (you start at ~50%, not 0%)

| Motion-IDE component | reframe status | where |
|---|---|---|
| Scene graph | have | `packages/core/src/ir.ts` (NodeIR, groups) |
| Editable DSL | have | `packages/core/src/dsl.ts` |
| Motion graph | partial | timeline tree + behaviors; no inter-element dependency edges |
| Semantic timeline | partial | timeline `label`s are stable addresses; no Beat layer |
| Reference→motion | seed | `benchmark/harness/motion/` reads mp4 → speed/easing; no IR emission |
| Preview editing | have | `packages/preview/` overlay editor |
| Asset-aware generation | manual | image nodes + audio; orchestration hand-wired |
| Fine-grained revision | partial | overlay + NL-loop, measured |

## Sequence

1. **[goal-1] reference-to-motion** — most novel, cleanest verifier, the
   "make it like this video" capability. Self-contained round-trip.
2. **[goal-2] semantic timeline (Beats)** — the conceptual keystone; the unit
   that revision (#8) and reference-application (#5) both operate on.
3. **[goal-3] asset orchestration** — turns the manual ACE-Step/Kokoro/image
   wiring (done by hand for worldcup-glyph) into declared, deterministic scene
   data.

Do them in order: goal-2 consumes goal-1's output shape; goal-3 is independent
but lower-novelty, so it can run in parallel by a second agent if desired.

## The human/agent split (read this before delegating)

- **Delegate to the agent:** segmentation algorithms, IR plumbing, emitters,
  tests, preview wiring, determinism — the known engineering (~60%).
- **Keep for yourself (with a reasoning model):** every "Design decision
  (human)" block. These are the representations whose shape determines whether
  the result is novel or just plumbing. Approve them first; then the goal is
  pure implementation an agent can self-verify.
