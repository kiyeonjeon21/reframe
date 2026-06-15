# /goal condition blocks (≤4000 chars each)

The full goal files are the design record. The `/goal` command caps the
condition at 4000 chars, so paste the matching block below instead. Each keeps
the fixed decisions verbatim (that's what stops an agent from re-inventing).

---

## goal-1 condition

Reference→Motion: extract a video's timing structure as reframe timeline IR, re-applyable to other assets. reframe's calibrated motion profiler is the unique enabler.

ANCHOR (extend, don't rebuild): benchmark/harness/motion/{analyze.ts — MotionProfile; its `segments` are externally provided (analyze.ts:201), auto-segmentation is the gap; blockflow.ts analyzePair; expected-motion.ts = analytic GT = verifier truth; calibrate.ts gates C1–C7}; packages/core/src/{ir.ts TimelineIR+Ease emission target; index.ts export new API}.

DECISIONS (fixed — do not re-pick):
1. Region-anchored coarse activity bbox, NOT track-anchored. Verifier is same-scene round-trip (needs timing+easing, not object identity); profiler is frame-pair block matching, not a tracker. A coarse region still separates concurrent spatially-distinct events.
2. Reuse the existing 3-signal decomposition; add exactly ONE new signed proxy. translation = existing "moving" gate verbatim (integer displacement ≥1px AND best<0.6×zeroSad); appearance/scale = existing nonGeometricRatio; enter vs exit = NEW per-region occupancy (edge density/luma variance) SIGN (rising=enter, falling=exit); scale vs emphasis = persist-to-window-end vs return-to-baseline (reuse local-extremum logic). The occupancy sign is the ONLY new gate.
3. Auto-segment by thresholding the activity signal vs the existing static floor with hysteresis; feed the UNCHANGED easing classifier (only its input source changes from hand-provided to detected). Hysteresis threshold is a calibration gate vs expected-motion.ts.

DELIVERABLE:
1. extractMotionSketch(profile)→MotionSketch {duration,fps,events:[{t0,t1,kind:enter|exit|move|scale|emphasis,region(coarse bbox),magnitude,easing}],rhythm{periodicityHz,beatCount}}.
2. sketchToTimeline(sketch,nodeIds)→TimelineIR (staggered tweens w/ duration+ease reproducing the timing).
3. CLI: `reframe trace <ref.mp4>` prints sketch JSON; `--apply <scene.ts>` emits a timeline overlay.

VERIFIER (self-contained round-trip): scene A→render→ref.mp4→extractMotionSketch→sketch→sketchToTimeline(A's nodeIds)→timeline'→render→rebuilt.mp4; profile(ref) vs profile(rebuilt) within C1–C7 tolerance. Test benchmark/harness/motion/trace.test.ts on 4 analytic scenes (GT from expected-motion.ts): pure enter/stagger, scale emphasis, periodic hold, two spatially-separated concurrent enters.

DONE-WHEN: onset error ≤1 frame, event count+kind exact on all 4; enter/exit sign correct; concurrent events stay separate (not merged); easing class matches GT on `reliable` segments; round-trip summary within calibrate.ts tolerances (occupancy-sign the only new gate); pnpm test + typecheck green; API exported from index.ts; determinism unaffected.

OUT-OF-SCOPE: per-object tracking; color/effect extraction; mapping onto a structurally-different node set (goal-2); changing existing calibration thresholds.

---

## goal-2 condition

Semantic timeline: raise the timeline from frame-level steps to named Beats ("brand-reveal", "feature-cascade") so human revision and AI regen operate on meaningful units. The keystone goal-1's sketch maps onto and revisions ("make beat 3 faster") address.

ANCHOR: packages/core/src/{ir.ts TimelineIR union — add Beat; compile.ts labelTimes + walk/walkInner — extend addressing; dsl.ts — add beat() next to seq/par/stagger; compose.ts — overlay timeline patches target labels, add beat patches}; packages/preview/ — timeline view groups by beat.

DECISIONS (fixed):
1. Container, NOT annotation. A Beat is a TimelineIR node wrapping steps — a *named group*. Reorder/retime are natural on a subtree, painful as metadata over a flat timeline. `name` reuses the label-addressing the overlay moat depends on; beatTimes = the subset of label spans from beat nodes. Authoring is opt-in.
2. Rigid translation + proportional time-stretch; NEVER elastic. The verifier forces it: "move beat +1.0s → child step's absolute time shifts exactly +1.0s" only holds for a rigid block. Ops: at/gap = rigid translate; scale/duration = multiply every child offset AND duration by one factor; order = reorder beats in parent seq. All preserve interior structure → sub-beat overlay edits survive (label position-within-beat unchanged, only origin moves). Elastic would re-choreograph the interior and destroy authored timing + edits.
3. Additive by lowering. A beat lowers to its grouping (seq default, par if parallel:true) before timing; opts apply as transforms on the lowered span. beat(name,{},children) ≡ seq(children) byte-identical; no-beat scenes compile as today; PropertySegment/easing machinery untouched.

DELIVERABLE:
1. beat(name,opts,children) DSL factory + BeatIR in the timeline union.
2. compile.ts: beatTimes:Map<string,LabelSpan> alongside labelTimes; child labels resolve relative to their beat.
3. compose.ts: overlay patches timeline.<beat>.{at,gap,scale,order}; child label edits survive a beat move.
4. preview: timeline strip renders beats as collapsible groups; window.__store exposes beat structure.

VERIFIER:
- Additivity: pnpm test — every existing golden byte-identical (beats opt-in); a golden test asserts beat(name,{},[...]) ≡ seq([...]).
- Beat retime survival: scene w/ a beat containing a labeled step + overlay editing that step's color; move beat +1.0s; assert (a) color edit still applies, (b) step's absolute time +1.0s exactly.
- Reorder: swap two beats via overlay order; child times recompute, orphan report empty.

DONE-WHEN: all goldens byte-identical; beat retime child edit survives + exact shift; pnpm test + typecheck green; preview shows beat grouping; reframe-demo chapters→beats renders byte-identically to pre-beat output.

OUT-OF-SCOPE: auto-naming beats from content; inter-element dependency edges (full motion graph); changing non-beat compilation.

---

## goal-3 condition

Asset orchestration: turn worldcup-glyph's hand-wired generation (ACE-Step music + Kokoro narration + image plates stitched in the shell) into declared scene data — a scene says which assets it needs and how to generate them; the pipeline produces+caches them deterministically. Makes reframe an assembly engine for AI-generated media without touching the determinism contract.

ANCHOR: packages/core/src/{ir.ts image ImageProps + AudioIR; assets.ts collectImageSrcs — extend to collect generated assets}; packages/render-cli/src/{images.ts buildImageAssets resolve→dataURL fail-before-browser; audio/sfx.ts resolveCueFile content-addressed atomic-rename cache — reuse verbatim}; packages/render-cli/scripts/gen-worldcup-frames.ts + examples/scenes/glyph-frames-wc/CREDITS.md (the manual process being formalized).

DECISIONS (fixed):
1. Contract covers recipe + content hash, NOT model-output bytes. Scene is "deterministic given resolved assets" (like fonts/sfx). Models aren't byte-reproducible across machines, so bytes-in-contract = a false claim; mirrors the existing "AAC bytes out of contract" precedent. Committed asset bytes are the anchor (like vendored assets/sfx/); recipe is reproducible-intent.
2. Cache key = hash(canonicalized recipe); committed asset is canonical (first-gen-wins). Key over {kind, model (version-tagged e.g. ace-step@1.5), prompt, seed, params, duration}, sorted/normalized — machine-stable so CI hits the same committed file; NOT bytes. Committed at assets/gen/<hash>.<ext>. Render: hash→resolve; hit uses it; miss+generators-enabled invokes the adapter & writes (atomic rename); miss+generators-disabled (CI) fails loudly w/ recipe hash + how to generate. Regen is explicit/surfaced, never silent.
3. Per-asset <asset>.provenance.json sidecar (model/prompt/seed/params/recipe hash/byte hash/adapter+version/timestamp); `reframe credits <scene>` aggregates sidecars into CREDITS.md (doc derived, not hand-kept).

DELIVERABLE:
1. `gen` recipe field on image/audio assets in IR + validation.
2. resolveGeneratedAsset(recipe)→path: content-addressed cache keyed by hash(recipe); pluggable generator registry (ACE-Step, Kokoro adapters shelling to existing venvs); mirror resolveCueFile caching.
3. provenance sidecar per asset.
4. re-author worldcup-glyph to declare assets via gen recipes.

VERIFIER:
- Determinism given cache: render declared worldcup-glyph twice (warm cache) → byte-identical mp4 (extend determinism.test.ts).
- Cache hit: render w/ generators disabled succeeds from cache; miss fails loudly w/ recipe hash.
- Provenance: every generated asset has a sidecar.

DONE-WHEN: worldcup-glyph w/ gen recipes renders identically to the hand-wired version (image plate bytes match, audio plan unchanged); two warm-cache renders byte-identical; generators-disabled uses cache, miss fails w/ hash; pnpm test + typecheck green; determinism doc updated w/ generated-asset boundary.

OUT-OF-SCOPE: making model output reproducible across machines; video-clip/scene sequencing; shipping model weights.



---

## goal-4 condition

Motion vocabulary: make motion requestable without canning it. Replace the one hard-coded sting motion with named presets that are SEEDED GENERATORS (same name → a family of distinct motions, never a clone), plus preview edit points that survive regen. Resolves two-determinisms: reproducibility kept; canned sameness killed by seeded variation, proven by the profiler. Builds on goal-2 + motionPath/path (landed).

ANCHOR (extend, don't rebuild): packages/core/src/{dsl.ts — presets compose existing motionPath/beat/path/tween/stagger + back/elastic/bounce eases, NO new IR; presets.ts NEW = motionPreset(name,opts); behaviors.ts — reuse wiggle's seeded value-noise as the PRNG, never Math.random}; benchmark/harness/motion/ — profiler IS the verifier (different / same-family / energy→overshoot); packages/preview/ + compose.ts — overlay already patches node props + beat at/gap/scale/order, ADD patching a motionPath step's `points` by label + draggable waypoint handles; examples/logo-sting/ — re-author onto a preset, generate.mts --motion <name> [--energy h] [--seed n].

DECISIONS (fixed — do not re-pick):
1. A preset is a SEEDED GENERATOR, not a template. motionPreset(name,{target,energy,speed,intensity,from,seed})→TimelineIR(a beat). seed drives a deterministic PRNG perturbing waypoints/micro-timing/accents WITHIN BOUNDED RANGES. Same (name,knobs,seed)→identical IR; different seed→measurably different motion still in the same family. Load-bearing (this is what makes presets not-canned); the verifier checks it directly.
2. Universal 2-knob + signature-1-knob. Every preset: energy(0..1 settle↔springy) + speed(duration ×) universal, + ≤2 signature knobs + seed. Fixed knob→IR map: energy→ease+overshoot; speed→beat time-scale (goal-2 scale); signature→amplitude (orbitSize/distance/spins) normalized 0..1→fixed range.
3. A preset emits a BEAT (goal-2): steps wrap in beat(name,…) so the motion is one addressable retimable unit and the overlay/regen moat applies. beat(name,{},…)≡seq keeps it additive.
4. Edit points = two layers on stable addresses. KNOBS are base-regeneration inputs (changing a knob re-runs the generator → new base IR), NOT overlay patches. HAND NUDGES are overlay patches surviving that regen: dragged waypoint writes timeline.<label>.points[i]; beat timing writes timeline.<beat>.{at,gap,scale}. Both address stable labels → knob regen doesn't discard them.

v1 PRESET SET (6): draw-bloom, punch-in, rise-settle, slide-bank, reveal-orbit, spin-forge. (assemble needs a multi-path rig; drift-cinematic is a hold-layer — phase 2.) Each emits a seeded beat.

VERIFIER: Reproducibility — (preset,knobs,seed) byte-identical twice (extend determinism.test.ts). Anti-canning (headline) — per preset render seeds 1..8 → profile each → pairwise distance in approved band [D_lo,D_hi]: >D_lo (different, not clone) AND <D_hi (same family). Knob monotonicity — energy↑→overshoot↑; speed↑→duration↓ (calibration-gate vs profiler). Additivity — goldens byte-identical; beat(name,{},…)≡seq. Edit survival — apply preset, overlay-edit a waypoint + nudge beat timing, change a knob (base regen) → both edits still apply (regen-contract harness). Preview — window.__store exposes waypoints+timing; overlay addresses resolve.

DONE-WHEN: 6 presets each emit a beat; same (name,knobs,seed) byte-identical twice; ≥2 presets' 8-seed pairwise distances all in [D_lo,D_hi]; energy+speed monotonic for ≥2 presets; all goldens byte-identical + beat(name,{},…)≡seq; waypoint + beat-timing overlay edits survive a knob base regen; preview shows draggable handles emitting resolving patches; logo-sting re-authored + generate.mts --motion works on react/figma/vercel; pnpm test + typecheck green.

OUT-OF-SCOPE: NL→preset selection (LLM emits {preset,knobs,seed} — skill layer, not unit-verifiable here; engine designed for it); new easing math; assemble/drift-cinematic; full timeline GUI; per-logo auto tailoring beyond knobs; changing goal-2/non-preset compilation.

---

## goal-5 condition

Motion ops library + add-motion in the editor: a GSAP-style toolkit of everyday motion ops (rotate, zoom, ken-burns, slide, fade, draw-on, pulse) that apply to ANY node (text, logo paths, shapes), authorable in code AND addable/editable in the preview, folding to code. Today the overlay only PATCHES existing labeled motion; there's no named op set for arbitrary nodes and no way to ADD motion in the editor. Builds on motionPreset + the tween/motionPath/behavior primitives + the preview editing loop.

ANCHOR (extend, don't rebuild): packages/core/src/{presets.ts → sibling motionOps.ts: motionOp(name,target,opts) over existing dsl factories, NO new IR; dsl.ts tween/to/motionPath/oscillate/wiggle it composes; compose.ts — NEW `addTimeline` overlay verb + OverlayDoc type}; packages/preview/{main.ts,panel.ts} — "add motion ▸ <op>" on the selected node + per-op knobs + Tier-1 trail preview; examples/{logo-sting,scenes} — ops on a logo + text.

DECISIONS (fixed — do not re-pick):
1. A motion op is a PARAMETERIZED FRAGMENT over existing primitives, not new IR. motionOp(name,target,opts)→{setup?,timeline} emitting tween/motionPath/behavior wrapped in a labeled beat. Op set: rotate, zoom (scale pop), ken-burns (slow scale+drift), slide-in (from dir), fade, draw-on (path progress), pulse (oscillate). Targets ANY node by id; energy/speed/amount knobs like presets.
2. Adding motion in the editor = a NEW overlay verb `addTimeline: TimelineIR[]` that APPENDS timeline fragments to the scene (mirroring the existing `addNodes`), composed in `par` with the base under stable beat labels so the added op is then patchable AND foldable. This is the load-bearing change: the overlay goes from "patch existing motion" to "ADD new motion." composeScene appends + validates + reports orphans if the target id is gone.
3. Additive + determinism-safe: no base scene uses addTimeline, so all goldens stay byte-identical; ops compose on top of a node's existing animation; folding an added op to code = a literal motionOp(...) call (hand-authored scenes) or stays an overlay (preset scenes).

DELIVERABLE: 1) motionOps.ts: motionOp for ~7 ops, each a labeled beat of existing primitives, exported. 2) compose.ts: addTimeline overlay verb (append, validate, report) + type. 3) preview: select node → "add motion ▸ <op>" → writes addTimeline; per-op knobs editable; Tier-1 trail preview; fold to code. 4) ops on a logo (rotate/zoom/ken-burns) + text (fade/slide-in).

