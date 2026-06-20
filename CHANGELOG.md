# Changelog

All notable changes to `reframe-video` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Note that
before 1.0 the IR and overlay schema carry no compatibility promise; minor
versions may change them.

## [Unreleased]

## [0.6.35] - 2026-06-20

### Changed

#### `devicePreset` redesign — spec-driven, seeded, premium by default

- **Premium look by default.** Device frames now ship a gradient body, an ambient screen glow, and a
  soft contact shadow; a `style` knob picks `"glass"` (realistic glass/metal + a diagonal sheen,
  default) or `"neon"` (flat body + an additive accent edge-glow). `material:"flat"` opts back to the
  old clean solid fills. All of this is purely cosmetic — the screen rect, the clip, and the stable ids
  (`${id}-screen` / `${id}-screenbg` / `${id}-content`) are identical across materials and styles, so
  `deviceScreen` coords, existing `content`, and overlays are unaffected.
- **Auto-varied per instance.** Each device's cosmetics (bezel, corner, glare angle, neon hue) are
  derived deterministically from its `id`, so two devices differ while staying on-model. A new `seed`
  option pins or explores a variation (same seed → identical; different → same family). Reproducible —
  mulberry32, no `Math.random`/`Date`.
- **`notch?: "island" | "notch" | "punch" | "none"`** selects the phone front-camera treatment
  (default `"island"`). New opts `material` / `style` / `seed` / `notch`; new exported types
  `DeviceMaterial` / `DeviceStyle` / `DeviceNotch`.
- **Architecture.** The per-device `switch` is replaced by a `DeviceContext` + a reusable parts
  vocabulary (the material/lighting lives once) + a chassis registry, so adding a device is one entry,
  and the premium treatment is inherited for free. Back-compat: all public exports, the 10 names, the
  landscape transpose, the dimension tables, and the stable ids are preserved (goldens unchanged —
  devices are not in the snapshot set). Showcase: `examples/scenes/device-gallery.ts`.

## [0.6.34] - 2026-06-20

### Fixed

- **`autoFoley` now pans by a node's WORLD x, not its local x.** A child's local x is ~0 inside an
  offset group, so cues were panning hard-left on real (grouped) scenes; resolved via
  `nodeParentMatrix` at each event (device-hero auto-pans now spread across L/C/R). Gesture detection
  still uses local coords (camera-free).

## [0.6.33] - 2026-06-20

### Added

#### `autoFoley` — the animation scores its own SFX, deterministically

- **`audio: { autoFoley: true }`** derives sound cues from node motion with zero manual cues: a fast move
  → `whoosh`/`swish` at the velocity peak, a moving node that settles → `thud`/`knock`, a scale-in →
  `pop`, each panned by on-screen position. A pure analysis pass over the compiled motion (samples each
  node via the same deterministic `sampleProp` `evaluate` uses), so it's **deterministic and
  retime/regeneration-safe** — the sound follows when a step is retimed or the scene is regenerated.
  Manual `cues` still layer on top. Options: `{ gain, whoosh, impact, pop, pan, sensitivity, maxCues,
  nodes }` (co-moving nodes are de-duplicated; `maxCues` keeps the loudest). Also exported as `autoFoley`
  from `reframe-video`. Demo: `examples/scenes/auto-foley-demo.ts`. No peer code-as-video tool generates
  audio from motion — this is reframe's structural differentiator (research-backed).

### Changed

- **The 6 "hero" sfx default to their curated CC0 sample again** (`whoosh`/`rise`/`shimmer`/`thud`/`pop`/
  `tick`) — these recordings sound better than the synth for one-shot use, so a bare `sfx:` uses the
  sample (no audition needed). Unlike the old blanket name-override (removed in 0.6.29), this is an
  explicit curated set: every OTHER sfx name still synthesizes and auto-varies. Force the varying synth
  for a hero name per cue with `params: { synth: 1 }`. Tested both directions.

### Added

- **3 CC0 music beds** from cynicmusic (pixelsphere.org), via `bgm: { file }`: `bgm-synthwave.mp3`
  (chill), `bgm-piano.mp3` (elegant), `bgm-battle.mp3` (energetic) — alongside the existing
  `bgm-song21.mp3`. Re-encoded to mono 96 kbps to keep the package small; provenance in
  `assets/sfx/LICENSE.md`.
