# Competitive analysis: Rive (2026-06)

Rive was the deep-research blind spot — the closest existing candidate for
"human-editable + deterministic playback." This analysis (web research, primary
sources) closes it. Conclusion up front: **Rive and reframe overlap far less
than feared; the overlap that exists is structural for Rive to escape.**

## What Rive is (verified)

- **Editor-as-source-of-truth**: scenes (artboards, state machines, timelines)
  are authored only in the closed-source cloud editor. The `.riv` runtime
  format is binary (schema effectively public via the runtime repo's core
  defs, but no official writer, no text representation, no diff/merge).
- **State machines + data binding**: states/transitions/inputs authored in the
  editor; runtimes flip input values and bind view-model data. The older
  inputs API is being deprecated in favor of data binding (view models with
  number/string/color/enum/list/image properties, two-way).
- **Scripting (2026)**: Luau scripts, authored inside the editor, constrained
  to five protocols (custom nodes, converters, layouts, path effects, tests).
  Code-first authoring of whole scenes is not a path.
- **AI strategy**: an editor MCP server (early access), state-machine
  scaffolding, and an AI Coding Agent that generates Luau scripts — i.e.
  **AI that operates the editor**, not AI that generates content. "Prompt →
  finished animation" is a community feature request, not a feature.
- **Rendering**: custom GPU vector renderer (MIT, open source).
  `advance(dt)`-driven — plausibly deterministic with fixed dt but
  determinism is not a documented contract. Video export is a paid
  **cloud-render** side feature that captures a single timeline only — state
  machines, data binding, and scripts cannot be exported to video.
- **Business model**: runtimes free/MIT; editor and export paywalled
  (export went free→paid in the 2025-10 pricing change). Recurring community
  complaints: editor lock-in, cloud-hosted data, "mountain" learning curve,
  binary format (no git workflow), mid-project paywall changes.

## Overlap map against reframe's three axes

| axis | Rive | reframe |
|---|---|---|
| human-editable | yes — best-in-class GUI editor | yes — knobs writing non-destructive overlays (no full editor, deliberately) |
| AI-generatable | no path to scene generation (binary format, editor-only authoring); AI only drives the editor/scripts | the text IR is the authoring surface; measured 33/33 first-attempt LLM generations |
| deterministic render | not a contract; video export is cloud-only, single-timeline, paid | the core contract; byte-identical frames verified, video is the first-class target |
| edits survive AI regeneration | not expressible (no text source, no overlay concept) | measured 100% across 11 regenerations incl. implicit ids |

## Where Rive is strong and reframe should not compete

Real-time interactive product graphics (app/game/automotive UI), GPU vector
rendering quality, designer-grade editing ergonomics. Rive is consolidating
there (GPU canvas, Unity store, components/libraries) — that is their moat.

## Structural gaps reframe occupies (hard for Rive to follow)

1. **Text-based, git-diffable source** — collides with their paid-editor model.
2. **Prompt → finished motion** — requires an LLM-writable format they don't have.
3. **Video/mp4 as a first-class deterministic target** — their architecture is
   a real-time runtime; their video path is a paid cloud add-on that drops
   their own headline features.
4. **Data-driven batch rendering** (N data rows → N videos) — they solve
   personalization at runtime only.
5. **Editor-less entry** for developers/CI.

## Risk to watch

Rive is moving fast on AI (free-tier AI agent, MCP). The plausible
convergence: MCP-driven scene construction could become a de-facto
"AI authors Rive scenes" path even with a binary format — the editor becomes
the API. If that lands, gap #2 narrows; gaps #1/#3/#4 still hold because they
conflict with the business model, not just the tech.

*Sources: rive.app docs/blog (state machine, data binding, .riv format,
scripting/Luau, AI coding agent, pricing, video export), rive-runtime GitHub,
HN threads on the renderer open-sourcing, LottieFiles/community comparisons,
Grayhat Studio production retrospective (2025).*
