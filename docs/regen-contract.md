# Regeneration contract

Overlay documents address nodes by `id` and states by name. For human edits to
survive an AI regeneration of the base scene, the regeneration prompt must
include the contract below, alongside the current scene IR (JSON or eDSL
source):

> You are regenerating an existing reframe scene. The current scene is
> provided. You may change layout, timing, styling, and add new nodes freely —
> but for every node whose concept survives your redesign, you MUST keep its
> `id` unchanged, and you MUST keep state names unchanged. Node ids and state
> names are stable addresses that external edit layers reference; renaming one
> silently orphans a human's edit.

When the contract is broken anyway, `composeScene` skips the affected edits
and reports them as orphans with the known-ids list — loud, diagnosable,
never a silent drop and never a render failure.