- `examples/scenes/sfx-compare.ts` — plays the six original sounds (whoosh/rise/shimmer/thud/pop/tick)
  **synth (`sfx:`) vs sample (`file: "<name>.wav"`)** back to back, to A/B which to keep as each
  name's default. (Both versions remain available; the synth recipes can be retuned, or a sample
  re-instated per name, after listening.)

### Added

- **31 curated CC0 sample sounds** (Kenney, public domain) in `assets/sfx/`, played via `file:` cues:
  - **UI** (Interface Sounds): `back` `close` `drop` `error` `glitch` `minimize` `switch` `toggle`
    (×2 each) + `scroll_001` `scratch_001`.
  - **impact / foley** (RPG Audio): `chop` `knifeSlice`(×2) `metalClick` `metalLatch` `metalPot1/2`
    `handleCoins`(×2) `doorOpen_1` `doorClose_1` `creak1` `bookFlip1`.
  - Provenance recorded in `assets/sfx/LICENSE.md`; `examples/scenes/sample-showcase.ts` auditions them.

### Changed

- **`sfx:` cues always synthesize now.** Previously a same-named vendored `.wav` in `assets/sfx/`
  (`whoosh`/`rise`/`tick`/`pop`/`thud`/`shimmer`) silently OVERRODE the synthesizer, so those six —
  the most-used sounds — never got the 0.6.27 pitch/auto-variation and sounded identical every time.
  The auto-override by name is removed: a bare `sfx:` name always uses the (varying) synth. A recorded
  sample is still available via an explicit `file: "whoosh.wav"` cue, so scenes that opt in are
  unchanged.

### Added

- `examples/scenes/sample-showcase.ts` auditions the CC0 sample library (keypress / footstep / the
  Kenney UI pack) — the recorded-`file:` layer, distinct from the procedural `sfx-showcase.ts`.

## [0.6.28] - 2026-06-20

### Added

- **12 more procedural sfx (21 → 33)** filling the categories the palette didn't reach:
  `swoosh` (rising transition); `glitch` `static` `scan` `powerup` `powerdown` (tech/digital); `sub`
  (sub-bass drop); `snare` `hat` (rhythm); `bubble` `notify` `camera` (foley). Same quality + guarantees
  as the 0.6.27 batch — seeded, pitch varies with `seed` (auto-assigned by cue order), deterministic,
  clamp-safe. `examples/scenes/sfx-showcase.ts` and the guide table cover them. (Keyboard/typing audio
  stays on `textTypeCues` + the CC0 samples, as before.)

## [0.6.27] - 2026-06-20

### Added

#### Richer, varied sound effects

- **The procedural sfx palette grew from 6 to 21** — added `swish` `riser` `warp` (transition),
  `click` `blip` `select` (ui), `boom` `knock` (impact), `chime` `ding` `coin` `sparkle` `success`
  (positive), `zap` `error` (alert), alongside the original `whoosh`/`pop`/`tick`/`rise`/`shimmer`/`thud`.
- **Repeats no longer sound identical.** A cue's `seed` now shifts the sound's PITCH (a musical step)
  and texture — not just the noise — and **defaults to the cue's order**, so a run of the same sfx
  becomes a little phrase with no setup. New `params.pitch` gives an explicit frequency multiplier.
  Still fully seeded/deterministic (same `(name, seed, pitch)` → byte-identical WAV).
- **Four new bgm beds** beside `ambient-pad`: `lofi`, `pulse`, `tension`, `uplift` (`bgm.synth`).
- A deterministic peak guard keeps every (possibly pitch-shifted) sfx clamp-safe. Demo:
  `examples/scenes/sfx-showcase.ts` auditions the whole palette. The sfx/bgm name sets are validated at
  compile time. **Note:** existing scenes' repeated cues now auto-vary (their audio is slightly richer).

## [0.6.26] - 2026-06-20

### Added

#### `cameraFit` — frame a region without clipping

- **New `cameraFit(box, { margin?, maxZoom?, size? })`** returns `{ x, y, zoom }` to spread into
  `cameraTo`, framing a scene-space bbox with padding and GUARANTEED not to clip it (the visible rect
  is `W/zoom × H/zoom`, so a hand-picked over-zoom crops the target; this computes the exact safe
  zoom). Fixes the recurring "push-in zooms past the content" problem. Pure math, no IR/golden change.

### Changed

- **Guide: two container-safety patterns.** The eDSL guide now documents `cameraTo(cameraFit(box))`
  for camera push-ins and the chart-in-a-panel pattern (size geometry from the container + wrap in a
  `clip`ped group) so charts can't overflow their boxes. `examples/scenes/annual-report.ts` rewritten
  to demonstrate both (bars/line normalized to their panels + clipped; the tour uses `cameraFit`).
