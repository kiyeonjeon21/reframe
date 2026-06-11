# NL-loop experiment — can the loop actually be driven in natural language?

**Date:** 2026-06-11. **Question:** the project's last untested hypothesis: a user
iterates a video purely through vague natural-language requests across multiple
sessions, with a personal overlay in play — does the loop hold, or does it leak
(silent edit loss, masked changes, unsatisfiable vagueness)?

**Method:** 5 scripted turns of realistic Korean requests, each handled by a
**fresh agent with no session memory** (worst case: every turn is a cold session).
The agent's only context: repo CLAUDE.md conventions (read the guide, follow the
regen contract), the conversation transcript, and — from turn 3 — the user's render
command showing an `--overlay` flag, exactly what a real session's history shows.
After turn 2, a simulated human preview edit was saved as an overlay
(`human-edits.json`: background color, underline brand color, tagline color,
`coming-soon` retiming) and all subsequent renders used it. Turn snapshots in
`turns/`, judged frames in `frames/`.

## Turns and outcomes

| turn | request (verbatim) | outcome | repairs |
|---|---|---|---|
| 1 | "'NOVA'라는 앱 출시 티저… 10초… 다크하고 모던… 마지막에 COMING SOON" | generated supernova→wordmark→COMING SOON, 9.8s | 0 |
| 2 | "좀 심심한데? 훨씬 더 다이나믹하게" | camera zoom/shake, accretion disc, sparks, letter slams — **all 17+ ids, all 10 labels kept**, only additions | 0 |
| 3 | "글자는 좀 우아하게… 전체를 8초 이내로" | letter entrance rewritten, back half compressed; agent **accounted for the overlay's +1.0s stretch** when checking the 8s budget; overlay 4/4 applied | 0 |
| 4 | "태그라인은 아예 빼버려… nova.app 작게 넣어줘" | tagline removed → the human's `nodes.tagline.fill` edit **orphaned loudly with diagnosis** (designed behavior); agent volunteered the orphan explanation to the user, offered cleanup, and told them the new node's overlay address (`nodes.url.*`) | 0 |
| 5 | **trap:** "배경이 너무 새까만데, 살짝 보라 톤이 돌게" — but the human overlay already overrides `scene.background`, so a base-only edit would be invisible | agent **detected the mask unprompted**, changed the base AND removed the superseded overlay entry, then verified the user's actual render path at the pixel level (`(10,6,19)` ≈ `#0C0714`) and explained the conflict in Korean | 0 |

**Vagueness check (turn 2), measured with our own motion profiler** rather than
eyeballing stills: staticFraction 0.66 → 0.23, longest static run 2.23s → 0.67s,
meanDiff 0.91 → 2.04 (2.2×), saturated motion pairs 1 → 7. The vague request
"더 다이나믹하게" was objectively satisfied.

## Verdict

**The loop holds: 5/5 requests satisfied, 0 render repairs, 0 silent edit
losses, 1 designed orphan, 1 mask conflict detected and resolved.** The reason
is structural, not agent brilliance: every turn is *verifiable*. The compose
report surfaces breaks at render time, stable addresses give the agent
something to reason about ("the overlay stretches coming-soon by 0.4s, so my
budget is 7.6s"), and deterministic renders make pixel-level verification
cheap. An HTML/React substrate gives none of those checkpoints — the same
agents would have had to diff freeform code and hope.

## Hazards found (real, worth fixing)

1. **Coordinate-space drift under a kept id.** Turn 2 moved `stage` inside a new
   `camera` group; its id survived but its x/y became group-relative
   (960→−960). An overlay holding `nodes.stage.x` would still *apply* — and
   silently produce wrong layout. The regen contract protects names, not
   coordinate-space semantics. Candidate contract addendum: "if you reparent a
   node, its position props change meaning — treat that as a rename for
   overlay purposes (or keep its absolute placement identical)."
2. **Overlay ownership is policy-undefined.** The turn-5 agent edited the
   *human's* overlay file (removing the superseded background entry). Here it
   was the right call and was explained — but nothing in the contract says
   when an AI may touch the human layer. Candidate rule: AI never edits
   overlays except to resolve a mask that the user's new request supersedes,
   and must say so explicitly.
3. **Stale orphans accumulate as noise.** The dead `tagline` entry warned on
   every subsequent render. Agents offered cleanup but (correctly) didn't act
   unprompted. A `reframe overlay prune` or a preview "remove orphan" button
   would close this loop.

## Honest caveats

Single run, single scene, scripted (not live) user turns written by the
experimenter; the trap's discoverability depended on the `--overlay` flag being
visible in the conversation (realistic, but a live user might not paste their
render command); the agents share a model family with the contract's author.
The strongest version of this experiment is a live session where the user
drives — this run establishes that the substrate doesn't leak under the five
failure modes we could script.

## Artifacts

- `turns/turn-{1..5}.scene.ts` — scene state after each turn
- `human-edits.json` — the simulated preview overlay (post-turn-5 state: the
  background entry removed by the turn-5 agent; the orphaned tagline entry
  intentionally left as found)
- `frames/t{1..5}-*.png` — judged filmstrips
- final scene: `examples/scenes/nova-teaser.ts`; final render:
  `out/nova-teaser-edited.mp4`
