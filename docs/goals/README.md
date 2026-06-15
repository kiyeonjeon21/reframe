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

1. **[goal-1] reference-to-motion** — DONE (commit 4f4084a). 7/7 on analytic
   scenes; `reframe trace`. Validated for clean sources only.
1.5. **[goal-1-5] real-video hardening** — a real Notion video exposed a
   continuous-activity merge (an 11s bogus event) + light-background threshold
   mis-fire. Required before goal-2 maps real sketches onto beats.
2. **[goal-2] semantic timeline (Beats)** — the conceptual keystone; the unit
   that revision (#8) and reference-application (#5) both operate on.
3. **[goal-3] asset orchestration** — turns the manual ACE-Step/Kokoro/image
   wiring (done by hand for worldcup-glyph) into declared, deterministic scene
   data.
4. **[goal-4] motion vocabulary** — named motion presets as *seeded generators*
   (same name → a family, never a clone; the profiler proves it) + preview edit
   points (waypoints/timing) that survive a knob-driven regen. Builds on goal-2
   beats and the motionPath/path primitives. Makes motion requestable without
   canning it — the front door to "prompt → motion".
5. **[goal-5] motion ops library + add-motion in the editor** — DONE. A
   GSAP-style op toolkit (rotate/zoom/ken-burns/slide/fade/draw-on/pulse) for
   *any* node, plus a new `addTimeline` overlay verb so motion can be **added**
   in the preview (not just patched), editable and foldable to code. Builds on
   goal-4's vocab + the preview editing loop.
6. **[goal-6] universal canvas editability** — make *any* scene editable, not
   just leaf scenes: drag groups, drag nested children (parent-matrix
   inversion), add/duplicate/delete nodes — all stable-address overlay edits
   surviving regen. Today the canvas only grabs top-level leaf nodes, so every
   group-based scene (reframe-demo, the stings) is undraggable. The floor under
   "do detailed work easily in the UI". Builds on goal-5 + the overlay/regen
   loop.

9. **[goal-9] composition — the three-graph model made real** — reframe is
   single-scene, so "scene 간 구분" has no representation. Add a **composition**
   layer ABOVE `SceneIR` (ordered independent scenes + transitions + cross-scene
   audio → one deterministic mp4, each scene still renders/previews standalone),
   extend `beat` to **own a node subset** (the intent graph; additive metadata),
   and **surface all three graphs** in the preview (scene navigator + per-scene
   timeline grouped by beat). The keystone that makes scene/motion/intent graphs
   real. *Foundational — in practice sequences ahead of goal-7/8, which then
   compose across scenes.* Builds on goals 2/3/5/6.

### Planned (the "copilot" workflow — design decisions already locked)

The product loop is: **NL sketch → easy UI detailing → coding-agent ↔ UI
round-trip**, now spanning a multi-scene **composition** (goal-9). goal-6 is the
UI-detailing floor. The next two are scoped but not yet written as full
conditions; their load-bearing representations are locked (human-approved) so
they become pure implementation when picked up:

- **[goal-7] agent↔UI file round-trip** — the "copilot" usability layer.
  *Locked decision:* **file-based autosave, no copy-paste** — the preview
  autosaves the overlay draft to a known path; the coding agent watches it,
  folds edits into the scene `.ts`, and the preview hot-reloads. Closes the
  observe/fold loop without a clipboard step. Depends on goal-6 (and composes
  across goal-9 scenes).
- **[goal-8] NL sketch → scene/composition** — the front door. *Locked
  decision:* **code-first** — the agent generates a scene/composition `.ts`
  (deterministic, foldable literals), not an overlay-only or new sketch-IR
  representation. A skill-layer goal (LLM emits the scene), so its verifier
  differs from the engine goals.

Order: goal-1 → goal-1.5 → goal-2 (consumes the hardened sketch); goal-3 is
independent and lower-novelty, parallelizable by a second agent. goal-4 depends
on goal-2 (beats) + the motionPath/path primitives — both landed. goal-5 builds
on goal-4 + the preview editing loop (both landed). goal-6 builds on goal-5.
goal-9 is foundational (multi-scene) and in practice lands before goal-7
(round-trip across scenes) and goal-8 (NL → composition); both depend on goal-6.

## The human/agent split (read this before delegating)

- **Delegate to the agent:** segmentation algorithms, IR plumbing, emitters,
  tests, preview wiring, determinism — the known engineering (~60%).
- **Keep for yourself (with a reasoning model):** every "Design decision
  (human)" block. These are the representations whose shape determines whether
  the result is novel or just plumbing. Approve them first; then the goal is
  pure implementation an agent can self-verify.
