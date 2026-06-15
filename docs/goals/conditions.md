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