## [0.6.25] - 2026-06-20

### Changed

#### Ease names are validated at compile time

- **`validateScene` (and therefore `reframe compile`) now rejects an unknown `ease`** with an
  actionable error listing the valid set, instead of letting it through to fail at render in the
  browser. A typo like `easeInOutSine` (there are no `*Sine` eases) is now caught in the ~1s cheap
  loop, not after a full render. Covers `tween` / `to` / `motionPath`; the `{ spring }` and
  `{ cubicBezier }` object forms still pass. Additive validation only — valid scenes and goldens are
  unchanged.
## [0.6.24] - 2026-06-20

### Changed

#### Ship the current authoring skill in the package (for SDK/Agent consumers)

- **Republish so the npm package bundles the current `skills/reframe/SKILL.md`** (the read-efficiency
  guidance — read the core, skim the specialized sections by heading). The marketplace tracks git
  `main`, but the npm-bundled skill only refreshes on a `reframe-video` publish, so SDK consumers that
  load the plugin from `node_modules/reframe-video` (e.g. an Agent-SDK app) were a skill behind. No
  code/IR/golden change — only the bundled skill bytes.

## [0.6.23] - 2026-06-20

### Changed

#### eDSL guide: a "Device frames" section so one-shot device requests use `devicePreset`

- **The authoring guide (`reframe guide`) now has a dedicated "Device frames" section** introducing
  `devicePreset("phone"/"browser"/"laptop"/…)` as the way to put a device on screen. It was only
  mentioned in passing (an analogy + the `deviceScreenPoint` cursor helper), so a one-shot request
  like "float a phone" tended to hand-draw the device from `rect`s instead of using the parametric
  preset (notch/dynamic island, chrome, clipped screen content). Also notes there is no `"iphone"` —
  `"phone"` is the iOS-style frame. Docs only — no code/IR/golden change.

## [0.6.22] - 2026-06-19

### Changed

#### `reframe guide --html` + guides moved to `docs/guides/`

- **New `reframe guide --html`** prints the HTML/GSAP authoring guide. The HTML render mode
  (`reframe render scene.html`) was already live but its guide was shipped nowhere and exposed by
  no command — now it ships in the package and is reachable like the other guides.
- **Authoring guides moved from `benchmark/guides/` to `docs/guides/`** (source-of-truth cleanup:
  `benchmark/` is for frozen experiment artifacts, but the guides are living docs). No change to the
  packaged layout — they still ship flat under `guides/`. The `guide` command now fails with a clear
  `guide not found: <path>` instead of a raw filesystem error when a guide is missing.
- Internal: the CLI's guide-path resolution and the package build's guide copy were consolidated
  (single `GUIDE` map / `GUIDES` manifest + post-copy validation). No IR/golden change.

## [0.6.21] - 2026-06-19

### Changed

#### Agent verify-loop docs: the cheap `compile → frame → render` tiering

- **`skills/reframe/SKILL.md` and the directing guide now teach the cheap inner loop.** They used to
  tell the authoring agent to full-render (`render`, ~12s) after every change and ffmpeg-extract
  frames to look — the slowest path. They now route iteration through `compile` (validate eDSL → IR,
  ~1s, no browser/ffmpeg) then `frame --t <sec>` (one PNG, ~1s, no mux), reserving `render` for the
  final mp4. The directing guide also flags `motion`/`trace` as end-stage measurement, not per-edit.
  Docs only — no code, IR, or golden change (the `compile`/`frame` commands shipped in 0.6.20).

## [0.6.20] - 2026-06-19

### Added

#### `reframe frame` — render one frame at time `t` to a PNG

- **New `reframe frame <scene.ts|.json> [--t <sec>] [-o out.png]`** — render exactly one frame at
  time `t` to a PNG, using the same renderer as `render` but without the video muxing (chromium, no
  ffmpeg). For an agentic "render-and-look" loop: show the model its own output (no reference, no
  full mp4) so it can refine composition/quality. Pairs with `compile` and `diff`.

#### Portable skill/plugin for Agent-SDK consumers

- **The Claude Code plugin + skill now ship in the package** (`.claude-plugin/` + `skills/` added to
  the published `files`), so an SDK/agent consumer with only `reframe-video` from npm — no repo
  checkout — can point a local-plugin loader at `node_modules/reframe-video`. `SKILL.md` is already
  portable (it directs agents to `reframe-video guide`, not repo files).
