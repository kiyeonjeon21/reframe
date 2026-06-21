# Regeneration contract

Overlay documents address nodes by `id` and states by name. For human edits to
survive an AI regeneration of the base scene, the regeneration prompt must
include the contract below, alongside the current scene IR (JSON or eDSL
source):

> You are regenerating an existing reframe scene. The current scene is
> provided. You may change layout, timing, styling, and add new nodes freely —
> but for every node whose concept survives your redesign, you MUST keep its
> `id` unchanged, and you MUST keep state names unchanged. The same applies to
> timeline step `label`s. Node ids, state names, and timeline labels are
> stable addresses that external edit layers reference; renaming one silently
> orphans a human's edit.

When the contract is broken anyway, `composeScene` skips the affected edits
and reports them as orphans with the known-ids list — loud, diagnosable,
never a silent drop and never a render failure.

## Generated subtrees (devicePreset, rig/humanoid)

Generators emit nodes with deterministic ids under an instance prefix, and those
ids are stable addresses too. For `devicePreset(name,{id})` the screen/content
parts are `${id}-screen` / `${id}-content`. For `rig(...)` / `humanoid({id})`
each joint is `${id}-${jointName}` (e.g. `hero-armUpperR`) and its bone art is
`${id}-${jointName}-shape`. Across a regen, **keep the instance `id` and the
joint `name`s** for any character/device that survives the redesign — overlay
edits (a retimed wave, a nudged limb angle) reference those exact ids. Renaming a
joint orphans the edit, exactly like renaming a hand-authored node id.

## Structural edits (add / remove / reorder / insert)

Beyond patching props and timing, an overlay can change the **structure** of the
timeline and the node tree — and those edits survive regen the same way, keyed by
stable labels. The full vocabulary:

| field | does | orphans when |
|---|---|---|
| `addNodes` | append new node(s) at the root, painted on top | unknown `before`/`after` sibling id |
| `insertNodes` | splice node(s) at a position (`before`/`after` a sibling, or `index`) | unknown `before`/`after` sibling id |
| `removeNodes` | remove an overlay-*added* node (a base node is refused — hide it with `opacity: 0`) | a base node id, or an unknown id |
| `addTimeline` | append motion (a `par` with the base) onto existing nodes | the target node is missing |
| `insertTimeline` | splice a step/beat into a named beat (`{ into, before/after/index, step }`) | unknown `into`, target node, or sibling |
| `removeTimeline` | splice a beat/step out of its parent by label | unknown label, or base regen dropped it |
| `order` (on a beat) | re-sort beats within their parent `seq` | — (a normal `timeline.<beat>` patch) |

The patch-existing ops (reorder/remove) and the create ops (add/insert) differ in
one way: insert/add **create** elements, so the overlay carries the full node + beat
JSON (a consumer or you author it; reframe does not generate the payload). A single
overlay can combine them — reorder, remove, retitle, and insert in one document:

- **Reorder** — patch a beat's `order` (the existing `timeline.<beat>.order`
  param): `{ "timeline": { "shot-2": { "order": 0 }, "shot-0": { "order": 2 } } }`
  re-sorts beats within their parent `seq`. Beats move as whole units, so child
  labels and any overlay edits on them ride along.
- **Remove** — `removeTimeline: ["shot-2"]` splices a beat/step out of its parent
  by label. The surrounding `seq` re-accumulates, so later steps ripple up and any
  label-anchored dependent (a clip `start`, an anchored title) follows. An unknown
  label is reported as an orphan, never a silent drop.
- **Insert** — `insertNodes` places a new node at a position (`before`/`after` a
  sibling id, or an `index`) instead of appending on top like `addNodes`, and
  `insertTimeline` splices a step/beat into a named beat (`{ into, after, step }`).
  Together they add a whole new unit. Unlike reorder/remove (which patch existing
  addressable elements), insert *creates* elements, so the overlay carries the full
  node + beat JSON — a consumer (an embedding app) or you author it; reframe does not
  generate the shot payload. Unknown `into`/`before`/`after` or a step targeting a
  missing node is an orphan.

A combined overlay — reorder + remove + retitle, then insert a new unit:

```jsonc
{
  "reframeOverlay": 1,
  "target": "vector-montage",
  "removeTimeline": ["shot-3"],
  "timeline": { "shot-1": { "order": 2 }, "shot-2": { "order": 1 } },
  "nodes": { "shot-0-title": { "content": "REORDERED" } },
  "insertNodes": [
    { "after": "shot-2", "node": { "type": "group", "id": "shot-x", "props": { "opacity": 0 }, "children": [/* … */] } }
  ],
  "insertTimeline": [
    { "into": "montage", "after": "shot-2", "step": { "kind": "beat", "name": "shot-x", "nodes": ["shot-x"], "children": [/* … */] } }
  ]
}
```

These ride the addressable surface a `photoMontage` already exposes — each shot is
the named beat `shot-${i}`, so `removeTimeline: ["shot-3"]` drops a shot (its layer
just stays invisible — it never fades in) and an `order` patch reshuffles the cut,
both without touching the base. Swapping a shot's image is a plain `nodes.<id>.src`
patch. (Caveat: a node that still **anchors** to a removed label — e.g. a video
`start: "shot-3"` — must also be neutralised, by patching its `start` to a number,
or post-compose validation rejects the dangling anchor. Reordering a shot to the
first slot drops its opening fade-up, since the crossfade offset was baked for the
original order — a cosmetic detail, not a break.)

See `examples/overlays/montage-restructure.json` (reorder + remove) and
`examples/overlays/montage-insert.json` (insert a hand-authored shot) for the photo
montage, or `examples/scenes/vector-montage.ts` with `vector-montage-restructure.json`
/ `vector-montage-insert.json` for a pure-vector version that renders standalone (no
image assets):

```bash
reframe verify-overlay examples/scenes/vector-montage.ts \
  examples/overlays/vector-montage-restructure.json   # 4 applied, 0 orphaned
reframe render examples/scenes/vector-montage.ts \
  --overlay examples/overlays/vector-montage-insert.json
```

## Tooling

Three read-only commands make the address namespace queryable and the contract
checkable (no render):

- `reframe manifest <scene> [--json]` — list every editable address (nodes +
  their editable/animated props, states, timeline labels with patchable params,
  beats, behaviors). Read it before patching so you target real, stable addresses.
- `reframe lint <scene> [--strict]` — flag motion with no `label` (timing an
  overlay can't reach and a regen can silently drop) + a `motionAddressableRatio`,
  AND verify the scene is a **pure function of time**: it bundles + evaluates the
  source twice and flags any IR that differs (a `Math.random()`/`Date` baked into a
  prop). A non-pure scene compiles to a different IR each time, so its render is not
  reproducible — use a seeded `wiggle()` or a scene knob instead.
- `reframe verify-overlay <base> <overlay>...` — compose the overlay onto a base
  and report applied vs orphaned. Run it against the regenerated base to prove
  every edit survived; it exits non-zero if any address broke.
