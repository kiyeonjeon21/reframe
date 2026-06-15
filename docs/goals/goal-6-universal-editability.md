# Goal 6 — Universal canvas editability (any scene, not just leaf scenes)

## Objective

The preview can drag a node on the canvas, but only **top-level leaf nodes**
(`main.ts` excludes `group` and `line`). Every real scene — `reframe-demo`,
the logo stings, the showcases — is built from **groups with nested children**,
so on the canvas there is **nothing to grab**: the visible text/shapes are
children, and the only top-level nodes are the groups. There is also no way to
**add** a node (text/shape) in the editor. Make any scene fully editable on the
canvas: drag groups, drag nested children, add/duplicate/delete nodes — all as
stable-address overlay edits that survive a base regeneration. This is the
blocker under "do detailed work easily in the UI", and the agent↔UI round-trip
(goal-7) depends on it.

## The load-bearing change

Dragging a **nested child** needs the child's delta expressed in its parent's
space: a scene-space mouse delta must be mapped back through the node's
**parent-accumulated transform**. `evaluate` already builds that matrix stack to
render; the keystone is exposing it as a pure helper
(`nodeWorldMatrix(compiled, id, t)`) the editor can invert — **no new IR, no
render change**. The overlay address stays `nodes.<id>.x/y` (already stable), so
nested edits survive regen for free.

## Anchor (extend, don't rebuild)

- `packages/preview/src/main.ts` — `opCorners` (~129), `clientToScene` (~282),
  the `mousedown` drag and `topLevel` set (~307–332): extend the hit-test to
  (a) top-level **groups** (their `x/y` are scene coords → 1:1 delta) and
  (b) **nested leaf children** (invert the parent-accumulated matrix to map the
  scene delta into the child's parent space). Canvas click selects the node
  under the cursor.
- `packages/core/src/evaluate.ts` — the matrix stack already exists; expose
  `nodeWorldMatrix(compiled, id, t)` (the node's parent-accumulated transform).
  Pure, tested. **No new IR.**
- `packages/preview/src/store.ts` — `setNodeProp` already patches any id (nested
  or not). Add `addNode` / `duplicateNode` / `removeNode` on the existing
  `addNodes` / `draft.addNodes` path.
- `packages/preview/src/panel.ts` — sibling to `renderMotionOps` (~343): an
  "add node ▸ text/rect/ellipse" affordance + duplicate/delete on the selected
  node.
- `packages/core/src/compose.ts` — `addNodes` verb exists; add a `removeNodes:
  string[]` verb (overlay-added nodes only) + type.

## Decisions (fixed — locked by the human)

1. **The editable unit is ANY node by stable id, nested or not — no new
   addressing scheme.** A drag on a nested child writes `nodes.<childId>.x/y` in
   the child's **parent space** (the editor inverts the node's
   parent-accumulated matrix at the current time to convert the scene-space
   delta). A drag on a group writes `nodes.<groupId>.x/y` and moves the whole
   subtree. Same overlay verbs as today; more nodes simply become grabbable.
2. **Add-node = the existing `addNodes` overlay verb** (complete nodes appended
   at root, owned by the overlay). The UI offers text/rect/ellipse with sensible
   defaults at canvas center; the added node is then immediately draggable AND
   motion-addable (composes with goal-5's `addTimeline`).
3. **Delete is non-destructive by default.** `removeNodes` removes only
   **overlay-added** nodes (the overlay owns them). Removing a **base** node is
   refused and reported loudly — base nodes are hidden via `opacity: 0`, never
   deleted, because the base owns them and the overlay must not silently drop the
   regenerated design.
4. **Additive + determinism-safe.** No base scene uses `addNodes`/`removeNodes`;
   the matrix helper is pure math over the transforms `evaluate` already
   computes. All goldens stay byte-identical; no render change.

## Deliverable

1. `evaluate.ts`: `nodeWorldMatrix(compiled, id, t)` — the node's
   parent-accumulated matrix; pure, exported, tested.
2. `main.ts`: canvas drag works for (a) top-level groups and (b) nested leaf
   children (matrix inversion); canvas click selects the node under the cursor.
3. `store.ts` + `panel.ts`: add-node (text/rect/ellipse), duplicate, delete
   (overlay-added only) on the selected node.
4. `compose.ts`: `removeNodes` overlay verb (overlay-added only; base-node
   removal refused + orphan-reported) + type.
5. `reframe-demo` (a group-based scene) demonstrably editable: drag a nested
   text, drag a group, add a node, delete it.

## Verifier

- **Matrix correctness:** `nodeWorldMatrix` on a known nested scene matches the
  rendered op transform for that id (unit test); inverting it maps a scene-space
  delta into the child's parent space so the dragged op lands under the cursor
  (within ε).
- **Drag survival:** a nested-child `x/y` overlay edit survives a base regen by
  stable id (regen-contract harness).
- **Add/delete:** `addNode` then `removeNode` round-trips to an empty overlay
  diff; removing a **base** node is refused + reported (not silently applied);
  all goldens byte-identical.
- **Editor demo:** on `reframe-demo`, `exportDraft` after dragging a nested text
  contains `nodes.<id>.x/y`; after dragging a group contains
  `nodes.<group>.x/y`.
- `pnpm test` + `pnpm typecheck` green.

## Done-when

Canvas drag moves (a) a top-level group and (b) a nested leaf child, both writing
stable `nodes.<id>` overlay patches that survive regen; `nodeWorldMatrix` tested
against `evaluate`; add-node (text/rect/ellipse) + duplicate + delete
(overlay-added only) in the panel, base-node delete refused + reported;
`reframe-demo` editable end-to-end (nested drag + group drag + add/delete
demonstrated); all goldens byte-identical; `pnpm test` + `pnpm typecheck` green.

## Out-of-scope

Rotation/scale handles on the canvas (x/y drag only this goal); multi-select /
marquee; snapping / guides / alignment; the agent↔UI file-based round-trip
(goal-7); NL → scene `.ts` sketch (goal-8); editing `motionPreset` knobs
in-preview; nested drag for `line` (two endpoints — a separate gesture).