- **New `reframe skill`** prints `SKILL.md` (for an agent that injects the instructions as text);
  `reframe skill --path` prints the plugin root directory to load.

## [0.6.19] - 2026-06-19

### Added

#### Public canvas renderer (`reframe-video/renderer`)

- **Export `renderFrame` / `drawDisplayList`** (plus the `ImageRegistry` / `VideoRegistry`
  interfaces) as a `reframe-video/renderer` subpath, so a browser app can draw scenes to a 2D
  canvas **identically to the mp4 path** — camera, clips, track mattes, group effects, gradients,
  and images/video all handled by the engine. Downstream consumers can delete a hand-rolled
  renderer fork and stay in sync. The published bundle self-imports `reframe-video`, so a consumer
  shares the one core instance (no duplicate `evaluate`). Additive — the default `.` entry is
  unchanged.

#### `reframe compile` — eDSL source → validated SceneIR JSON (no render)

- **New `reframe compile <scene.ts|.json> [-o out.json] [--stdin] [--code "<src>"] [--json]`** —
  bundle + validate a scene to **SceneIR JSON without rendering** (no ffmpeg/chromium; fast). For a
  consumer that needs the IR for a canvas preview, a semantic-diff loop, or an agentic
  self-correction loop.
- **Clean, classified errors**: a failing scene exits non-zero with a concise message tagged
  `bundle` / `eval` / `validation` (`--json` ⇒ `{ ok:false, error, kind }`), instead of the ~64KB
  base64 bundle dump `labels` / `render` printed before. `labels` is cleaned up the same way.
- **In-process loader** exported as `reframe-video/compile` (`loadScene` / `loadSceneFromCode` /
  `SceneLoadError`), server/Node-only, for embedders that want the IR without shelling out.
  `--timeout` bounds the bundle+eval.

## [0.6.18] - 2026-06-18

### Added

#### Audio mixing: fades + stereo pan

- **Cue `fadeIn` / `fadeOut` / `pan`** and **video-clip `fadeIn` / `pan`** — `fadeIn`/`fadeOut` are
  seconds (`afade`), `pan` is stereo balance (-1 left … 0 centre … +1 right). They let a sound cue
  ramp in/out and sit left or right in the field, and a clip's audio fade in and be placed in the
  stereo image. Both flow through the deterministic AudioPlan into the ffmpeg filter chain; absent /
  zero ⇒ the chain is **byte-identical** to before (additive). Note: clip *fade-out* and clip-driven
  bed ducking are not included — a clip has no fixed length in the plan (cue ducking already exists).

## [0.6.17] - 2026-06-18

### Added

#### z-sort occlusion

- **`camera.zSort`** — opt-in depth-ordered paint (requires `perspective`). When `true`, siblings
  at each level are drawn far→near (larger world `z` first) so nearer nodes occlude farther ones
  without hand-ordering the tree; the order re-sorts every frame as depth animates. A `fixed` HUD
  stays on top, and a track-matte group keeps its child order (the first child is the mask). It's a
  stable sort, so equal-depth siblings keep their authored order. Off by default ⇒ paint stays
  array order ⇒ **byte-identical** (golden-safe). Gotcha documented: under `zSort` a full-screen
  background rect at `z: 0` is the nearest plane and paints on top — use the scene `background` or a
  far `z`. Demo: `examples/scenes/zsort-demo.ts`.

## [0.6.16] - 2026-06-18

### Added

#### Depth of field (z-blur)

- **`camera.aperture` + `camera.focus`** — a lens depth-of-field layered on the 2.5D perspective.
  With perspective active, a drawn layer at depth `d` gains `aperture · |d − focus|` screen-pixels of
  blur on top of any authored blur, so the focal plane stays sharp while near/far layers soften.
  Both are keyframable: animate `focus` for a **rack focus**, `aperture` for an iris pull. The blur
  feeds the existing `blur` op field, so the **renderer is untouched**; a `fixed` HUD node opts out
  of DOF (it's out of the camera). Gated by perspective and `aperture > 0`, so non-perspective and
  no-aperture scenes stay **byte-identical** (golden-safe). Demo: `examples/scenes/dof-demo.ts`.

## [0.6.15] - 2026-06-18

### Added

#### Spring physics easing

- **Spring eases** — a damped harmonic oscillator (mass-spring-damper) as a normalized 0..1 easing
  that settles to rest within the tween's duration. Three named presets — `spring` (a natural
  settle), `springBouncy` (low damping, rings past the target), `springStiff` (high damping, snappy,
  barely overshoots) — plus a custom form `{ spring: { stiffness?, damping?, velocity? } }` where the
  damping ratio `ζ = damping / (2·√stiffness)` shapes the overshoot and `velocity` is an initial
  launch slope. Works anywhere an `ease` is accepted (`tween`/`to`/`motionPath`/presets). Pure and
  deterministic (same `Math.exp/cos/sin` family as the elastic eases); endpoints are pinned to
  `f(0)=0` / `f(1)=1`. Additive / golden-safe: no existing scene names a spring, so every snapshot is
  byte-identical. Demo: `examples/scenes/spring-demo.ts`.

