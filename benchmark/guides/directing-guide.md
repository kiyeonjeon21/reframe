# reframe directing guide — high-end, reference-heavy pieces

Read this (after the syntax guide, `reframe guide`) when the ask is a CINEMATIC or
REFERENCE-FAITHFUL piece — a product teaser, a UI/session reproduction, a title
sequence, a data story — not a simple lower-third or KPI card (those you just write).
Simple jobs render first-try; the ceiling needs a process. This is that process.

## What to get from the user (before writing anything)

Ask for / confirm these — vague prompts are why these pieces take many rounds:

- **Concept** in one line ("a faithful Claude Code session that builds a logo", "an app
  that goes viral, everywhere").
- **References** — screenshots / a reference video / pasted real content (terminal output,
  copy, data). For fidelity work, the reference IS the spec. Save them to disk so you can
  `diff` against them.
- **Brand** — exact colors (hex), the wordmark, the font feel.
- **Format** — length (~10–20s is a good ceiling clip), aspect (16:9 / 9:16), with or
  without sound.
- **Tone** — "Apple teaser" (slow, premium, lots of negative space) vs "faithful UI sim"
  (exact, dense) vs "kinetic/energetic". This sets pacing and camera.

## The loop

### 1. Storyboard the beats FIRST (structure, not a flat timeline)

Name the acts with `beat("...", {}, [ ... ])` before animating. A beat is a labeled,
retimable narrative unit; its label anchors audio and lets you restructure whole sections.
A reliable arc: **setup → inciting beat → rising → climax → resolution.** Decide what each
beat shows and how long, THEN fill in motion. (See `device-hero.ts`: `beat("ki"/"seung"/
"jeon"/"gyeol", …)` — entrance → it-takes-off → everywhere → resolve.)

### 2. Match references with `diff` (stop eyeballing)

Reproducing a screenshot pixel-faithfully is the hardest part. Use the tool:

```
reframe diff ref.png --mode grid            # labelled 100px grid over the screenshot → read coords, place nodes
reframe diff ref.png scene.ts --mode side   # reference | your render, side by side
reframe diff ref.png scene.ts --mode diff   # absolute difference — bright where you're off
reframe diff ref.png scene.ts --mode blend  # 50% overlay — spot drift
```

Loop: `--mode grid` to measure → write the node tree → `--mode side`/`diff` to compare →
fix coordinates/sizes/colors → repeat until faithful. Pick the frame with `--t <sec>`.
The grid is rendered at the reference's **full resolution** — the printed numbers are
exact scene pixels, so place nodes at the labelled coordinates directly (no scaling).
`diff`/`blend` are sharpest on hard edges (type, icons, frames); over large **soft
gradients/glows** they always light up "different" even when close, so tune those by
eye with `--mode side` rather than chasing the diff to black.

### 3. Apply the cinematic-craft checklist

These are what make a piece read as premium, not a slideshow. Patterns proven in the
flagship scenes — reuse the technique, vary the content:

- **Camera moves with the story.** Push in on each beat: a `cameraTo(...)` running in `par`
  with the beat's content. Frame the detail that matters, pull back to resolve. (See
  `terminal-claude.ts` helpers `cam()`/`scroll()`/`show()` — focus + scroll + reveal as
  parameterized eased moves.)
- **Curved entrances, not straight slides.** A hero enters on a `motionPath` arc with
  `easeOutBack` (overshoot, then settle). (`device-hero.ts` `motionPath("phone-cam", [[…]],
  { ease: "easeOutBack" })`.)
- **Fake depth.** Layer a backdrop of many faint concentric ellipses (a smooth glow, no hard
  edge) + a spotlight + a cast shadow that tracks the hero + an impact ring on landing.
  (`device-hero.ts` backdrop/spot/shadow/ring rig.) Or use real depth: `camera.perspective`
  + per-node `z` (see the syntax guide's "Depth & perspective").
- **Layered idle motion.** Nothing should sit perfectly still. `oscillate` a few nodes at
  DIFFERENT frequencies (slow float, slower tilt, a fast accent) for life during holds.
- **Sound on the beats.** `scene.audio` cues anchor to your beat/timeline labels, so they
  survive retiming: `{ at: "land", file: "bong_001.ogg" }`, `{ at: "viral", offset: 0.4,
  sfx: "pop" }`. An `ambient-pad` bgm with `duck` under the hits. Quote `reframe labels` to
  see exact seconds.

### 4. Verify objectively (don't argue about "more dynamic")

- `reframe labels scene.ts` — every label → exact seconds. The timing source for audio + a
  sanity check that beats land when you think.
- `reframe motion out.mp4` — speeds, static fraction, oscillation rhythm, spikes. A vague
  note like "make it punchier" becomes measurable: compare `meanSpeed`/`peakSpeed` before
  and after; `staticFraction` too high = it drags.
- `reframe trace ref.mp4 --apply scene.ts` — when you have a reference VIDEO (not image),
  extract its timing/easing and re-apply it onto YOUR node ids. Borrow the motion, keep your
  assets.

### 5. Hand-tune via preview → overlay

`reframe preview` to scrub, drag motionPath waypoints, and retime steps; export the overlay
JSON and render with `--overlay`. Those nudges survive a later regeneration (stable
addresses), so the human's polish isn't lost when you redo the base.

## Pitfalls

- Don't animate before the structure is right — fixing pacing after everything is keyframed
  is painful. Beats first.
- Reference fidelity is coordinates + color + type, mostly STATIC layout; get the held frame
  matching with `diff` before adding motion.
- Keep `id`s/labels stable across rewrites (see `reframe guide --regen`) so the user's
  overlay edits survive.
- It's still iterative. The tools cut the rounds; they don't remove the loop. Render, look,
  adjust — the agent should render frames and read them, not guess.
