# Examples

68 curated scenes, one per `.ts` file in [`scenes/`](scenes). Each is a single, self-contained, dependency-free document — render any of them:

```bash
pnpm reframe render examples/scenes/<scene>.ts        # in this repo
npx reframe-video render examples/scenes/<scene>.ts   # from npm
```

Add `--overlay <file>` to layer human edits, or `frame <scene> --t <sec>` for a single PNG. A curated visual reel is in the [gallery](../docs/gallery.mdx); the full syntax is `pnpm reframe guide`.

Also here: [`overlays/`](overlays) (human-edit layers), [`compositions/`](compositions) (multi-scene cuts), [`lib/`](lib) (shared scene helpers), [`data/`](data) (batch inputs), [`scripts/`](scripts) (the edit-survival + gallery renderers). Overflow variants (extra device mockups, character poses, the `motion-lab` scratchpad), the SVG→logo-sting generator, and live-data probes live in [`../labs/`](../labs) to keep this set curated.

## Hero / flagship

| Scene | What it shows |
|---|---|
| `media-story` | Stills + a video clip assembled into a montage with kinetic titles, deterministic. |
| `product-promo` | A product device with a figure presenter, generated assets and motion. |
| `reframe-demo` | A six-chapter narrative about reframe — logo sting through topic sequences. |
| `reframe-reel` | A five-beat sizzle reel of recently-shipped capabilities in one system. |

## Motion vocabulary

| Scene | What it shows |
|---|---|
| `bloom` | 300 dots on a golden-angle spiral: bloom, breathing wave, color ripple, vortex. |
| `spring-demo` | Four spring-physics easings showing overshoot and settling behavior. |
| `transition` | Two scene groups with a card wipe and a slide behind an orange sweep. |

## Primitives & effects

| Scene | What it shows |
|---|---|
| `blend-demo` | Additive light, multiply tint, a neon sign via the screen blend mode. |
| `dof-demo` | Depth of field: three cards at increasing z, the camera racks focus through. |
| `faux-3d-cards` | Four feature cards flip 0→180° `rotateY` (affine perspective approximation). |
| `gradient-demo` | Linear / radial / conic gradients on rect, ellipse, path, plus animation. |
| `group-fx-demo` | Group blur, shadow, and blend composited as one offscreen layer. |
| `matte-demo` | An alpha matte (video-filled headline) and a luma matte (iris photo reveal). |
| `perspective-cards` | Projected 2.5D: parallax, a card flip, perspective text, a dolly flatten. |
| `shadow-demo` | A drop-shadowed card and a pulsing glow orb (animatable blur + glow). |
| `shape-morph` | Circle → star → flower → gem → back, path morphing via shared control points. |
| `zsort-demo` | Depth-ordered paint: the middle card animates through the z stack, re-sorting. |

## Kinetic text

| Scene | What it shows |
|---|---|
| `kinetic-manifesto` | Five lines with assemble / decode / cascade / rise entrances and exits. |
| `kinetic-typo` | Words punch in one after another, hold, then scatter. |
| `text-fx` | A `splitText` showcase: `textIn` / `textLoop` / `textOut` effects. |
| `typewave` | Character-level type cascading in, riding a standing wave, shattering. |

## Devices & UI

| Scene | What it shows |
|---|---|
| `cursor-fx` | An arrow cursor arcs between buttons, clicking each with a tap + ripple. |
| `device-gallery` | The redesigned `devicePreset`: glass + neon styles, seeded per-instance variation. |
| `device-hero` | One device with a dramatic arc — drop / rise / spin / settle (motionPath + skew). |
| `device-presets` | Three devices side by side, content clipped + scrolling. |
| `device-teardown` | A carousel of every device type performing its signature move. |
| `imessage-chat` | A hero iPhone with an iMessage thread, typing indicator, and a punchline. |
| `imessage-chat-beforeafter` | Two identical iPhones in lockstep, an additive edit layer on the right. |
| `imessage-chat-edit` | The thread with a love tapback + confetti burst as additive edits. |
| `terminal-claude` | A faithful ~1-min Claude Code session: welcome, prompt, agent run stream. |
| `x-demo` | An X promo cut: device-motion montage hook, editor schematic, regen payoff. |

## Character / figure