## [0.6.14] - 2026-06-18

### Fixed

#### Onboarding ergonomics (surfaced by a fresh-agent dogfood of the directing loop)

- **`reframe render scene.ts -o out`** no longer fails with a cryptic ffmpeg "Invalid argument"
  muxer error. An `-o` value with no file extension is now treated as a **directory** (matching the
  docs' "mp4 into `out/`"): the dir is created and the file is written as `<dir>/<scene>.mp4`.
- **Static frames don't need a throwaway timeline.** A scene with no `timeline` (or one that
  produces no animated spans) now renders as a 1s still instead of crashing on an
  undefined duration. Set scene `duration` to override. Golden-safe: animated scenes always infer
  `> 0`, so the fallback only fires when nothing animates.

### Changed

- Guides: clarified that **text alignment is the `anchor` prop** (no separate `align`), that the
  `diff --mode grid` overlay is **full-resolution** (printed numbers are exact scene pixels), and
  that `diff`/`blend` are noisy over large soft gradients/glows (tune those by eye with `--mode
  side`).

## [0.6.13] - 2026-06-18

### Added

#### Making high-end pieces easier: a director workflow + `reframe diff`

- **`reframe diff <ref-image> [<scene.ts>] [--t S] [--mode side|blend|diff|grid]`** — the
  reference-matching tool. Renders a scene's frame at `t` and composites it against a reference
  image so an agent iterates toward a faithful match instead of eyeballing: `side` (reference |
  render), `blend` (50% overlay), `diff` (absolute pixel difference), and `grid` (a labelled 100px
  coordinate grid over the reference ALONE — to measure a screenshot before any render exists).
- **`reframe guide --directing`** — a new high-end / reference-heavy workflow guide (kept separate
  from the lean syntax guide): what to get from the user, storyboard the beats first, match
  references with `diff`, a cinematic-craft checklist (camera push-in per beat, curved entrances,
  depth rig, layered idle, label-anchored sound), and verify objectively with `labels`/`motion`/
  `trace`. The skill (`skills/reframe/SKILL.md`) gains a "Directing a high-end piece" section that
  surfaces these and the existing-but-buried iteration tools.

## [0.6.12] - 2026-06-18

### Added

#### On-ramp ergonomics (from a fresh-user test)

- **`prefix` / `suffix` on `text`** — a numeric count-up can now read `$2.4M` or
  `+32%` from ONE node (`{ content: 2.4, contentDecimals: 1, prefix: "$", suffix: "M" }`)
  instead of three hand-positioned nodes. Affixes wrap the (possibly counting-up)
  value; absent ⇒ content unchanged (golden-safe).
- **Layout helpers** `row` / `column` / `grid` (`@reframe/core`) — pure coordinate
  math for evenly spacing a row of cards or a grid of tiles, so you don't hand-roll
  the column math. They return coordinates to spread into node `x`/`y`.

### Docs

- Guide: document `prefix`/`suffix`, the layout helpers, `contentThousands`, and
  `wait(seconds, label?)`; note that `examples/scenes/…` pointers are repo-only (not
  in the npm package), so the guide is self-contained.

## [0.6.11] - 2026-06-18

### Added

#### Projected 2.5D perspective (depth, card flips, dolly)

- New animatable props: `z` (depth), `rotateX` / `rotateY` (3D tilt) on any node, and
  `camera.perspective` (focal distance, the activation switch). Set `camera.perspective`
  and nodes project about the optical centre with `p = perspective / (perspective + z)`:
  vanishing-point depth, **parallax** (a camera pan moves near layers more than far ones),
  **card flips** (`rotateY`), perspective text (per-glyph `z`), and **dolly** (animate
  `camera.perspective`).
