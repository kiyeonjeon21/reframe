# reframe eDSL guide

You write a motion-graphics scene as **declarative data** using the reframe
TypeScript eDSL. Your output is a single `.ts` file that default-exports a
`scene({...})` call. Everything imports from `@reframe/core`.

```ts
import { scene, group, rect, ellipse, line, text,
         seq, par, stagger, to, tween, wait,
         oscillate, wiggle } from "@reframe/core";

export default scene({
  id: "my-scene",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [/* ... */],
  states: {/* ... */},
  initial: "hidden",
  timeline: seq(/* ... */),
  behaviors: [/* optional */],
});
```

## Nodes

Factories return plain data. Every node needs a unique `id`.

- `rect({ id, x, y, width, height, fill?, stroke?, strokeWidth?, radius?, opacity?, rotation?, scale?, anchor? })`
- `ellipse({ id, x, y, width, height, fill?, stroke?, strokeWidth?, ... })`
- `line({ id, x1, y1, x2, y2, stroke, strokeWidth?, opacity?, progress? })` —
  `progress` 0..1 draws the line on (1 = full line).
- `text({ id, x, y, content, contentDecimals?, fontFamily, fontSize, fontWeight?, fill?, letterSpacing?, ... })` —
  `content` may be a number; numeric content interpolates (count-up) and renders
  via `toFixed(contentDecimals ?? 0)`. For a "8.2"-style label, set
  `contentDecimals: 1`.
- `path({ id, d, x, y, fill?, stroke?, strokeWidth?, progress?, originX?, originY?, opacity?, rotation?, scale?, anchor? })` —
  a true vector shape from an SVG path `d` string (crisp at any zoom; recolour by
  animating `fill`/`stroke`). `progress` 0..1 draws the stroke OUTLINE on (animate
  0→1 for a self-drawing logo). `originX`/`originY` is the local pivot — set it to
  the art's centre (e.g. the viewBox centre) so `scale`/`rotation` happen about the
  middle. `d` is drawn in its own coords; `x`/`y` place that pivot. Classic logo
  reveal: a stroke path drawing on, then a fill path fading in over it.
  **`d` is animatable (shape morph):** `tween(id, { d: otherShape }, …)` morphs
  the path vertex-by-vertex (the Lottie-style shape tween) when both `d` strings
  share the same command sequence and arg counts — author the two poses with the
  same structure (e.g. both 4-cubic ovals). Arcs (`A`) can't morph (their 0/1
  flags aren't interpolable) and incompatible shapes snap at the midpoint; build
  morph targets from `M/L/C/Q/Z` only.
- `image({ id, src, x, y, width, height, fit?, opacity?, rotation?, scale?, anchor? })` —
  `src` is a file path, absolute or relative to the scene file (png/jpg/webp).
  `fit` controls how it maps into `width`×`height`: `"fill"` (default) stretches;
  `"cover"` crops to fill the box at the image's natural aspect, centered (no
  distortion — drop in any-aspect photos). `src` switches discretely (no crossfade) —
  for hard-cut frame sequences stack image nodes and step their `opacity`; for
  a dissolve, crossfade two nodes' opacity.
- `group({ id, x, y, opacity?, rotation?, scale?, anchor? }, children)` — children's
  coordinates are relative to the group; group opacity/transform multiply down.

`anchor` controls placement and scale/rotation origin:
`"top-left"` (default) | `"top-center"` | `"top-right"` | `"center-left"` |
`"center"` | `"center-right"` | `"bottom-left"` | `"bottom-center"` | `"bottom-right"`.
Example: a bar that grows upward = `anchor: "bottom-left"` + animate `height`.
Font: use `fontFamily: "Inter"` (weights 400/700/800 are available).

## States: declare looks, not motion

Base props on nodes describe the **finished design**. A state is a sparse
override — only the props that differ:

```ts
states: {
  hidden: { title: { opacity: 0, y: 560 }, bar: { height: 0 } },
  shown:  { title: { opacity: 1, y: 540 }, bar: { height: 300 } },
},
initial: "hidden",
```