VERIFIER: each op byte-identical twice + every golden byte-identical (additive). addTimeline compose — base + overlay adding "ken-burns" on a node renders the drift; bad target id orphans loudly (regen-contract harness). Editor fold — add an op in preview, exportDraft (has addTimeline), fold to a motionOp(...) literal → re-render byte-identical to the overlay render (the loop's fold proof). pnpm test + typecheck green.

DONE-WHEN: ~7 ops each emit a labeled beat; addTimeline overlay verb + validation + orphan report; preview add-motion affordance + per-op knobs + trail preview; ops demonstrated on a logo AND text; an editor-added op folds to code byte-identical to its overlay render; all goldens byte-identical; pnpm test + typecheck green.

OUT-OF-SCOPE: physics/inertia/throw; scroll/observer/draggable (no DOM); parametric easing beyond cubicBezier; full timeline-track GUI; autonomous AI op selection (chat co-pilot / later skill layer).

---

---

## goal-6 condition

Universal canvas editability: make ANY scene editable in the preview. Today canvas drag only grabs top-level non-group/non-line nodes, so every group-based scene (reframe-demo, the stings, the showcases) has nothing to drag — the visible text/shapes are nested children. Add: drag groups, drag nested children, add/duplicate/delete nodes — all stable-address overlay edits surviving a base regen. Unblocks "detailed work in the UI"; the floor goal-7's agent↔UI round-trip stands on. Builds on goal-5 addTimeline + the overlay/regen loop.

ANCHOR (extend, don't rebuild): packages/preview/src/main.ts — mousedown drag + topLevel set: extend hit-test to (a) top-level GROUPS (x/y are scene coords → 1:1 delta) and (b) NESTED leaf children (invert the parent-accumulated matrix to map the scene delta into the child's parent space); canvas click selects under the cursor. packages/core/src/evaluate.ts — matrix stack already exists; expose nodeWorldMatrix(compiled,id,t) (pure, NO new IR). packages/preview/src/{store.ts — setNodeProp already patches any id; add addNode/duplicateNode/removeNode on the addNodes/draft.addNodes path; panel.ts — "add node ▸ text/rect/ellipse" + duplicate/delete}. packages/core/src/compose.ts — addNodes verb exists; NEW removeNodes:string[] verb (overlay-added only) + type.

DECISIONS (fixed — locked by the human):
1. The editable unit is ANY node by stable id, nested or not — NO new addressing scheme. A nested-child drag writes nodes.<childId>.x/y in the child's PARENT space (editor inverts the node's parent-accumulated matrix at the current time to convert the scene-space delta). A group drag writes nodes.<groupId>.x/y and moves the whole subtree. Same overlay verbs; more nodes become grabbable.
2. Add-node = the existing addNodes overlay verb (complete nodes appended at root, owned by the overlay). UI offers text/rect/ellipse with sensible defaults at canvas center; the added node is then immediately draggable AND motion-addable (composes with goal-5 addTimeline).
3. Delete is non-destructive by default. removeNodes removes only OVERLAY-ADDED nodes (the overlay owns them). Removing a BASE node is refused + reported loudly — base nodes are hidden via opacity:0, never deleted, so the overlay never silently drops the regenerated design.
4. Additive + determinism-safe. No base scene uses addNodes/removeNodes; nodeWorldMatrix is pure math over transforms evaluate already computes. All goldens byte-identical; no render change.

