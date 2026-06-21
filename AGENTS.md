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
- `pnpm reframe labels <scene.ts>` — print the compiled event clock (every timeline label → exact seconds; the timing source for `audio.cues` and beat debugging)
- `pnpm reframe compile <scene.ts|.json> [-o out.json] [--stdin] [--code "<src>"] [--json]` — bundle + validate eDSL source into SceneIR JSON, NO render (no ffmpeg/chromium; fast). On failure: a concise classified error (`bundle`/`eval`/`validation`), never the base64 bundle; `--json` makes it `{ok:false,error,kind,issues?}` where `issues` is the structured validation problems (each `{code,path,message}` — e.g. `code:"unknown-blend", path:"nodes.box"`). The in-process equivalent is exported as `reframe-video/compile` (`loadScene`/`loadSceneFromCode`/`checkDeterminism`, server-only); a thrown `SceneValidationError` carries `.issues` (and `.problems` for back-compat), and `SceneLoadError.issues` propagates them across the scene bundle. Entry `packages/render-cli/src/compile.ts`; loader `loadScene.ts`.
- `pnpm reframe frame <scene.ts|.json> [--t <sec>] [-o out.png]` — render ONE frame at time `t` to a PNG (same renderer as `render`, no ffmpeg muxing; chromium only). For an agentic render-and-look loop (feed the frame back to a model). Reuses `renderFrameAt` (`frameLoop.ts`); entry `packages/render-cli/src/frame.ts`.
- `pnpm reframe assemble <media...> [-o name] [--title "…"] [--bgm <synth>] [--hold s] [--seed N]` — the **files → scene** path: probe each image/video for its real duration (ffprobe) and scaffold an editable montage scene `.ts` wiring `photoMontage` (clip-aware holds, no freeze) + an optional `title` + a music bed. Probed numbers are baked in → the emitted scene is a normal deterministic scene. Probe `packages/render-cli/src/media/probe.ts`; entry `assemble.ts`.
- `pnpm reframe narrate <scene.ts|.json> [--voice <name>] [--max-speed n] [--script <path>] [--dry-run]` — **scene-fitted Kokoro voiceover**. Reads a sibling `<scene>-vo/script.json` of `{ at, text }` lines (imported into `audio.narration`), computes each line's slot from the compiled label clock, synthesizes it with a Kokoro python sidecar (`narrate.py`), and **auto-fits** its speech rate to the slot (bounded by `--max-speed`, default 1.3; warns if even max overruns). Bakes `file`/`voice`/`speed`/`duration` back into `script.json` (like `assemble` bakes ffprobe numbers); the scene then plays each line as a label-anchored `file` cue (survives retiming/regen) with the bed ducking under the whole utterance. `--dry-run` prints the fit table from a length *estimate* (no synthesis, no Kokoro needed). Kokoro is an **optional dep** (`pip install kokoro` + espeak-ng), preflighted like ffmpeg/chromium; the `.wav` are external assets (same-machine, not golden) — commit `script.json` + wavs together. Entry `packages/render-cli/src/narrate.ts` + sidecar `narrate.py`; the IR field is `AudioIR.narration` (`packages/core/src/ir.ts`), resolved in `resolveAudioPlan` (`audio.ts`). See `examples/scenes/narrated-demo.ts`.
- `pnpm reframe manifest <scene.ts|.json> [--json]` — dump the scene's **addressable surface**: every node (+ its `editableProps` and `animatedProps`), state, timeline label (+ `patchable` params), beat, and behavior, each with the overlay address that reaches it. The map an AI/human editor reads to patch a scene surgically (vs regenerating). Core `sceneManifest(compiled)` (`packages/core/src/manifest.ts`, exported); entry `packages/render-cli/src/manifest.ts`.
- `pnpm reframe lint <scene.ts|.json> [--json] [--strict]` — the **studio-readiness gate**: (a) flag un-addressable motion (a tween/to/motionPath with no `label` can't be retimed by an overlay and a regen can silently drop it) + a `motionAddressableRatio` summary, and (b) for a `.ts` source, verify the scene is a **pure function of time** (`non-deterministic-render` finding) — it bundles once and evaluates TWICE, reporting the first IR address that differs (e.g. a `Math.random()`/`Date` baked into a prop), since a non-pure scene silently compiles to a different IR each time. `--strict` exits non-zero on findings (CI gate). Core `lintScene(compiled)` (addressability); `checkDeterminism(path)` (purity, exported via `reframe-video/compile`, `packages/render-cli/src/determinism.ts`); entry `lint.ts`.
- `pnpm reframe verify-overlay <base.ts|.json> <overlay.json>... [--json]` — compose an overlay onto a base and report applied-vs-orphaned, NO render. The regen-survival check: run vs the original base (all applied), then vs the AI-regenerated base — any orphan is a broken stable address. Non-zero exit on orphans (CI gate). Reuses `composeScene`/`formatComposeReport`; entry `verifyOverlay.ts`.
- `pnpm reframe compose <scene.ts|.json> --overlay <doc.json>... [-o out.json] [--json]` — compose overlay(s) onto a scene and emit the composed **SceneIR**, NO render. This is the **IR half** of `composeScene` (`verify-overlay` is its report half); base may be a `.ts` source OR a `.json` IR (composition is a post-compile IR→IR transform). stdout stays a bare SceneIR (pipe straight to `player`/`frame`); the applied/orphan report goes to **stderr** (`--json` makes it machine-readable). **Non-gating** — orphans are reported but the partial IR is still emitted (use `verify-overlay` to gate). The live-overlay-preview path: `manifest --json` → build an `OverlayDoc` → `compose` → `player`. Pure/deterministic (same base+overlays → byte-identical IR). Entry `packages/render-cli/src/compose.ts`; shared `applyOverlays` helper (`overlay.ts`). **`--overlay` is also accepted on `frame` and `player`** (compose-then-preview in one step, like `render --overlay`); `compile` does NOT compose (it errors with a pointer — `compile` is source→IR only).
- `pnpm reframe skill [--path]` — print the authoring skill (`plugin/skills/reframe/SKILL.md`) for a programmatic/agent consumer; `--path` prints the plugin root dir. The skill + `.claude-plugin/` ship in the npm package (`files`) so an Agent-SDK consumer can load the plugin from `node_modules/reframe-video` (no repo checkout). Inline in `reframe.ts`.
- `pnpm reframe player <scene.ts|.json> [-o out.html]` — bundle a scene into ONE self-contained HTML that plays the motion live in any browser (and pastes into a Claude.ai Artifact). esbuild IIFE of core + `renderer-canvas` + the scene on a `<canvas>` rAF loop, with the Inter fonts inlined; visual-only (no audio / image-node sources). Entry `packages/render-cli/src/player.ts`.
- `pnpm reframe preview` / `new <name>` / `motion <mp4>` / `trace <ref.mp4>` / `guide [--directing|--regen|--html]` / `demo` — `guide` prints the eDSL syntax (default), the high-end directing workflow (`--directing`), the stable-address contract (`--regen`), or the HTML/GSAP scene guide (`--html`); sources live in `docs/guides/`
- `pnpm test` (vitest), `pnpm typecheck`

## Authoring scenes — read the guide first

Before writing or modifying any scene (.ts), **read
`docs/guides/edsl-guide.md`** — it is the complete, current syntax.
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
  `d` is animatable: `tween(id,{d:other})` morphs the shape vertex-by-vertex
  (Lottie-style) when both `d`s share command structure; arcs `A` can't morph
  (`packages/core/src/interpolate.ts`).
- `motionPath(target, points, opts)` — Catmull-Rom curve driving x/y (+ tangent
  `autoRotate`); holds the end. Pure math in `packages/core/src/path.ts`.
- Gradients (`packages/core/src/gradient.ts`) — `fill`/`stroke` on rect/ellipse/path
  accept a `Gradient` (`Paint = string | Gradient`) via `linearGradient`/`radialGradient`/
  `conicGradient`. Coords are normalized to the node's bbox (0..1); the renderer
  (`renderer-canvas` `resolvePaint`) builds the Canvas gradient in node-local space.
  **Static** (not keyframed) — animate the NODE's transform and the gradient sweeps with
  it. Additive/golden-safe: a string fill takes the exact existing path (no new op fields);
  a gradient bypasses the string-coercing `opt()` and a path op gains a `bbox`. See
  `examples/scenes/gradient-demo.ts`.
- Shadow / glow / blur (`packages/core/src/effects.ts`) — `blur` / `shadowColor` /
  `shadowBlur` / `shadowX` / `shadowY` on drawable nodes (screen-pixel space), built with
  `glow(color,blur)` / `dropShadow(color,blur,x,y)`. **Animatable scalars** (sampled via
  `num`/`opt` → pulse a glow with `oscillate(id,"shadowBlur",…)`, pull focus with
  `tween(id,{blur:0})`). The renderer sets `ctx.filter`/`ctx.shadow*` after `setTransform`
  (per-op `save/restore` isolates them). Additive/golden-safe (absent → no op fields).
  No-op on `group` (composite blur is a later add). See `examples/scenes/shadow-demo.ts`.
- Blend modes — `blend?: BlendMode` on drawable nodes selects compositing with what's
  beneath (`screen`/`add` additive light, `multiply` tint, `overlay`/`soft-light` grade,
  …; default `normal`). **Discrete** (a static string, not keyframed); the renderer maps
  it to `ctx.globalCompositeOperation` after `setTransform` (`add`→`lighter`), isolated by
  the per-op `save/restore`. Additive/golden-safe (absent/`normal` → no op field). No-op on
  `group` (whole-subtree blend is a later add). See `examples/scenes/blend-demo.ts`.
- Track mattes — `GroupProps.matte?: MatteMode` (`"alpha"|"luma"`): a matte group's FIRST
  child masks the rest (alpha = where opaque, luma = where bright). The first feature using
  **offscreen subtree compositing**: `evaluate` emits `matte-push`/`matte-sep`/`matte-pop`
  boundary-marker DisplayOps (only for matte groups → goldens byte-identical); the renderer
  (`drawDisplayList`) keeps a stack of offscreen canvases, renders the matte + content to
  separate buffers, and combines via `destination-in` (luma runs a `lumaToAlpha` pass first).
  Needs ≥2 children (validated). Same offscreen mechanism unblocks group blur/blend later.
  Browser-only, deterministic same-machine. See `examples/scenes/matte-demo.ts`.
- Group effects — `blur` / `shadowColor`(+`shadowBlur`/`shadowX`/`shadowY`) / `blend` on a
  **group** now apply to the whole subtree as ONE composite (focus-pull a multi-node lockup,
  one silhouette shadow under a multi-shape mark, blend a group against the bg as a single
  layer — overlaps composite together, not per child). Reuses the matte offscreen mechanism:
  `evaluate` emits `group-fx-push`/`group-fx-pop` markers (only when a group sets one of these
  → goldens byte-identical); `drawDisplayList` renders the subtree offscreen and draws it back
  once with `ctx.filter`/`ctx.shadow*`/`globalCompositeOperation`. Group blur is animatable
  (`tween(group,{blur})`), wraps a matte group, and nests. See `examples/scenes/group-fx-demo.ts`.
- Camera (`packages/core/src/camera.ts`) — a scene-level `camera` field (look-at
  `{x,y}` + `zoom` + `rotation`, defaults = identity) keyframed via `cameraTo` /
  the reserved `"camera"` tween/motionPath/behavior target. One global matrix at
  the root of `evaluate`'s walk (`hasCamera` gates it → no-camera scenes stay
  byte-identical); a top-level node's `fixed:true` pins it to the screen (HUD).
  A node literally named `"camera"` keeps node semantics (back-compat). See
  `examples/scenes/camera-demo.ts`.