`to("shown", { duration, ease, stagger?, filter? })` synthesizes a transition
from each node's *current* value to the state's value. `stagger: 0.1` offsets
the affected nodes 0.1s apart in declaration order. `filter: ["a", "b"]`
restricts the transition to those nodes. States are plain objects — generate
them with normal TS (`Object.fromEntries`, `.map`) for data-driven scenes.

## Timeline: compose time

- `seq(...steps)` — one after another.
- `par(...steps)` — all start together; ends when the longest ends.
- `stagger(interval, ...steps)` — like `par` but each child starts `interval` later.
- `to(stateName, opts)` — transition into a named state (see above).
- `tween(nodeId, { prop: value, ... }, { duration, ease })` — low-level escape hatch
  for one node. Colors (`"#rrggbb"`) interpolate; numbers interpolate.
- `motionPath(nodeId, [[x,y], ...], { duration, ease, curviness?, autoRotate?, rotateOffset?, closed? })`
  — drive a node's `x`/`y` along a smooth Catmull-Rom curve through the waypoints
  (parent-space coords). `autoRotate: true` banks the node along the path tangent
  (`rotateOffset` degrees if the art faces "up", e.g. `-90`). The node HOLDS at the
  final point after the path finishes (a positioning move, not a one-shot), so a
  later `tween` can chain from there. Use it for swoops/arcs/orbits — straight
  `tween`s on x and y can't curve. `closed: true` loops the waypoints (orbit).
  `curviness` shapes the path: `1` smooth (default), `0` sharp corners, `>1` loopier.
- `wait(seconds)` — hold.

Eases: `linear`, `easeIn/Out/InOutQuad`, `easeIn/Out/InOutCubic`,
`easeIn/Out/InOutQuart`, `easeIn/Out/InOutExpo`, or `{ cubicBezier: [x1,y1,x2,y2] }`.
Decelerating entrances = `easeOut*`, accelerating exits = `easeIn*`.
Expressive eases for a premium feel: `easeIn/Out/InOutBack` (overshoots past the
target then settles — a pop/snap), `easeIn/Out/InOutElastic` (rings around the
target — a playful spring), `easeIn/Out/InOutBounce` (drops and bounces to rest).
A logo or card "popping" in usually wants `easeOutBack`; a stamp landing,
`easeOutBounce`.
Scene duration is inferred from the timeline.

## Behaviors: continuous motion during holds

Composed additively on top of the timeline:

- `oscillate(nodeId, prop, { amplitude, frequency, phase? }, window?)` — sine.
- `wiggle(nodeId, prop, { amplitude, frequency, seed }, window?)` — smooth seeded noise.

The optional 4th argument `{ from?, until?, ramp? }` limits the behavior to a
time window (seconds) with a linear fade of `ramp` (default 0.2s) at each
bound — e.g. a pulse only during the hold:
`oscillate("title", "scale", { amplitude: 0.04, frequency: 1.2 }, { from: 1.5, until: 3.5 })`.
Omit the window to run for the whole scene.

## Camera (one keyframable viewport)

A scene-level camera moves the whole scene at once: a look-at point + zoom +
rotation, animated over the timeline. Add it as a top-level `camera` field and
keyframe it with `cameraTo` (or by tweening the reserved target `"camera"`):

```ts
scene({
  // ...
  camera: { x: W/2, y: H/2, zoom: 1, rotation: 0 }, // (x,y) = scene point centred in frame; defaults = frame centre, zoom 1, rot 0 (= no camera)
  timeline: seq(
    cameraTo({ x: 300, y: 400, zoom: 4 }, { duration: 1.5, ease: "easeInOutCubic", label: "push-in" }), // zoom into a detail
    cameraTo({ x: 800, y: 200, zoom: 2, rotation: -5 }, { duration: 1.2 }),                              // pan + slight bank
    cameraTo({ x: W/2, y: H/2, zoom: 1, rotation: 0 }, { duration: 1.6 }),                               // pull back
  ),
})
```