| Scene | What it shows |
|---|---|
| `character-show` | A humanoid rig doing walk → run → jump → dance → cheer via `characterPreset`. |
| `figure-styles` | One `figure()` rig with three swappable skins (clean / re-skin / cute). |

## Data viz

| Scene | What it shows |
|---|---|
| `annual-report` | A dashboard: KPI count-ups, growing bars, a draw-on line, a gradient donut. |
| `chart-buildup` | A weekly-users bar chart growing from the baseline with callouts. |
| `data-explainer` | A `splitText` title, a count-up KPI, bars, and camera pushes. |
| `flow-diagram` | A system architecture: service boxes, draw-on connectors, packet flow. |
| `github-year` | A GitHub contribution graph as a 3D relief landscape with a camera flight. |

## Audio

| Scene | What it shows |
|---|---|
| `audio-visualizer` | "THE DROP": radial spectrum bars, a pulsing core, a particle burst. |
| `auto-foley-demo` | `autoFoley` scoring motion — whoosh / thud / pop following the tweens. |
| `narrated-demo` | Scene-fitted Kokoro voiceover: `audio.narration` from a sibling `script.json`, each line auto-fitted to its slot by `reframe narrate`, bed ducking under it. |
| `sample-showcase` | The CC0 sample library: keypress / footstep / click / confirm / UI sounds. |
| `sfx-compare` | Synth vs sample A/B for the six original names. |
| `sfx-showcase` | The procedural SFX palette, per-cue seeded variation as a little melody. |

## Logo stings

| Scene | What it shows |
|---|---|
| `logo-reveal` | A mark assembles, a disc pops, an inner square spins, a wordmark rises. |
| `logo-reveal-regen` | A simulated AI regeneration: horizontal lockup + underline flourish (same addresses). |

## Camera / 3D / space

| Scene | What it shows |
|---|---|
| `camera-demo` | One viewport tours detail panels — push / pan / pull, title + watermark fixed. |
| `isometric-stack` | "Uptime": an isometric skyline from plain 2D polygons iso-projected. |
| `nova-teaser` | An app-launch teaser: a star ignites, an accretion disc, a detonation. |
| `orbit` | Nested transform composition: moons orbit planets orbit a sun. |
| `particle-swarm` | "Swarm": ~280 sparks burst radially with seeded wiggle, additive blend. |
| `rocket-launch` | "LIFTOFF": countdown → ignition → ascent → stage separation → orbit. |
| `solar-system` | A ~50s space doc: the pale blue dot, eight planets, light delay. |
| `spacex-cursor` | SpaceX / Cursor logos, a cube along a curved motionPath into an acquisition. |
| `wavefield` | A 32×18 dot grid, two ripple interference patterns computed at authoring time. |
| `zoom-to-space` | "Leaving Earth": a continuous zoom-out through the atmosphere with an altitude readout. |

## Edit-survival / regen

| Scene | What it shows |
|---|---|
| `survive-base` | The edit-survival base (v1) with stable addresses + states. |
| `survive-cut` | The edit-survival story: human cursor edits surviving an AI redesign. |
| `survive-regen` | The base v2 — same stable addresses on a completely different layout. |
| `vector-montage` | Pure-vector montage (no assets): structural overlay edits — reorder, remove, insert a card — render standalone. Overlays: `vector-montage-restructure.json`, `vector-montage-insert.json`. |

## Other

| Scene | What it shows |
|---|---|
| `glitch-vhs` | "SIGNAL LOST": analog VHS glitch from blend modes, chromatic aberration, wiggle. |
| `glyph-reveal` | A stop-motion reveal: 18 archival styles of one symbol, hard-cut at ~7fps. |
| `lower-third` | A broadcast lower-third strap: name, role, accent bar. |
| `photo-montage` | Six CC0 stills: crossfades, Ken Burns, vignette, kinetic titles. |
| `player-sting` | A short visual-only logo sting — proves the standalone HTML `player`. |
| `video-demo` | A video clip with a slow push-in, a vignette/scrim grade, a kinetic title. |
| `video-montage` | Photos + a video clip in one auto-edited cut with seeded Ken Burns. |
| `worldcup-glyph` | A World Cup 2026 archival glyph-reveal with football materials + a stadium bed. |