DELIVERABLE: 1) evaluate.ts nodeWorldMatrix(compiled,id,t), exported+tested. 2) main.ts drag for groups AND nested children (matrix inversion); click selects under cursor. 3) store.ts+panel.ts add-node (text/rect/ellipse)+duplicate+delete (overlay-added only). 4) compose.ts removeNodes verb+type. 5) reframe-demo editable end-to-end.

VERIFIER: Matrix — nodeWorldMatrix on a known nested scene matches evaluate's rendered op transform for that id; inverting it lands a dragged op under the cursor within ε. Survival — a nested-child x/y edit survives a base regen by stable id (regen-contract harness). Add/delete — addNode then removeNode round-trips to an empty overlay diff; base-node removal refused+reported (not silent); goldens byte-identical. pnpm test + typecheck green.

DONE-WHEN: canvas drag moves (a) a top-level group and (b) a nested leaf child, both writing stable nodes.<id> patches that survive regen; nodeWorldMatrix tested against evaluate; add-node+duplicate+delete (overlay-added only) in the panel, base-node delete refused+reported; reframe-demo editable end-to-end (nested drag + group drag + add/delete); all goldens byte-identical; pnpm test + typecheck green.

OUT-OF-SCOPE: rotation/scale handles on canvas (x/y drag only); multi-select/marquee; snapping/guides/alignment; the agent↔UI file round-trip (goal-7); NL→scene .ts sketch (goal-8); editing motionPreset knobs in-preview; nested drag for line (separate gesture).