- `cameraTo(props, { duration?, ease?, label? })` keyframes the camera; it is a
  `tween` on the `"camera"` target, so `motionPath("camera", pts, …)` (pan along
  a curve) and `oscillate/wiggle("camera", "rotation"|"x"|…)` (handheld drift)
  also work.
- **Pin HUD/titles to the screen** with `fixed: true` on a TOP-LEVEL node — the
  camera won't move it (for overlays, watermarks, captions).
- Defaults are the identity, so a scene without a camera is unchanged. Don't name
  a node `"camera"` if you use the scene camera (the id can't be both).

See `examples/scenes/camera-demo.ts`.

## Gradients (fill / stroke)

`fill` and `stroke` on **rect / ellipse / path** accept a gradient as well as a
color string. Coordinates are normalized to the node's bounding box (0..1), so a
gradient is just an angle + stops:

```ts
rect({ id: "card", x, y, width: 300, height: 300, anchor: "center",
  fill: linearGradient(["#FF5C3A", "#FFC24B"], { angle: 60 }) })   // 0=L→R, 90=T→B
ellipse({ id: "orb", /* … */ fill: radialGradient(["#9B7CFF", "#221A4A"], { cx: 0.4, cy: 0.4, r: 0.6 }) })
path({ id: "star", d, fill: conicGradient(["#00C2A8", "#3AA0FF", "#7C5CFF", "#00C2A8"], { angle: -90 }) })
ellipse({ id: "ring", /* … */ fill: "none", stroke: linearGradient(["#3AA0FF", "#46E5A0"]), strokeWidth: 10 })
```

- `linearGradient(stops, { angle })`, `radialGradient(stops, { cx, cy, r })`,
  `conicGradient(stops, { angle, cx, cy })`. `stops` is a color array (even offsets)
  or `[{ offset, color }]`. `cx/cy/r` are 0..1 of the box (centre defaults to 0.5).
- **Gradients are static** (not keyframed). The gradient lives in the node's local
  space, so **animate the NODE** (`tween(id, { rotation: 360 })`, scale, move) and the
  gradient sweeps/stretches with it. Color-string fills still tween as today.
- text fill and line stroke are color-only for now. See `examples/scenes/gradient-demo.ts`.

## Shadow, glow & blur

Drawable nodes (rect / ellipse / path / text / image / line) take animatable paint
effects, in **screen pixels** (not transformed by the node or camera, so a shadow
keeps a consistent light direction):

```ts
rect({ id: "card", /* … */, ...dropShadow("#000000", 64, 0, 34) })   // drop shadow
ellipse({ id: "orb", /* … */, fill: radialGradient([...]), shadowColor: "#FFC24B", shadowBlur: 22 })
oscillate("orb", "shadowBlur", { amplitude: 16, frequency: 0.9 })    // PULSING glow
rect({ id: "card", /* … */, blur: 18 }); tween("card", { blur: 0 }, { duration: 1 }) // focus pull
```

- Props: `blur` (gaussian blur of the shape), `shadowColor` (turns the shadow/glow
  on), `shadowBlur`, `shadowX`, `shadowY`. All **animatable** — `tween`/`oscillate`
  them for pulsing glows, focus pulls, etc. (set a base value first so there's
  something to animate from).
- Sugar: `glow(color, blur)` (offset 0) and `dropShadow(color, blur, x, y)` return
  a partial you spread into props (`...glow("#FFD24B", 28)`); still animatable.
- No-op on a `group` (apply to a child; group/composite blur is a later add). See
  `examples/scenes/shadow-demo.ts`.

### Blend modes (compositing)

`blend` selects how a shape composites with what's already drawn beneath it — the
primitive that makes light read.

```ts
ellipse({ id: "glow", fill: radialGradient(["#FF2D6A", "#FF2D6A00"]), blend: "screen" }) // additive light: brightens where blobs overlap
rect({ id: "tint", fill: "#1E5BFF", blend: "multiply" })                                 // tint/deepen the layer beneath
rect({ id: "neon", fill: linearGradient([...]), shadowColor: "#7A4DFF", blend: "screen" }) // compose with glow
```

- Modes: `normal` (default), `multiply`, `screen`, `overlay`, `lighten`, `darken`,
  `add` (additive light), `color-dodge`, `soft-light`, `hard-light`, `difference`.
- **Discrete**, not interpolated — set per node (a static string). Default `normal`.
- Per-shape. A whole-group blend (composite the subtree, then blend) is a later add;
  on a `group` the prop is a no-op. See `examples/scenes/blend-demo.ts`.

## Character rig (skeleton, poses, IK)

A first-class, declarative character rig that **compiles to plain IR** (nested
`group` joints + bone paths) — the character analog of `devicePreset`. It needs
no new renderer concept, so overlays/preview/determinism all apply.

- `humanoid({ id, x, y, scale, opacity?, color?, fill?, glow? })` → a NodeIR: a
  ready upright body. Joints (stable ids `${id}-${name}`): `chest`, `head`,
  `armUpperL/armLowerL`, `armUpperR/armLowerR`, `legUpperL/legLowerL`,
  `legUpperR/legLowerR`. Drop it in `nodes`.
- `rig(boneTree, opts)` → build your own skeleton. A `Bone` is
  `{ name, at:[x,y], length?, width?, rotation?, shape?, children? }`. The joint
  sits at the group origin; the bone extends **+Y at rotation 0**; a child's `at`
  pivot is in the PARENT bone's local space (e.g. an elbow at `[0, upperLength]`).
  Nested groups give forward kinematics — a child's rotation composes on its
  parent's. Default bone = a bezier capsule (morphable); pass `shape` for custom art.
- A **pose** is `{ jointName: angleDeg }` (0 = bone points down). Animate it:
  - `poseTo(id, pose, { duration, ease, stagger? })` → a timeline step (a `par`
    of rotation tweens). Sequence poses for wave/jump/run.
  - `rigPose(id, pose)` → a `states` fragment, to transition with `to(state, …)`.
- `ikReach(upper, lower, dx, dy, flip?)` → `[shoulderDeg, elbowDeg]` that place a
  2-bone limb's tip at `(dx,dy)` relative to its shoulder joint (law of cosines;
  clamps when out of reach). Feed the two angles into a pose.