- All math is a pure step in `evaluate()` that projects down to the existing 2D affine
  matrix — **the Canvas renderer is untouched**, so renders stay byte-identical-deterministic
  and portable. Gated by a `hasPerspective` flag: a scene without `camera.perspective` takes
  the exact prior path, so existing golden DisplayLists are unchanged. A tilted group
  foreshortens its whole subtree; clips project by their group's depth; a `fixed` HUD opts out
  of depth (perspective is part of the camera).
- **Honest limit:** a single rotated quad under perspective is a real trapezoid Canvas 2D
  can't draw exactly; `rotateX`/`rotateY` are an affine approximation (cos-foreshorten +
  keystone skew) — convincing for flips/tilts, not pixel-true. Depth positioning (parallax,
  convergence, dolly) is exact. Paint order stays array order (`z` does not reorder draws).
- New demo `examples/scenes/perspective-cards.ts` (parallax depth field + card flip +
  perspective text + dolly).

## [0.6.10] - 2026-06-18

### Added

#### Group composite effects (blur / shadow / blend on a whole group)

- `blur` / `shadowColor` (+`shadowBlur`/`shadowX`/`shadowY`) / `blend` on a `group` now
  apply to the **whole subtree as one composite layer** — a true focus pull on a
  multi-node lockup, a single silhouette drop shadow under a multi-shape mark, and a group
  that blends against the background as one layer (overlaps composite together, not per
  child). Previously these were no-ops on a group.
- Reuses the offscreen subtree compositing from track mattes: `evaluate` emits
  `group-fx-push`/`group-fx-pop` boundary-marker ops (only when a group sets one of these
  effects, so existing golden DisplayLists stay byte-identical), and the renderer renders
  the subtree to an offscreen canvas and draws it back once with the effect applied. The
  group blur is **animatable** (`tween(group, { blur })`), wraps a matte group's sequence,
  and nests. Deterministic same-machine.
- New demo `examples/scenes/group-fx-demo.ts` (focus-pull lockup + group shadow + screen-blended burst).

## [0.6.9] - 2026-06-18

### Added

#### Track mattes / alpha masks

- `matte?: "alpha" | "luma"` on a `group`: the group's **first child masks the rest** —
  `"alpha"` keeps content where the matte is opaque (video-filled text, shape / PNG
  punch-through), `"luma"` where it's bright (gradient/shape wipes). Needs ≥2 children.
- reframe's first **offscreen subtree compositing**: `evaluate` emits
  `matte-push`/`matte-sep`/`matte-pop` boundary-marker ops (only for matte groups, so
  existing golden DisplayLists stay byte-identical), and the renderer keeps a stack of
  offscreen canvases, rendering the matte + content to separate buffers and combining
  them with `destination-in` (luma runs a luminance→alpha pass first). Mattes nest; the
  group's transform / opacity / clip apply as usual. Deterministic same-machine.
- New demo `examples/scenes/matte-demo.ts` (video-filled "REFRAME" + an iris luma wipe).

## [0.6.8] - 2026-06-18

### Added

#### `videoMontage` — mixed photo + clip montages

- The montage generator now mixes **images and video clips** in one cut: a video
  src (detected by extension) plays as a clip for its `hold`, with crossfades + Ken
  Burns + grade composing exactly as for stills. `videoMontage` is exported as the
  clip-driven name (same generator as `photoMontage`, which also gained the ability).
- A video shot's clip audio is **muted by default** in a montage (to avoid stacking
  soundtracks); set a per-shot `volume` to include it. Clips begin playing at their
  slot's start time.
- New demo `examples/scenes/video-montage.ts` (the CC0 photos + the video-demo clip).

### Changed

- Capture page decodes video frames with **bounded concurrency** — a long clip's many
  concurrent `img.decode()` calls (especially alongside image layers) could spuriously
  fail under memory pressure; frames now decode in small batches.

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

[Unreleased]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.18...HEAD
[0.6.18]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.17...v0.6.18
[0.6.17]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.16...v0.6.17
[0.6.16]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.15...v0.6.16
[0.6.15]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.14...v0.6.15
[0.6.14]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.13...v0.6.14
[0.6.13]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.12...v0.6.13
[0.6.12]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.11...v0.6.12
[0.6.11]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.10...v0.6.11
[0.6.10]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.9...v0.6.10
[0.6.9]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.8...v0.6.9
[0.6.8]: https://github.com/kiyeonjeon21/reframe/compare/v0.6.7...v0.6.8
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
