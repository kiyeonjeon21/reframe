# Changelog

All notable changes to `reframe-video` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Note that
before 1.0 the IR and overlay schema carry no compatibility promise; minor
versions may change them.

## [Unreleased]

## [0.6.7] - 2026-06-18

### Added

#### Video clip audio

- The `video` node now muxes a clip's **own audio track** into the output (it was
  visual-only in 0.6.6). Audio is placed at the node's `start`, trimmed from
  `clipStart`, sped by `rate`, and scaled by a new `volume` prop (default 1; `0`
  mutes); it mixes with `scene.audio` cues/bgm.
- `AudioPlan` gains a `clipAudio[]` (one entry per audible video node, anchored to
  its numeric `start`); `resolveAudioPlan` / `resolveCompositionAudioPlan` populate it.
  render-cli probes each clip with `ffprobe`, extracts its track, and adds an
  `atrim → atempo → volume → adelay` chain into the existing `amix` (a clip with no
  audio stream, or `volume: 0`, is skipped). Determinism stays same-machine.
- The `video-demo` clip now carries a synthesized tone so the demo plays sound.

## [0.6.6] - 2026-06-18

### Added

#### `video` source node (clips as a layer)

- A `video` node draws a clip as a layer, playing on the scene clock: at scene-time
  `t` it shows the source frame at `clipStart + max(0, t - start) * rate`. Props:
  `src` (mp4 / mov / webm / m4v / mkv), `width`/`height`, `fit` (`"cover"` like image),
  `start`, `rate`, `clipStart`. Transform / opacity / effects compose as usual.
- **Deterministic by frame extraction**: render-cli runs `ffmpeg -vf fps=<sceneFps>` to
  pull the clip's frames (`buildVideoFrameAssets`), the capture page decodes them into a
  `VideoRegistry`, and core's pure `evaluate` computes the integer frame index
  (`round(t·fps)`, fps from `compiled.ir.fps`) that the renderer draws — no live
  `<video>` seek, so renders stay byte-identical (same machine). Additive / golden-safe
  (no existing scene uses it).
- New demo `examples/scenes/video-demo.ts` (procedural clip under
  `examples/scenes/video-demo/`, not bundled to npm).