- Joint names are the **stable regen addresses** — never rename them across a
  regen; each rig instance needs a distinct `id` (duplicates collide via scene
  validation). Squash/stretch and expressions are per-bone `d` morphs (above),
  composed on top of FK posing. Idle sway/breathing = `oscillate` on a joint.
- `figure(opts)` — a **dressed** character (the styled sibling of `humanoid`):
  same skeleton, but coloured flat-design shapes. `style: "clean"` (corporate-flat
  / undraw register, the default) or `"cute"` (mascot); `palette` knobs
  (`skin`/`hair`/`top`/`pants`/`shoe`/`accent`) re-skin it — for `clean` the top
  follows `accent`, so `figure({ palette: { accent: "#3B82F6" } })` recolours the
  whole figure; `face: false` makes it faceless. It exposes the humanoid joint
  ids, so `characterPreset` / `ikReach` drive it unchanged. Use it as the
  supporting actor in a product promo (gesturing at a `devicePreset`), not the hero.
- `characterPreset(name, opts)` — a **seeded motion generator** for a `humanoid`
  or `figure` rig (the character analog of `motionPreset`). Returns a composable `beat`;
  drop it in the timeline: `seq(characterPreset("walk", { target: "hero", at:
  [cx, cy], cycles: 4 }))`. Names: `walk`, `run`, `jump`, `dance`, `wave`,
  `cheer`. Knobs: `target` (rig id), `energy` 0..1, `speed` (>0, divides
  durations), `seed` (varies within the family), `cycles` (walk/run/dance),
  `facing` (±1), `at: [x,y]` (the rig's scene position — needed for walk travel
  & jump lift), `travel` (px/cycle, 0 = in place), `label` (unique beat name —
  set it when the same preset is used more than once in a scene). Legs use
  `ikReach`, arms FK; pure keyframes, so add continuous idle yourself with `oscillate`.