---

---

## goal-9 condition

Composition — the three-graph model made real. reframe is single-scene; SceneIR has no layer above it, so "scene 간 구분" has no representation. Add a Composition layer ABOVE SceneIR (multi-scene render), extend beat to own a node subset (the intent graph), and surface all three graphs in the preview. Builds on goals 2/3/5/6.

ANCHOR (extend, don't rebuild): ir.ts — NEW CompositionIR {id,scenes:{scene:SceneIR,transition?,at?}[],audio?}; beat gains additive nodes?:string[]. dsl.ts — composition() factory; beat(name,{nodes?},…). compile.ts/sibling — compileComposition: per-scene durations → scene start times honoring transitions/overlaps → total. audio.ts — composition AudioPlan: offset each scene's cues by its start + composition bgm (kokoro via goal-3 gen). render-cli/reframe.ts — render <composition.ts> → ffmpeg concat/xfade → one deterministic mp4; --scene <id> standalone. preview/ — scene navigator (filmstrip → open scene in existing editor) + per-scene timeline grouped by beat. validate.ts — validateComposition.

DECISIONS (fixed — locked by the human):
1. Composition is a NEW top-level IR wrapping independent SceneIRs — composition({id,scenes:[{scene,transition?,at?}],audio?}). Each scene is a normal SceneIR (renders/previews/overlays standalone, byte-identical to today). Composition renders each scene + concatenates with transitions into one deterministic mp4. NO change to SceneIR, evaluate, or single-scene compile — composition is a layer above.
2. A beat may own a node subset: beat(name,{nodes?:string[]},children) — purely additive metadata. Does NOT touch compile/evaluate (semantic annotation only); the preview groups node+timeline tracks under the beat, overlay/regen address it by stable name. beat(name,{},…) stays byte-identical to seq.
3. The preview surfaces all three graphs: a scene navigator (composition filmstrip; click a scene → existing per-scene editor) + a per-scene timeline grouped by beat (each beat a track group of its owned nodes' lanes + label markers). Editing is per-scene; composition is navigated + retimed.
4. Audio composes at the composition level. A composition audio (bgm spanning scenes) layers over per-scene cues; the composition AudioPlan offsets each scene's cues by that scene's start. Determinism contract extends to the composition AudioPlan + WAV bytes (same boundary — not AAC-in-mp4).

VERIFIER: Determinism — a 2-scene composition renders byte-identically twice (extend determinism.test.ts); AudioPlan byte-stable. Scene independence — a scene inside the composition equals rendering that SceneIR alone (modulo time offset). Beat additivity — beat(name,{nodes:[…]},…) byte-identical to beat(name,{},…); all goldens byte-identical. Survival — an overlay beat-retime + an owned-node edit survive a base regen by stable name/id (regen-contract). Audio/layout — per-scene cues offset by start; bgm spans; AudioPlan total = composition duration; scene starts honor transitions. test + typecheck green.

DONE-WHEN: CompositionIR + composition() + beat additive nodes?; compileComposition lays out scene times w/ transitions; render <composition.ts> → deterministic mp4 (byte-identical twice) + --scene <id> standalone; scene identical inside vs alone (modulo offset); composition AudioPlan byte-stable + offsets cues + bgm; preview scene navigator + per-scene beat-grouped timeline (track groups + label markers); beat-retime + owned-node edit survive regen; beat(name,{nodes},…) byte-identical to beat(name,{},…); all goldens byte-identical; test + typecheck green.

OUT-OF-SCOPE: NL→composition (goal-8); the agent↔UI file round-trip (goal-7); transitions beyond a small set (cut, crossfade/xfade); cross-scene editing in one gesture; a node-graph dependency editor (intent stays beat-grouping); kokoro/ACE-Step model wiring (goal-3 gen — here only the audio slot + plan); any change to single-scene evaluate/compile.