- **v1 limitations**: visual-only (the clip's own audio is not muxed — use `scene.audio`);
  all frames are pre-decoded so clips should be short; like images, video sources do not
  render in `reframe player` / claude.ai artifacts (mp4 only).

## [0.6.5] - 2026-06-18

### Added

#### Image `fit: "cover"` (auto-cover)

- `fit` prop on the `image` node: `"cover"` crops the image to fill its width×height
  box at the image's natural aspect (centered), so any-aspect photos drop in with no
  distortion and no pre-cropping. `"fill"` (default) keeps the stretch-to-box behavior.
- Renderer-side (`coverRect` computes the centered source rect; an 8-arg `drawImage`),
  so the author needs no intrinsic dimensions. Discrete (not keyframed); additive and
  byte-identical when absent or `"fill"`.

### Changed

- `photoMontage` now sets `fit: "cover"` on every layer — montage images no longer
  need to be pre-cropped to the frame aspect (the demo images are now native-aspect).

## [0.6.4] - 2026-06-18

### Added

#### Photo montage generator

- **`photoMontage(images, opts)`** — turns a list of images into a polished
  slideshow: crossfades + seeded Ken Burns (pan/zoom) + an optional cinematic grade
  (vignette + bottom scrim, built from gradients + blend modes). The photo analog of
  `motionPreset` / `splitText`.
- Returns `{ nodes, timeline }` (owns its image layers, like `splitText` owns glyphs).
  Stable regen addresses: node ids `${id}-${i}` (+ `${id}-vignette` / `${id}-scrim`),
  labels `shot-${i}` / `cross-${i}`. Per-slide overrides `{ src, hold?, ken? }` with
  `ken` ∈ `"in" | "out" | "pan"`. Seeded + pure (same `(images, opts)` → identical IR).
- Sizes each layer to the frame and keeps the Ken Burns `scale ≥ 1` with the pan
  bounded to its slack, so an image edge is never revealed (the `image` node draws
  stretched — images must be pre-cropped to the frame aspect).
- New demo `examples/scenes/photo-montage.ts` over six CC0 travel photos
  (`examples/scenes/photo-montage/`, provenance in its `LICENSE.md`; not bundled to npm).

## [0.6.3] - 2026-06-17

### Added

#### Blend modes (compositing)

- `blend?: BlendMode` on drawable nodes (rect / ellipse / text / image / path / line)
  selects how a shape composites with what's drawn beneath it: `screen` / `add`
  (additive light — overlaps brighten), `multiply` (tint / deepen), `overlay` /
  `soft-light` / `hard-light` (grade), `lighten` / `darken`, `color-dodge`,
  `difference`. Default `normal`.
- Discrete (a static string, not keyframed). The renderer maps it to
  `ctx.globalCompositeOperation` after `setTransform` (`add` → `lighter`), isolated by
  the per-op `save/restore`. Additive and **byte-identical** when absent or `normal`.
- No-op on a `group` (whole-subtree compositing is a later add).
- New demo `examples/scenes/blend-demo.ts`.

## [0.6.2] - 2026-06-17

### Added

#### Shadow, glow & blur

- **Drop shadow / outer glow / gaussian blur** on rect / ellipse / path / text /
  image / line, via the props `blur`, `shadowColor`, `shadowBlur`, `shadowX`,
  `shadowY` (and the **`glow`** / **`dropShadow`** helpers). Unlike gradients these
  are scalar props, so they **animate** through the normal tween/oscillate
  machinery — pulse a glow (`oscillate(id, "shadowBlur", …)`), pull focus
  (`tween(id, { blur: 0 })`). Effects are in screen-pixel space (consistent light
  direction). Additive and determinism-safe: a node with no effects renders
  byte-identically. No-op on a group (composite blur is a later add).

## [0.6.1] - 2026-06-17

### Added

#### Gradients

- **`fill` / `stroke` accept a gradient** (linear / radial / conic) on rect,
  ellipse, and path, via **`linearGradient`** / **`radialGradient`** /
  **`conicGradient`**. Coordinates are normalized to the node's bounding box
  (0..1), so a gradient is just an angle + color stops. The renderer builds the
  Canvas gradient in the node's local space, so animating the node's transform
  (rotation / scale / move) sweeps the gradient with it (gradients themselves are
  static this release). Additive and determinism-safe: a color-string fill takes
  the exact existing path, so existing scenes render byte-identically.

## [0.6.0] - 2026-06-17

### Added

#### CLI

- **`reframe player <scene> [-o out.html]`** — bundle a scene into one
  self-contained HTML file that plays the motion live in any browser (and pastes
  straight into a Claude.ai Artifact): an esbuild IIFE of the core + canvas
  renderer + the scene driving a `<canvas>` rAF loop, with the Inter fonts
  inlined. Visual-only (audio cues and image-node sources stay in the mp4 render
  path).

#### Camera

- **`camera`** — a first-class, keyframable scene viewport. Add a top-level
  `camera: { x, y, zoom, rotation }` (look-at semantics: `(x,y)` is the scene
  point centred in frame; defaults are the identity) and animate it with
  **`cameraTo(props, opts)`** — a `tween` on the reserved `"camera"` target, so
  `motionPath("camera", …)` (pan along a curve) and `oscillate`/`wiggle` on the
  camera (handheld drift) work too. One global matrix is applied at the root of
  the render walk, so it moves the whole scene; clips compose correctly.
- **`fixed: true`** on a top-level node pins it to the screen (the camera does
  not move it) — for HUD / titles / watermarks.
- Additive and determinism-safe: a scene without a camera renders byte-identically
  (the camera path is skipped). A node named `"camera"` keeps its node semantics
  for back-compat; the scene camera and such a node can't be combined.
- **`contentThousands`** on text — group the integer part of a numeric counter
  with thousands separators (e.g. `35,786`).

## [0.5.0] - 2026-06-17

### Added

#### Cursor (UI demos)

- **`cursor(opts)`** — a vector mouse pointer node (styles `arrow` / `dot` /
  `ring`) whose **hotspot is the group origin**, so a move lands the tip on a
  target. Carries a hidden `${id}-ripple` ring for clicks.
- **`cursorTo(id, from, to, opts)`** — glide along a gentle human arc (a
  `motionPath` bowed perpendicular to the travel); **`cursorPath`** for a
  multi-stop tour.
- **`cursorClick(id, { press?, ripple?, label? })`** / **`cursorDouble`** — the
  pointer taps, a ripple ring expands, and an optional target button presses.
- **`deviceScreenPoint(name, opts, [lx, ly])`** — maps a UI element's
  screen-local coords to scene coords, so the cursor clicks UI inside a
  `devicePreset` precisely.

## [0.4.0] - 2026-06-16

### Added

#### Kinetic text

- **`splitText(text, opts)`** — splits a phrase into per-glyph (or per-word)
  centre-anchored `text` nodes using **real Inter advance widths**, so the
  layout matches the render exactly. Returns a `TextBlock` (`nodes` / `glyphs` /
  `ids` / `width`); glyph ids `${id}-${i}` are stable regen addresses.
- A library of **seeded text-effect generators** (same `(name, seed)` →
  identical IR; pure keyframes):
  - **`textIn`** — entrance: `typewriter`, `cascade`, `rise`, `bounce`,
    `assemble` (fly in from a seeded scatter), `decode` (scramble through random
    glyphs then lock).
  - **`textLoop`** — sustained behaviors: `wave` (standing sine), `shimmer`,
    `wobble`, `float`.
  - **`textOut`** — exit: `shatter` (random direction + spin + fade), `fly`,
    `dissolve`, `fall`, `collapse`.
  - **`textTypeCues`** — per-glyph CC0 keypress audio for a typewriter entrance.
- **`textMetrics`** — Inter 400/700/800 advance-width tables over printable
  ASCII, measured with the render engine (Playwright `measureText`) so layout is
  faithful; core stays pure/deterministic at author time.

## [0.3.0] - 2026-06-16

### Added

#### Character system

- **`rig(boneTree, opts)` / `humanoid(opts)`** — a first-class, declarative
  character rig that compiles to plain IR: nested `group` joints with stable
  `${id}-${name}` addresses (the regen contract extends to them). Forward-
  kinematics posing via **`poseTo`** / **`rigPose`**; a 2-bone inverse-kinematics
  solver, **`ikReach`**. The character analog of `devicePreset`.
- **`characterPreset(name, opts)`** — a seeded motion generator (the character
  analog of `motionPreset`): `walk`, `run`, `jump`, `dance`, `wave`, `cheer`.
  Returns a composable `beat`; legs use `ikReach`, arms FK. Same `(name, knobs,
  seed)` is reproducible; a `label` knob keeps beats unique when a preset is
  reused.
- **`figure(opts)`** — a dressed character on the humanoid skeleton, with a
  `style` (`clean` corporate-flat / `cute` mascot) and palette knobs
  (`skin`/`hair`/`top`/`pants`/`shoe`/`accent`; for `clean` the top follows the
  accent). Exposes the humanoid joint ids, so `characterPreset` / `ikReach` drive
  any skin. `face: false` for a faceless figure.

#### Motion

- **Path `d` morphing** — `tween(id, { d })` morphs an SVG path vertex-by-vertex
  (the Lottie-style shape tween) when both paths share command structure; arcs
  (`A`) can't morph and incompatible shapes snap at the midpoint.

#### Assets

- Soft CC0 footstep foley (Kenney RPG Audio) for character walk cycles.

## [0.2.0] - 2026-06-16

### Added

#### Device mockups

- **`devicePreset(name, opts)`** — ten parametric vector device frames
  (`phone`, `tablet`, `laptop`, `browser`, `watch`, `monitor`, `tv`,
  `foldable`, `terminal`, `car`), each with a **clipped screen "content slot"**,
  so a mockup is one call. Pure primitives, no assets, deterministic, additive
  to the golden contract.
- **`deviceScreen` / `deviceScreenCenter` / `deviceBounds`** — content-local
  screen bounds, the panel's device-local centre (for ejecting it in an
  exploded view), and the full frame footprint (for laying many devices on a
  grid).