- Projected 2.5D perspective (`evaluate.ts` `projectDepth`/`tiltSkew`) — `z` (depth) +
  `rotateX`/`rotateY` (3D tilt) on any node, switched on by `camera.perspective` (focal
  distance). Projection is a pure step in `evaluate` (`p = perspective/(perspective+z)` about
  the frame centre) that collapses to the existing `Mat2D` → **renderer untouched**, gated by
  `hasPerspective` so no-perspective scenes stay byte-identical. Gives vanishing-point depth,
  parallax (pan the camera), card flips (`rotateY`), perspective text (per-glyph `z`), dolly
  (animate `camera.perspective`). A tilted GROUP foreshortens its subtree; clips project by the
  group depth; `fixed` HUD opts out. **Affine approximation** for rotated quads (cos + keystone
  skew, not a true trapezoid — that's WebGL); depth positioning is exact; paint order unchanged
  (`z` ≠ z-index). See `examples/scenes/perspective-cards.ts`.
- Character rig (`packages/core/src/rig.ts`) — `humanoid(opts)` / `rig(boneTree,
  opts)` compile a declarative skeleton to a NodeIR group tree (joints =
  `${id}-${name}`, the **stable regen addresses**); FK posing via `poseTo(id,
  pose)` / `rigPose(id, pose)`; 2-bone `ikReach(upper,lower,dx,dy)`. The
  character analog of `devicePreset` — additive, golden-safe, no renderer change.
- `characterPreset(name, opts)` (`packages/core/src/characterPreset.ts`) — a
  seeded motion generator for a humanoid/figure rig (the character analog of
  `motionPreset`); returns a composable `beat`. Names: walk/run/jump/dance/wave/
  cheer; knobs target/energy/speed/seed/cycles/facing/at/travel/label. Legs via
  `ikReach`, arms FK; deterministic, pure keyframes.
- `figure(opts)` (`packages/core/src/figure.ts`) — a dressed character on the
  humanoid skeleton: `style` "clean" (corporate-flat/undraw) | "cute", `palette`
  knobs (skin/hair/top/pants/shoe/accent; clean's top follows accent), `face`.
  Exposes the humanoid joint ids → `characterPreset`/`ikReach` drive it. The
  premium-promo skin; product is the hero (see `examples/scenes/product-promo.ts`).
- Kinetic text (`packages/core/src/textFx.ts`) — `splitText(text, opts)` splits a
  phrase into per-glyph `text` nodes (real Inter advances from
  `textMetrics.ts`, generated by `packages/render-cli/scripts/gen-text-metrics.ts`);
  seeded `textIn` (typewriter/cascade/rise/bounce/assemble/decode), `textLoop`
  (wave/shimmer/wobble/float → behaviors), `textOut` (shatter/fly/dissolve/fall/
  collapse), `textTypeCues` (per-glyph keypress audio). The text analog of motionPreset.
- Titles / lower-thirds (`packages/core/src/titles.ts`) — `title(opts)` (kinetic headline:
  `splitText` + `textIn` entrance + optional `textOut` exit; returns `{ nodes, timeline, block }`,
  labels `${id}-in`/`${id}-out`) and `lowerThird(opts)` (name/role strap with an accent bar,
  `{ nodes, timeline }`, ids `${id}-bar`/`-name`/`-role`). The motion-graphic overlay vocabulary
  for a media piece; what `reframe assemble` wires over a montage. Pure/seeded/golden-safe.
- Label-anchored beats (`packages/core/src/compile.ts`) — a `beat`'s `at` accepts a
  **label string** (not just a number): `beat("cap", { at: "shot-2" }, […])` starts at the
  `shot-2` label's time (`gap` = offset), so an overlaid title/strap stays synced when the cut
  is retimed (overlay or regen) — the retime-survival `audio.cues` already have. A gated
  `labelClock` pre-pass resolves it (order-independent); numeric/absent `at` is byte-identical
  (goldens unchanged). Keep anchored beats in a `par` branch. Validated against known labels.
- Authoring ergonomics — `text` `prefix`/`suffix` wrap a numeric count-up so `$2.4M`/`+32%`
  read from ONE node (`packages/core/src/evaluate.ts` text case; golden-safe). Layout helpers
  `row`/`column`/`grid` (`packages/core/src/layout.ts`) return evenly-spaced coordinates to
  spread into node `x`/`y` (a row of cards, a grid of tiles) — pure math, no nodes. Both
  added after a fresh-user reproducibility test flagged hand-positioned affixes + absolute-only
  layout as the main friction.
- Photo/video montage (`packages/core/src/montage.ts`) — `photoMontage(shots, opts)` /
  `videoMontage` (same generator) turn a list of shots — images AND video clips, mixed
  (video detected by src extension, plays as a clip for its `hold`, audio muted by default
  unless a shot sets `volume`) — into a slideshow: crossfades + **seeded Ken Burns**
  (pan/zoom) + an optional cinematic grade (vignette + scrim via gradient + blend). Returns
  `{ nodes, timeline }` (owns its image/video layers, like `splitText` owns glyphs). **Each
  shot is a SELF-CONTAINED named beat `shot-${i}`** that owns only its own layer's motion
  (fade-in ∥ Ken Burns ∥ fade-out); every layer starts at `opacity: 0` and adjacent shots
  overlap by the crossfade via a negative `gap` in the `seq` (so `shot-${i}` t0 = the shot's
  start, the address a clip `start`/anchored title resolves to). Because no shot references
  another, a shot is **structurally editable by overlay and survives regen**: reorder via the
  beat `order` patch, drop via `removeTimeline: ["shot-2"]` (its layer just stays invisible),
  insert via `insertNodes` + `insertTimeline {into:"montage"}` (the "montage" beat groups the
  shots directly so its play order is addressable; the new shot's node+beat JSON is authored by
  the consumer, not generated), swap its image via a `nodes.<id>.src` patch — see
  `docs/guides/regen-contract.md`, `examples/overlays/montage-restructure.json`, and
  `examples/overlays/montage-insert.json`. Stable addresses `${id}-${i}`; labels
  `shot-${i}` (beat = shot start), `shot-${i}-in`/`-kb` (fade-in / Ken Burns), `cross-${i}`
  (crossfade into shot i), `shot-${last}-out` (closing fade) — every generated tween is
  labelled, so the motion is fully addressable / lint-clean. Each layer uses the image
  node's `fit: "cover"` (crop-to-fill at
  the image's aspect, renderer-side via `coverRect` — no pre-cropping, any aspect); the Ken
  Burns keeps `scale ≥ 1` + bounded pan so no edge shows. The montage opens on a fade-up and
  closes on a fade-out (symmetric → edit-safe). Pure/seeded. Image sources
  don't render in `player`/artifacts → mp4 only. Demo: `examples/scenes/photo-montage.ts`
  (CC0 images under `examples/scenes/photo-montage/`, NOT bundled to npm). The photo
  analog of motionPreset.
- Video clip (`video` node, `packages/core/src/ir.ts` + `render-cli/src/videos.ts`) — draw a
  clip as a layer; plays on the scene clock (`frame = round((clipStart + max(0,t-start)*rate)*fps)`,
  computed purely in `evaluate` from `compiled.ir.fps`). **`start` may be a label string** (not just
  a number): it resolves to that timeline label's t0 (in `evaluate` + `collectClipAudio`, via
  `compiled.labelTimes`), so a clip **ripples** when its shot is retimed; `photoMontage` anchors each
  clip to its `shot-${i}` label. Numeric `start` is byte-identical (render-cli over-extracts for a
  string `start`). Deterministic by **frame extraction**:
  render-cli runs `ffmpeg -vf fps=<sceneFps>` (`buildVideoFrameAssets`), the capture page decodes
  them into a `VideoRegistry`, and the renderer draws `frame` via the shared `drawRaster` (cover
  like image) — NOT a live `<video>` seek, so byte-identical (same machine). Props src/width/height/
  fit/start/rate/clipStart/volume. **Clip audio** is muxed in: `resolveAudioPlan` emits a
  `clipAudio[]` (per video node, anchored to its numeric `start`, `volume:0` mutes), and
  `render-cli/src/audio` extracts each clip's track (`ffprobe`+`ffmpeg -vn`, silent clips skipped)
  and adds an `atrim/atempo/adelay/volume` chain into the existing `amix` (`mux.ts`). Pre-decodes
  all frames so keep clips short; not in `player`/artifacts (mp4 only). Demo:
  `examples/scenes/video-demo.ts` (procedural clip + tone under `examples/scenes/video-demo/`, not npm-bundled).
- Cursor (`packages/core/src/cursor.ts`) — `cursor(opts)` node (arrow/dot/ring,
  hotspot at the origin) + `cursorTo`/`cursorPath` (human arcs via motionPath) +
  `cursorClick`/`cursorDouble` (tap + ripple + button press). `deviceScreenPoint`
  (`devicePreset.ts`) maps screen-local UI coords → scene so the cursor clicks UI
  inside a device. The UI-demo motion vocabulary; see `examples/scenes/product-promo.ts`.
- Logo sting: `labs/logo-sting/` (`generate.mts` + `template.ts`); a sample
  `logo.svg` is committed. (The published `reframe logo` command is separate —
  `packages/render-cli/src/logoSting.ts`; this is a standalone generator example.)

## Regeneration contract — stable addresses

When regenerating or rewriting an existing scene, **never rename node `id`s,
state names, or timeline `label`s** for concepts that survive the redesign —
overlay documents hold human edits at those addresses. Full contract:
`docs/guides/regen-contract.md`. Overlay schema by example:
`examples/overlays/brand-edits.json`.

## Repo map

- `packages/core` — eDSL/IR/compile/evaluate/composeScene, presets, path,
  motionPath (zero deps; tests in `test/`)
- `packages/renderer-canvas` — DisplayList → Canvas 2D. Its `renderFrame` /
  `drawDisplayList` are re-exported from the published package as
  `reframe-video/renderer` (a subpath export) for live browser preview — the
  bundle self-imports `reframe-video` so a consumer shares the one core instance
- `packages/render-cli` — Playwright capture + ffmpeg; `reframe.ts` is the user CLI
- `packages/preview` — Vite editor (edits → overlay draft, `window.__store` debug hook)
- `packages/reframe-video` — the published npm package (see Release below)
- `plugin/` — the Claude Code plugin, scoped to its own subdir so the marketplace
  caches only it (`plugin/.claude-plugin/plugin.json` + `plugin/skills/reframe/SKILL.md`);
  the root `.claude-plugin/marketplace.json` points its `source` at `./plugin`
- `examples/` — scenes, overlays, edit-survival demo, logo-sting
- `benchmark/` — measurement artifacts (LLM benchmark, regen experiment, motion
  profiler). These are recorded experimental results — do not regenerate or
  edit them to make numbers look different.

## Release (npm)

Only `packages/reframe-video` is published; the other packages are `private`
and inlined into it by the build (esbuild + `REFRAME_PACKAGED`). To cut a
release: bump `packages/reframe-video/package.json` `version`, commit, then push
a matching `v<version>` tag.

**Version-bump policy (pre-1.0): default to a PATCH bump (the `z` in `x.y.z`).**
While `0.y.z`, ship features AND fixes as patch bumps (`0.6.0` → `0.6.1` → `0.6.2`).
Only bump the MINOR (`y`) for a deliberate milestone or a breaking change to the IR
/ overlay schema; keep MAJOR at `0` until 1.0. So most releases just increment `z`. The `.github/workflows/publish.yml` action builds
and runs `npm publish` with the `NPM_TOKEN` repo secret. Manual fallback:
`pnpm --filter reframe-video build && cd packages/reframe-video && npm publish`.
Never commit `.env` (it holds `NPM_TOKEN`; it is gitignored).

### Plugin/skill release (separate version line from the npm package above)

The Claude Code plugin is its own release line, independent of `reframe-video`:

- **Identifiers** — marketplace `kiyeonjeon21`, plugin `reframe`, install id
  `reframe@kiyeonjeon21` (`<plugin>@<marketplace>`). The github add address stays
  `kiyeonjeon21/reframe`. Defined in `.claude-plugin/marketplace.json` (root — the
  marketplace `name` + plugin list, with the plugin `source` pointing at `./plugin`)
  and `plugin/.claude-plugin/plugin.json` (the plugin `name` + `version`). The plugin
  is scoped to `plugin/` so the marketplace caches only that subdir, not the whole repo.
- **Versioning** — `.claude-plugin/plugin.json` `version` on a `0.1.z` track;
  default to a PATCH bump, independent of `reframe-video`'s `0.6.z`. The
  marketplace tracks git `main` (not the npm tag), so a push to `main` IS the
  release — no `npm publish` needed for the plugin.

**Bump `plugin/.claude-plugin/plugin.json` `version` whenever you touch anything
under `plugin/` (the skill or the manifest), in the same commit.** The marketplace caches an
installed plugin by that version string in `~/.claude/plugins/cache/...`; if the
content changes but the version doesn't, `/plugin marketplace update kiyeonjeon21`
refreshes the git clone but NEVER re-bakes the cache — users keep loading the
stale skill until a manual cache delete or reinstall. (This file and other repo
docs are NOT part of the plugin, so editing them needs no plugin bump.)

> Local hygiene: each bump leaves the OLD version's baked copy behind under
> `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, and renaming the
> marketplace strands the whole old-name cache dir. These are regenerable and safe
> to delete — e.g. `rm -rf ~/.claude/plugins/cache/kiyeonjeon21/reframe/<old-version>`
> (and the stale `cache/<old-marketplace>` dir after a rename). The live
> `marketplaces/<name>/` git clone is needed for `marketplace update`, so leave it.

**A new `reframe-video` npm release does NOT need a plugin bump.** SKILL.md and the
guides call the CLI as `npx -y reframe-video <cmd>` (unpinned, no `@version`), so
consumers get the latest CLI at runtime with no change to the plugin's cached bytes —
the plugin version tracks only the plugin's own content (everything under `plugin/`),
fully decoupled from the CLI's `0.6.z`. The one exception: if a new CLI command/flow
means you rewrite SKILL.md to teach it, that SKILL.md edit triggers the bump (the rule
above) — not the npm publish itself.

**Two skill channels: marketplace (git) and npm-bundled.** A skill change reaches
Claude Code marketplace users on git push to `main` (it's their plugin source). But the
copy bundled in the `reframe-video` npm package (`skills/` in `files`) only refreshes when
`reframe-video` is **published** — so an **Agent-SDK consumer that loads the plugin from
`node_modules/reframe-video`** stays a skill behind until the next
npm release. When a skill change must reach those consumers, cut a `reframe-video` patch in
addition to the git push, so both channels carry the same skill.

## Gotchas

- ffmpeg is a system dependency; Playwright chromium needs a one-time
  `pnpm exec playwright install chromium` (postinstall is blocked).
- Bundled fonts: Inter 400/700/800 only — other families silently fall back.
- Audio: `scene.audio` cues anchor to timeline labels (they survive retiming);
  sfx are procedurally synthesized, CC0 samples live in `assets/sfx/`
  (LICENSE.md records provenance). Determinism contract covers the AudioPlan
  and WAV bytes, not AAC-encoded mp4 bytes. `audio.narration` lines (spoken VO)
  resolve to label-anchored `file` cues after `reframe narrate` synthesizes them;
  the Kokoro `.wav` are **external assets** (same-machine, version-dependent, like
  images) — NOT part of the golden contract. Synthesis is out-of-band; only the
  AudioPlan (cue timing + the baked `duration`-sized duck window) is deterministic.
- Golden snapshots in `packages/core/test/__snapshots__` encode the determinism
  contract; if they change unexpectedly, that's a regression, not noise.

## Agent interop (Claude Code ↔ Codex)

- This file (`AGENTS.md`) is the shared brain. Keep durable instructions here.
- `CLAUDE.md` is just `@AGENTS.md` plus Claude-only notes.
- Claude-only config lives in `.claude/settings.json` (committed: permissions;
  personal overrides go in the gitignored `.claude/settings.local.json`). Codex
  has no equivalent committed hook/permission file, so don't encode required
  behavior in hooks — put it here as instructions both tools read.
