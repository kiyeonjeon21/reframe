---
name: reframe
description: Create and iterate motion-graphics videos (mp4) — title cards, lower thirds, kinetic typography, product teasers, data-driven video batches. Use when the user asks to make, edit, retime, personalize, or add sound to an animated video. Scenes are declarative data; renders are deterministic; human edits survive regeneration.
---

# reframe — motion graphics as addressable data

All commands run through npx; no install or project setup is needed. The
runtime needs ffmpeg on PATH and a one-time `npx playwright install chromium`
(the render command prints an actionable hint if either is missing).

## Creating a scene

1. **Read the guide first** — `npx -y reframe-video guide` is the complete,
   current syntax. It's sectioned and sizable: read the core (Nodes, States,
   Timeline) closely, and **skim the specialized sections by heading**
   (perspective, track mattes, group effects, video, montage, character rig,
   device frames, cursor, audio) — read one in full only when your scene uses
   it. You don't need to re-read it for follow-up edits; it's already in context.
2. Write a single self-contained `<name>.ts` in the user's directory
   (`npx -y reframe-video new <name>` scaffolds a documented starter).
   Scenes must be pure functions of time: no `Math.random()`/`Date` — use
   `wiggle` with a seed. Give every node a meaningful stable `id` and label
   the key timeline moments — those names are addresses for everything below.
3. Iterate on the cheap commands; full-render once at the end:
   - `npx -y reframe-video compile <name>.ts` — validate eDSL → IR in ~1s, no
     browser, no ffmpeg. Fix the classified error it prints, repeat. Catch every
     syntax/validation error here before launching anything heavier.
   - `npx -y reframe-video frame <name>.ts --t <sec> -o frame.png` — render ONE
     PNG at a key moment in ~1s (chromium only, no mp4 mux) and LOOK at it. This
     is your visual check; sample a few times across the timeline.
   - `npx -y reframe-video render <name>.ts` → `out/<name>.mp4` — the full mp4 is
     ~10x slower; run it once the frames look right, not per edit.

## Directing a high-end piece (cinematic / reference-faithful)

Simple jobs (a lower-third, a logo sting, a KPI card) just work from the guide.
But a CINEMATIC or REFERENCE-FAITHFUL piece (a product teaser, a UI/session
reproduction, a title sequence) needs a director's process — **read it first**:
`npx -y reframe-video guide --directing`. The short version:

1. Get the spec from the user: concept, **references** (screenshots / a reference
   video / pasted real content — save them to disk), exact brand colors, length +
   aspect, and tone. Vague prompts are why these take many rounds.
2. **Storyboard the beats** with `beat("setup"/"rising"/"climax"/…)` BEFORE animating.
3. **Match references with the `diff` tool** instead of eyeballing:
   `npx -y reframe-video diff ref.png --mode grid` (measure a screenshot),
   then `... diff ref.png scene.ts --mode side|diff` (compare a render) → fix → repeat.
4. Apply cinematic craft: camera push-in per beat (`cameraTo` in `par`), curved
   entrances (`motionPath` + `easeOutBack`), fake/real depth, layered `oscillate`
   idle, and label-anchored sound.
5. **Verify objectively**: `... labels` (exact beat seconds), `... motion out.mp4`
   (makes "more dynamic" measurable), `... trace ref.mp4 --apply scene.ts` (borrow a
   reference VIDEO's timing), `... preview` (hand-tune → overlay that survives regen).

## Modifying an existing scene — the contract

Before rewriting any existing scene, read the regeneration contract:
`npx -y reframe-video guide --regen`. The core rule: **never rename node ids,
state names, or timeline labels for concepts that survive the redesign** —
the user's overlay documents hold their hand edits at those addresses.

The user may keep personal edits in an overlay JSON and render with
`--overlay <file>`. Check the conversation for overlay usage. Two situations
to handle explicitly:

- After your rewrite, the render's compose report lists orphaned edits for
  concepts that were genuinely removed — relay that report to the user; never
  let an edit disappear silently.
- If the user asks you to change a property their overlay already overrides,
  editing the scene alone will be invisible in their renders. Resolve the
  mask (update the scene AND remove/update the superseded overlay entry) and
  tell them why.

Addressability tooling (read-only, no render — use it when editing):

- `npx -y reframe-video manifest <scene> [--json]` — list the scene's editable
  surface (every node + its editable/animated props, states, timeline labels
  with patchable params, beats, behaviors, each with its overlay address). Read
  this BEFORE patching so you target real, stable addresses instead of guessing.
- `npx -y reframe-video lint <scene> [--strict]` — flag motion with no `label`
  (timing a later overlay can't reach, and a regen can silently drop) plus a
  `motionAddressableRatio`. When authoring motion the user may want to tweak,
  give the step a stable `label`.
- `npx -y reframe-video verify-overlay <base> <overlay>... ` — after you rewrite
  a base that has overlays, run this to confirm every edit still applies (it
  reports orphans and exits non-zero if any address broke). The regen-survival
  check, without a full render.

## Other capabilities

- **Batch**: `npx -y reframe-video batch scene.ts data.json` — one mp4 per
  data row; row keys are overlay addresses (`nodes.<id>.<prop>`,
  `timeline.<label>.duration`, ...). CSV works too (headers = addresses).
- **HTML/GSAP scenes**: `render` also accepts a self-contained `.html` scene and
  captures it deterministically via a virtual clock — read
  `npx -y reframe-video guide --html` before writing one.
- **Preview editor**: `npx -y reframe-video preview` — scrub/play/knobs for
  scenes in the current directory; the user's knob edits export as an overlay
  JSON they can pass to render.
- **Audio**: `scene.audio` cues anchor to timeline labels, so sound follows
  retiming and regeneration. Procedural sfx (whoosh/pop/tick/rise/shimmer/
  thud) plus bundled CC0 samples (mechanical keypresses, clicks). The guide's
  Audio section has the schema.
- **Motion check**: `npx -y reframe-video motion out/<name>.mp4` prints a
  calibrated motion profile (speeds, static fraction, discontinuities) —
  useful to verify a vague request like "make it more dynamic" objectively.
- **Image sequences** (the "glyph reveal" / stop-motion format): generated
  stills become `image` nodes stacked in painter's order; hard cuts are
  0.01s opacity steps every ~0.15s, a slow camera-group scale tween adds the
  push-in, `wiggle` adds shake, and a label per cut anchors a tick sfx.
  Keep frame ids stable (`frame-0..N`) so the user can swap any plate via
  overlay or batch row (`nodes.frame-3.src`). Image `src` paths resolve
  relative to the scene file.

## Verification habits

Verify on the cheap commands, not by full-rendering. `compile` (validate, ~1s)
then `frame --t <sec>` (one PNG, ~1s) is the inner loop; `render` is for the
final mp4. Don't pull frames out of an mp4 with ffmpeg just to look — `frame`
writes the PNG directly and skips the mux. Same input renders byte-identically,
so "it changed" or "it didn't change" is always provable from a single frame.