#### Composition (multi-scene)

- **`CompositionIR`** with **`compileComposition`** and **`renderComposition`**:
  stack independent scenes into one timeline with cut/crossfade transitions;
  render one with `--scene <id>`.
- **`beat.nodes`** records which nodes a beat drives (intent metadata the
  preview groups by).

#### Motion

- **`motionOp(name, opts)`** — a GSAP-style motion-ops toolkit that applies to
  any node, from code or the editor.
- **2.5D tilt**: per-axis `scaleX` / `scaleY` and `skewX` / `skewY` transform
  props (affine; the default fast-path keeps byte-identity).
- **`clip` on groups** — rect/ellipse masks in group-local coordinates.
- **`motionPath`** gains `curviness` (sharp / smooth / loopy) and add/remove
  waypoint editing.

#### Preview editor

- A large editing overhaul: a node-track dope sheet grouped by the scene graph
  (collapsible), a bottom composition/beat timeline with lane-stacked overlaps,
  drag-a-beat-to-retime, smooth continuous play-all, a transform gizmo (scale +
  rotate), every node type (line, image, svg/logo), image drag-and-drop,
  multi-select (shift-click + marquee + bulk edit), an onion-skin motion trail,
  a seeded variation grid, timeline loop range + speed, an ease-curve editor,
  and a discoverable "+ move" for motionless nodes.
