# Goal 3 — Asset-aware generation (declared, deterministic asset orchestration)

## Objective

Turn the manual wiring used to make `worldcup-glyph` (ACE-Step music + Kokoro
narration + generated image plates, all stitched by hand in the shell) into
**declared scene data**: a scene says *which* assets it needs and *how* to
generate them, and the render pipeline produces them deterministically and
caches them. This makes reframe an assembly engine for AI-generated media —
the niche pixel-generators do not occupy — without touching the determinism
contract.

## Anchor (extend, do not rebuild)

- `packages/core/src/ir.ts` — image node (`ImageProps`), `AudioIR`.
- `packages/core/src/assets.ts` — `collectImageSrcs`; extend to collect all
  declared generated assets.
- `packages/render-cli/src/images.ts` — `buildImageAssets` (resolve → data URL,
  fail-before-browser). The generation-resolution analog lives next to this.
- `packages/render-cli/src/audio/sfx.ts` — `resolveCueFile` (content-addressed
  tmp cache with atomic rename). Reuse this caching pattern verbatim.
- `packages/render-cli/scripts/gen-worldcup-frames.ts`,
  `examples/scenes/glyph-frames-wc/CREDITS.md` — the manual process being
  formalized; the provenance model to preserve.

## Design decision (human — approve before building)

The load-bearing choice: **where does generation live relative to the
determinism contract?** Generative models (ACE-Step, image models) are NOT
byte-deterministic across machines; the contract today covers the AudioPlan +
synth WAV bytes, not model output. Proposed boundary (review/adjust):

```ts
// a generated asset is declared with a recipe + a pinned seed; its OUTPUT is
// content-hashed and committed/cached, so the SCENE is deterministic given the
// cached asset, even though regenerating the asset is not.
image({ id: "plate-3", gen: { kind: "image", model: "...", prompt: "...", seed: 7 }, ... })
```

**Decisions (v1) — made; each rationale IS the boundary it draws:**

1. **The contract covers recipe + content hash, NOT model-output bytes.** A
   scene is "deterministic given its resolved assets" — exactly as it is already
   "deterministic given fonts/sfx files." Generative models (ACE-Step/Kokoro/
   image) are not byte-reproducible across machines, so putting their bytes in
   the contract would make a false claim; this is the only honest line, and it
   mirrors the existing "AAC-encoded mp4 bytes are out of contract" precedent.
   The committed/cached asset bytes are the determinism anchor (like vendored
   `assets/sfx/`); the recipe is the reproducible-*intent* record. Document as a
   one-line extension of that gotcha.

2. **Cache key = hash(canonicalized recipe); committed asset is canonical
   (first-generation-wins).** The key is `hash` over {kind, model (version-
   tagged, e.g. `ace-step@1.5`), prompt, seed, params, duration}, canonicalized
   (sorted keys, normalized whitespace) — machine-stable, so CI and other
   machines hit the same committed file. NOT the output bytes. Committed assets
   live at `assets/gen/<hash>.<ext>`. On render: hash recipe → resolve committed
   file → **hit** uses it; **miss with generators enabled** invokes the adapter
   and writes it (atomic rename, mirroring `resolveCueFile`); **miss with
   generators disabled** (CI/offline) fails loudly naming the recipe hash + how
   to generate (mirror `images.ts`'s tried-paths error). Regenerating a recipe
   is an explicit, surfaced act (bump the model tag or bust the cache) — never
   silent, like every other edit in this project.

3. **Per-asset `<asset>.provenance.json` sidecar; CREDITS.md is derived, not
   hand-kept.** Each committed asset gets a co-located sidecar (model, prompt,
   seed, params, recipe hash, byte hash, adapter+version, timestamp) — atomic
   and local, matching the codebase's content-addressed-file discipline. A
   `reframe credits <scene>` command aggregates sidecars into the human-readable
   CREDITS.md form, so provenance is authored once (by the generator) and the
   doc is generated.

## Deliverable

1. A `gen` recipe field on image/audio assets in the IR (+ validation).
2. `resolveGeneratedAsset(recipe) → path`: content-addressed cache keyed by
   `hash(recipe)`; on miss, invoke the declared generator (pluggable: a
   generator registry, with ACE-Step and Kokoro as the first two adapters,
   shelling to the existing venvs); on hit, use the cached/committed file.
   Mirror `resolveCueFile`'s atomic-rename caching.
3. Provenance sidecar: `<asset>.provenance.json` (model, prompt, seed, hash).
4. Re-author `worldcup-glyph` to *declare* its assets instead of referencing
   hand-made files — proving the formalization reproduces the manual result.

## Verifier

- **Determinism given cache**: render the declared `worldcup-glyph` twice with
  assets cached → byte-identical mp4 (extend `determinism.test.ts`). The
  contract is "deterministic given resolved assets", exactly like fonts/sfx.
- **Cache hit**: second render with no model available (generators disabled)
  still succeeds from cache; a cache miss with generators disabled fails loudly
  naming the missing asset + its recipe hash (mirror `images.ts` error style).
- **Provenance**: every generated asset has a sidecar with model/prompt/seed.

## Done-when

- `worldcup-glyph` re-authored with `gen` recipes renders identically to the
  current hand-wired version (frame bytes match for the image plates; audio
  plan unchanged).
- Two renders with warm cache are byte-identical.
- Generators-disabled render uses cache; miss fails with recipe hash in the
  message.
- `pnpm test` + `pnpm typecheck` green; determinism contract doc updated with
  the generated-asset boundary.

## Out-of-scope

- Making model output itself reproducible across machines (explicitly outside
  the contract; that is the model's problem, not reframe's).
- Video-clip assets / scene-to-scene sequencing (a later goal; this is
  single-asset generation only).
- Shipping model weights — adapters shell to user-provided venvs/APIs.