## Kinetic text (split + effect presets)

reframe's `text` node renders a whole string as one node, so per-glyph effects
need the string split into per-character nodes. `splitText` does that once;
seeded effect generators animate the glyphs (the text analog of `motionPreset`).

- `splitText(text, { id, x, y, fontSize, fontWeight?, fill?, letterSpacing?,
  align?, unit?, opacity? }) → TextBlock` — lays the phrase out as center-anchored
  `text` nodes using **real Inter advance widths** (so layout matches the render).
  Returns `{ nodes, glyphs, ids, width, ... }`; put `...block.nodes` in `nodes`.
  Glyph ids are `${id}-${i}` (stable regen addresses). `unit: "word"` animates
  whole words instead of letters; `opacity: 0` (default) starts hidden for entrances.
- `textIn(name, block, { speed?, energy?, seed?, stagger?, label? }) → TimelineIR`
  (a `beat`) — entrance: `typewriter`, `cascade`, `rise`, `bounce`, `assemble`
  (fly in from a seeded scatter), `decode` (scramble through random glyphs then lock).
- `textLoop(name, block, { from?, until?, ramp?, amplitude?, frequency?, phaseStep? })
  → BehaviorIR[]` — sustained: `wave` (standing sine), `shimmer`, `wobble`, `float`.
  Spread it into `behaviors`.
- `textOut(name, block, { …, dir? }) → TimelineIR` — exit: `shatter` (random
  direction + spin + fade), `fly` (directional), `dissolve`, `fall`, `collapse`.
- `textTypeCues(block, { at, interval?, gain? }) → AudioCueIR[]` — per-glyph CC0
  keypress for a typewriter entrance; spread into `audio.cues`.

```ts
const T = splitText("MOTION IS DATA", { id: "t", x: 960, y: 470, fontSize: 130 });
// nodes:     [...T.nodes]
// timeline:  seq(textIn("cascade", T), wait(2), textOut("shatter", T, { seed: 3 }))
// behaviors: textLoop("wave", T, { from: 1.6, until: 3.6 })
```
Every effect is seeded (same `seed` → identical) and pure keyframes. To time a
`textLoop` window, add up the `textIn` beat length (≈ `(n-1)·stagger + glyphDur`).

## Photo / video montage (`photoMontage` / `videoMontage`)

Turn a list of shots into a polished slideshow — crossfades + seeded Ken Burns
(pan/zoom) + an optional cinematic grade (vignette + bottom scrim via gradients +
blend) — without hand-wiring each move. Shots may be images AND video clips, mixed
freely (a video src, by extension, plays as a clip for its `hold`). `videoMontage`
is the same generator, named for clip-driven cuts. The photo analog of `motionPreset`.

```ts
const m = videoMontage(["a.jpg", { src: "b.mp4", volume: 1 }, "c.jpg"], {
  id: "shot", size: { width: 1920, height: 1080 },
  hold: 3.4, transition: 0.7, zoom: 1.16, seed: 7,
});
scene({ size, nodes: [...m.nodes, ...titles], timeline: par(m.timeline, titleTrack) });
```

- Returns `{ nodes, timeline }` (like `splitText` owns its glyph nodes). `nodes` are
  the stacked image/video layers (+ `${id}-vignette` / `${id}-scrim` grade overlays);
  `timeline` is a retimable `beat("montage", …)`. Stable addresses: `${id}-${i}`,
  labels `shot-${i}` / `cross-${i}`.
- **Any-aspect media works** — each layer uses `fit: "cover"`, so the renderer
  crops to fill the frame at the source's aspect (no pre-cropping, no distortion).
  The Ken Burns keeps `scale ≥ 1` with the pan bounded to its slack, so an edge is
  never revealed.
- Per-shot overrides: `{ src, hold?, ken?, volume? }` where `ken` is `"in" | "out" |
  "pan"`. A **video** shot plays as a clip from its slot's start; its audio is **muted
  by default** in a montage — set `volume` (per shot) to include it, or add a `scene.audio`
  bed.