- Universal canvas editability: drag groups and nested children, add/delete
  nodes.

#### CLI

- **`reframe labels <scene>`** — print the compiled event clock (every timeline
  label with its exact seconds). The authoritative timing source for sound
  design (anchor `audio.cues` to these labels) and for debugging when a beat
  fires.

#### Assets

- Expanded the vendored CC0 sound library (Kenney Interface Sounds: maximize /
  minimize sweeps, plucks, selects, four confirmations, bong, glass, open) for
  richer label-anchored sfx.

### Fixed

- Package build: strip the new `examples/compositions` preview glob (it was
  breaking the `reframe-video` build) and bundle the `labels` command.

## [0.1.3] - 2026-06-16

### Added

- `reframe logo <logo.svg | brand-slug> [--motion <preset>] [--energy n] [--seed n]`
  CLI command: animate any SVG (a local file, or a simple-icons brand) into a
  logo sting with no clone needed, e.g.
  `npx reframe-video logo react --motion spin-forge`.

## [0.1.2] - 2026-06-16

### Added

- **Motion vocabulary**: `motionPreset(name, opts)` with six seeded presets
  (`draw-bloom`, `punch-in`, `rise-settle`, `slide-bank`, `reveal-orbit`,
  `spin-forge`). Same `(name, knobs, seed)` is reproducible; a different `seed`
  varies the motion within the same family.
- **`path` node**: vector SVG shapes with a `progress` draw-on and `originX/Y`
  pivot, crisp at any zoom.
- **`motionPath`**: drive a node's x/y along a Catmull-Rom curve, with tangent
  `autoRotate`.
- **Expressive eases**: `easeIn/Out/InOutBack`, `*Elastic`, `*Bounce`.
- Overlay can patch a `motionPath` step's `points`; the preview exposes
  draggable waypoint handles that survive a knob-driven regeneration.
- `examples/logo-sting/` one-command animated logo sting generator (local SVG
  or a simple-icons brand slug).

### Changed

- README: Motion vocabulary section, card layout for the showcase table.

## [0.1.1] - 2026-06-11

### Fixed

- Packaging fixes for the initial npm release.

## [0.1.0] - 2026-06-11

### Added

- Initial public release: eDSL, plain-data IR, deterministic mp4 render,
  non-destructive overlays that survive AI regeneration, preview editor, batch
  rendering, label-anchored audio, and the Claude Code skill/plugin.

[Unreleased]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.7...HEAD
[0.6.7]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.6...v0.6.7
[0.6.6]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/kiyeonjeon21/reframe/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/kiyeonjeon21/reframe/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/kiyeonjeon21/reframe/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/kiyeonjeon21/reframe/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kiyeonjeon21/reframe/releases/tag/v0.1.0
