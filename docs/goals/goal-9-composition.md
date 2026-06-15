# Goal 9 — Composition: the three-graph model made real (multi-scene + intent + graph-grouped timeline)

## Objective

reframe is **single-scene**: `SceneIR` has no concept above it, so "scene 간의
구분" (separating scenes) has no representation, and a video is one flat scene.
This goal makes the user's **three-graph** model real:

- **scene graph** — `NodeIR` tree (exists; groups exist).
- **motion graph** — `TimelineIR` + behaviors + motionPath (exists; GSAP nested
  timelines + labels are the reference).
- **intent graph** — `beat` extended to own a node subset (today it groups only
  timeline steps).
- **composition** — a NEW top layer: an ordered list of independent scenes with
  transitions + composition-level audio, rendered to one deterministic mp4.

And it **surfaces** all three in the preview: a scene navigator (each scene
independently openable/editable) + a per-scene timeline grouped by beat
(GSDevTools-style track groups with label markers). Builds on goal-2 beats,
goal-3 asset/audio, goal-5 motion ops, and the goal-6 editing loop.

## The load-bearing change

A **Composition** is a layer ABOVE `SceneIR`, not a change to it. Each scene
stays a standalone `SceneIR` (single-scene render/preview/overlay unchanged); the
composition lays out scene start times with transitions and renders each scene,
then concatenates. `evaluate`/`compile` of a single scene never change, so all
goldens and the determinism contract are preserved — the composition gets its
own compile + render + audio path on top.

## Anchor (extend, don't rebuild)

- `packages/core/src/ir.ts` — NEW `CompositionIR { id, scenes: { scene: SceneIR,
  transition?, at? }[], audio? }`; `beat` gains optional `nodes?: string[]`
  (additive metadata).
- `packages/core/src/dsl.ts` — `composition(...)` factory; `beat(name, { nodes? },
  …)` extended (still `beat(name, {}, …) ≡ seq`).
- `packages/core/src/compile.ts` (or a sibling `composeComposition.ts`) —
  `compileComposition`: per-scene durations → scene start times honoring
  transitions/overlaps (`at: "-0.5"` overlaps 0.5s) → total duration.
- `packages/core/src/audio.ts` — composition AudioPlan: offset each scene's cues
  by its start, layer a composition `bgm` (e.g. kokoro narration via goal-3 `gen`
  recipes) spanning scenes.
- `packages/render-cli/src/reframe.ts` — `render <composition.ts>` → render each
  scene + concatenate (ffmpeg `xfade`/concat) → one deterministic mp4; `--scene
  <id>` renders one scene standalone.
- `packages/preview/` — a scene navigator (filmstrip; open a scene → existing
  editor) + a per-scene timeline grouped by beat (beat = a track group of its
  nodes' lanes).
- `packages/core/src/validate.ts` — `validateComposition` (unique scene ids,
  known transitions, `beat.nodes` reference real node ids).

## Decisions (fixed — locked by the human)

1. **Composition is a new top-level IR wrapping independent `SceneIR`s** —
   `composition({ id, scenes: [{ scene, transition?, at? }], audio? })`. Each
   scene is a normal `SceneIR` (renders/previews/overlays standalone, byte-for-
   byte identical to today). The composition renders each scene and concatenates
   with transitions into one deterministic mp4. **No change to `SceneIR`,
   `evaluate`, or single-scene `compile`** — the composition is a layer above.
2. **A beat may own a node subset: `beat(name, { nodes?: string[] }, children)`**
   — purely additive metadata. It does NOT touch compile/evaluate (a semantic
   annotation only); the preview uses it to group node + timeline tracks under
   the beat, and overlay/regen address it by the stable `name`. `beat(name, {},
   …)` stays byte-identical to `seq`.
3. **The preview surfaces all three graphs.** A scene navigator (composition
   filmstrip; click a scene to open the existing per-scene editor) + a per-scene
   timeline grouped by beat (each beat a track group containing its owned nodes'
   lanes, with label markers). Editing is per-scene; the composition is
   navigated and retimed.
4. **Audio composes at the composition level.** A composition `audio` (bgm
   spanning scenes) layers over per-scene cues; the composition AudioPlan offsets
   each scene's cues by that scene's start time. The determinism contract extends
   to the composition AudioPlan + WAV bytes (same boundary as today — not the
   AAC-in-mp4 bytes).

## Deliverable

1. `ir.ts`/`dsl.ts`: `CompositionIR` + `composition()`; `beat` additive `nodes?`.
2. `compileComposition`: scene start-time layout with transitions + total
   duration.
3. `audio.ts`: composition AudioPlan (per-scene cue offset + composition bgm).
4. CLI: `reframe render <composition.ts>` → one deterministic mp4; `--scene <id>`
   renders one scene standalone.
5. preview: scene navigator + per-scene beat-grouped timeline.
6. `validateComposition`; an example composition (2–3 scenes) committed.

## Verifier

- **Composition render determinism:** a 2-scene composition renders
  byte-identically twice (extend `determinism.test.ts`); the composition
  AudioPlan is byte-stable.
- **Scene independence:** a scene rendered inside the composition equals
  rendering that `SceneIR` alone, modulo the composition's time offset.
- **Beat-owns-nodes is additive:** `beat(name, { nodes:[…] }, …)` compiles +
  evaluates byte-identical to `beat(name, {}, …)`; all goldens byte-identical.
- **Addressable + survives regen:** an overlay beat-retime + an edit on a beat's
  owned node both survive a base regen by stable name/id (regen-contract).
- **Audio layout:** per-scene cues offset by scene start; composition bgm spans;
  AudioPlan total duration = composition duration. **Transition layout:** scene
  start times honor transitions/overlaps; total duration correct.
- `pnpm test` + `pnpm typecheck` green.

## Done-when

`CompositionIR` + `composition()` factory; `beat` gains additive `nodes?`;
`compileComposition` lays out scene times with transitions; `reframe render
<composition.ts>` → one deterministic mp4 (byte-identical twice) and `--scene
<id>` renders one scene standalone; a scene renders identical inside vs alone
(modulo offset); composition AudioPlan byte-stable, offsets per-scene cues +
composition bgm; preview shows a scene navigator + a per-scene timeline grouped
by beat (beat track groups + label markers); a beat-retime + owned-node edit
survive regen; `beat(name, { nodes }, …)` byte-identical to `beat(name, {}, …)`;
all goldens byte-identical; `pnpm test` + `pnpm typecheck` green.

## Out-of-scope

NL → composition authoring (skill layer — goal-8; the engine is designed for it);
the agent↔UI file round-trip (goal-7 — composition only needs to be navigable);
transition types beyond a small set (cut, crossfade/xfade); editing across scene
boundaries in one gesture (each scene edits independently); a full node-graph
dependency editor (the intent graph stays beat-grouping, not arbitrary edges);
kokoro/ACE-Step model wiring itself (that's goal-3's `gen` recipes — here only the
composition audio slot + plan compose); any change to single-scene
`evaluate`/`compile`.