- Seeded + pure (same `(shots, opts)` → identical IR). Note: image/video sources do
  not render in `reframe player` / artifacts — montage ships as mp4. See
  `examples/scenes/video-montage.ts`.

## Video clips (`video`)

Draw a video clip as a layer. It plays on the scene clock — at scene-time `t` it
shows the source frame at `clipStart + max(0, t - start) * rate`.

```ts
video({ id: "clip", src: "shot.mp4", x: 960, y: 540, width: 1920, height: 1080,
        anchor: "center", fit: "cover", start: 0, rate: 1, clipStart: 0, volume: 1 })
tween("clip", { scale: 1.08 }, { duration: 5 })  // transform composes with playback (Ken Burns)
```

- Props: `src` (mp4 / mov / webm / m4v / mkv, absolute or scene-relative), `width`/`height`,
  `fit` (`"cover"` like the image node), `start` (scene-time playback begins), `rate`
  (speed), `clipStart` (source in-point s), `volume` (clip-audio gain, default 1; `0` mutes).
  Transform/opacity/effects compose as usual.
- **Deterministic by frame extraction**: render-cli runs `ffmpeg -vf fps=<sceneFps>` to pull
  the clip's frames, and the renderer draws frame `round(t·fps)` — no live `<video>` seek, so
  it stays byte-identical (same machine).
- **Clip audio**: the clip's own audio track is muxed into the output, placed at `start`
  (trimmed from `clipStart`, sped by `rate`, scaled by `volume`), mixed with `scene.audio`.
  A clip with no audio stream is skipped; set `volume: 0` to drop a clip's sound.
- **Limitations**: all frames are pre-decoded so keep clips short (≤~5s); like images, video
  sources are not rendered in `reframe player` / artifacts (mp4 only). See
  `examples/scenes/video-demo.ts`.

## Cursor (UI demos)

A vector mouse pointer that glides across the scene and clicks things — for app
walkthroughs. `cursor()` returns a node; the moves/clicks return timeline steps.
The pointer's **hotspot is the group origin**, so a move lands the tip on a target.

- `cursor({ id, x, y, scale?, opacity?, style?, accent? }) → NodeIR` — styles
  `arrow` (default), `dot`, `ring`. Draw it LAST so it sits on top. Carries a
  hidden `${id}-ripple` ring for clicks.
- `cursorTo(id, from, to, { duration?, ease?, arc? }) → TimelineIR` — glide along
  a gentle human arc (`arc` is the bow, default 0.12). Thread the position: start
  = the node's `x/y`, each `to` becomes the next `from`.
- `cursorPath(id, points, opts)` — a multi-stop tour through waypoints.
- `cursorClick(id, { press?, ripple?, label? })` / `cursorDouble(...)` — the
  pointer taps, a ripple ring expands, and the `press` node (a button) dips. Pass
  a unique `label` when you click more than once in a scene.
- `deviceScreenPoint(name, deviceOpts, [lx, ly]) → [x, y]` — map a UI element's
  screen-local coords (the coords `devicePreset` `content` is authored in) to
  scene coords, so the cursor clicks on-screen UI precisely (account for the
  device's `scale` at click time and any `slot` offset).

```ts
// nodes:    devicePreset("browser", { id:"d", x, y, scale:0.88, content }), cursor({ id:"cur" })
const cta = deviceScreenPoint("browser", { x, y, scale: 0.88 }, [lx, ly]);
seq(cursorTo("cur", [sx, sy], cta), cursorClick("cur", { press: "browser-ui-cta" }))
```

## Audio (optional)

Label-anchored sound design — cues follow retiming and regeneration:

```ts
audio: {
  bgm: { synth: "ambient-pad", gain: 0.3, fadeIn: 1, fadeOut: 2, duck: { depth: 0.5 } },
  cues: [
    { at: "enter", sfx: "whoosh", gain: 0.8 },          // anchored to a timeline label
    { at: "enter", offset: 0.2, sfx: "pop" },
    { at: 5.0, file: "keypress-001.wav", gain: 0.5 },   // absolute seconds; file from assets/sfx/
  ],
}
```

Procedural sfx names: `whoosh` `pop` `tick` `rise` `shimmer` `thud` (deterministic,
seedable via `params: { seed }`). Exactly one of `sfx`/`file` per cue.

## Rules

- Everything must be a pure function of time: no `Math.random()` (use `wiggle`
  with a seed), no `Date`, no async.
- Node ids must be unique; states/tweens may only reference existing ids and
  real props of that node type.
- Overshoot pops are two steps: tween scale past 1 (`1.15`), then settle to 1.
- When a node enters by scaling from 0, start it at `opacity: 0` too and fade
  in alongside — a scale-0 shape can still rasterize as a 1px dot at frame 0.

## Worked example A — countdown (3, 2, 1, GO!)

```ts
import { scene, ellipse, text, seq, par, tween, wait } from "@reframe/core";

const numbers = ["3", "2", "1"];

export default scene({
  id: "countdown",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    ellipse({ id: "ring", x: 960, y: 540, width: 360, height: 360,
      anchor: "center", stroke: "#3B82F6", strokeWidth: 10, opacity: 0 }),
    ...numbers.map((n, i) =>
      text({ id: `num-${i}`, x: 960, y: 540, anchor: "center", content: n,
        fontFamily: "Inter", fontSize: 220, fontWeight: 800, fill: "#FFFFFF",
        opacity: 0, scale: 0.5 })),
    text({ id: "go", x: 960, y: 540, anchor: "center", content: "GO!",
      fontFamily: "Inter", fontSize: 320, fontWeight: 800, fill: "#FF4D00",
      opacity: 0, scale: 0.5 }),
  ],
  timeline: seq(
    tween("ring", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic" }),
    ...numbers.map((_, i) =>
      seq(
        par(
          tween(`num-${i}`, { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween(`num-${i}`, { scale: 1.1 }, { duration: 0.2, ease: "easeOutCubic" }),
        ),
        tween(`num-${i}`, { scale: 1 }, { duration: 0.1, ease: "easeInOutQuad" }),
        wait(0.45),
        tween(`num-${i}`, { opacity: 0, scale: 0.7 }, { duration: 0.1, ease: "easeInQuad" }),
      )),
    par(
      tween("go", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("go", { scale: 1.15 }, { duration: 0.25, ease: "easeOutCubic" }),
      tween("ring", { scale: 1.6, opacity: 0 }, { duration: 0.4, ease: "easeOutCubic" }),
    ),
    tween("go", { scale: 1 }, { duration: 0.15, ease: "easeInOutQuad" }),
    wait(0.6),
  ),
});
```

## Worked example B — badge pop (overshoot + wiggle + drop)

```ts
import { scene, group, rect, text, seq, par, tween, wait, oscillate } from "@reframe/core";

export default scene({
  id: "badge-pop",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#15151A",
  nodes: [
    group({ id: "badge", x: 960, y: 540, scale: 0, opacity: 0 }, [
      rect({ id: "plate", x: 0, y: 0, width: 420, height: 160,
        anchor: "center", fill: "#E11D48", radius: 28 }),
      text({ id: "label", x: 0, y: 6, anchor: "center", content: "NEW",
        fontFamily: "Inter", fontSize: 88, fontWeight: 800, fill: "#FFFFFF",
        letterSpacing: 6 }),
    ]),
  ],
  timeline: seq(
    wait(0.2),
    par(
      tween("badge", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("badge", { scale: 1.18 }, { duration: 0.28, ease: "easeOutCubic" }),
    ),
    tween("badge", { scale: 1 }, { duration: 0.18, ease: "easeInOutQuad" }),
    wait(1.6),
    par(
      tween("badge", { y: 720 }, { duration: 0.35, ease: "easeInCubic" }),
      tween("badge", { opacity: 0 }, { duration: 0.35, ease: "easeInQuad" }),
    ),
    wait(0.2),
  ),
  behaviors: [oscillate("badge", "rotation", { amplitude: 2.5, frequency: 0.8 })],
});
```
