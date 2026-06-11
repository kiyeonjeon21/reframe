# Qualitative analysis — eDSL vs HTML+GSAP generation benchmark

> Companion to the auto-generated `RESULTS.md` (which is overwritten by
> `summarize.ts`; this file is hand-written and stable). 30 runs:
> 5 tasks x 2 arms x 3 trials, single-shot generation, blind LLM judge.
> Directional signal only — n is small and the judge is an LLM.

## Headline

**The cold-start hypothesis against a new eDSL did not materialize.** A
~1,700-token guide with two worked examples was enough for the model to
produce 15/15 first-attempt, validation-clean, renderable reframe scenes —
exactly matching the HTML+GSAP arm (15/15), a format the model has seen
billions of examples of. Zero repair rounds were needed in either arm.
Hyperframes' "LLMs already think in HTML so HTML generates better" claim is
not supported at the reliability level: **format familiarity was not the
bottleneck; both formats were 100% generatable.**

Quality lands slightly in HTML's favor (judge total 21.47 vs 20.40 of 25;
overall 4.07 vs 3.87) — but the gap is explained almost entirely by one
systematic eDSL runtime gap, not by generation ability (see below).

## Where each arm lost points

### eDSL losses are concentrated and fixable (runtime gaps, not generation gaps)

1. **Decimal count-up impossible** (chart-buildup t1: 17, t2: 17). The brief
   required "8.2"-style one-decimal labels counting up. reframe renders
   numeric `content` rounded to integers, so two of three eDSL trials showed
   "8, 9, 11, 14" — an automatic fidelity-2 per the rubric. Both runs were
   otherwise scored clean (layout 4, motion 4, polish 4). Trial 3 avoided the
   trap and scored 23. **Fix: a number-formatting prop on text nodes (e.g.
   `contentDecimals: 1`). This single runtime fix would have moved the eDSL
   mean from 20.40 to ≈21.2, statistical noise from HTML's 21.47.**
2. **Behaviors are scene-global** — briefs asked for pulses/floats "during
   the hold", but `oscillate` runs for the whole scene; generated scenes
   either used tiny amplitudes (judges: "imperceptible") or skipped nuance.
   Fix: optional `from`/`until` time bounds on behaviors.
3. **Scale-from-zero artifact** (transition t2/t3): an underline tweened from
   scale 0 still rasterizes as a dot at frame 0. Authoring-pattern issue;
   guide should say "pair scale-in with opacity 0".

### HTML losses are unsystematic (classic generation variance)

The HTML arm's only bad run was catastrophic rather than mechanical:
transition t1 (score 14) wrote the wrong title text ("SOLUTION" instead of
"THE SOLUTION") and pinned it to the left frame edge. It also produced
lingering sweep artifacts (t2: "orange residue ... visible seam") and
unbriefed decorative additions (eyebrow labels, page counters, gradients) that
cost fidelity points across tasks. These are not fixable by changing the
format — they are the inherent variance of freeform HTML generation. Notably,
the eDSL arm never produced a wrong-text or off-frame failure: **the
structured format's worst case was much better than freeform HTML's worst
case (eDSL min 17 vs HTML min 14), consistent with the "constraints prevent
catastrophes" intuition.**

## Per-task reading

| task | eDSL (3 trials) | HTML (3 trials) | note |
|---|---|---|---|
| lower-third | 22, 24, 22 | 24, 24, 23 | both arms broadcast-plausible; HTML marginally tighter polish |
| chart-buildup | 17, 17, 23 | 24, 25, 22 | the decimal count-up gap is the whole story |
| kinetic-typo | 20, 19, 18 | 18, 20, 21 | parity; both penalized for exits falling between filmstrip tiles |
| logo-reveal | 21, 20, 22 | 23, 21, 21 | parity |
| transition | 21, 20, 20 | 14, 20, 22 | eDSL strictly more consistent; HTML's variance produced the worst clip of the experiment |

## Methodology notes for the next iteration

- **Filmstrip sampling penalizes fast exits.** Judges repeatedly wrote "exit
  not captured in any tile, reads as a cut" for clips whose exits occupy
  <0.5s. Either sample tiles non-uniformly (denser at start/end) or give the
  judge the mp4 frame rate context. This depressed `motion` scores in both
  arms roughly equally (eDSL 3.80, HTML 4.07).
- Judge self-preference is controlled (same model generated both arms), but
  judge variance is not — a 2-3 point spread on identical-quality clips is
  plausible. Pairwise A/B judging (same task, two clips side by side) would
  be sharper than absolute rubric scoring.
- Generation cost was comparable (eDSL mean 131.5 LOC, HTML 128.0 LOC; agent
  token usage within ~10%).

## What this means for reframe

1. The core bet survives its first contact: **a structured, states+timeline
   eDSL is just as generatable as HTML for a frontier model, while giving
   determinism and editability for free.** The quality delta is attributable
   to enumerable runtime gaps, each of which is a small, concrete v2 item.
2. Priority fixes, in order of measured impact: number formatting on text
   content; time-bounded behaviors; guide note on scale-in patterns.
3. The structural advantage to press: eDSL failures were *mechanical and
   diagnosable from the IR* (you can lint "numeric content + decimal brief"),
   while HTML failures were *semantic and invisible until rendered*. That
   asymmetry is the editability/verifiability thesis in action — Madeus-style
   static checks can catch the eDSL failure class before rendering, but
   nothing can lint "SOLUTION" vs "THE SOLUTION" out of freeform HTML.

---

## Addendum (same day): v2 re-run confirms the gap was the runtime, not the format

After shipping the v2 fixes (`contentDecimals`, time-bounded behaviors, the
scale-in guide note, denser filmstrip sampling at clip start/end), the
chart-buildup eDSL cell was re-run: 3 fresh single-shot generations against
the updated guide, rendered first-attempt 3/3, judged blind with the same
rubric (results in `benchmark/runs-v2/`, kept separate from the v1 record).

| | t1 | t2 | t3 | mean |
|---|---|---|---|---|
| chart-buildup eDSL **v1** | 17 | 17 | 23 | 19.00 |
| chart-buildup eDSL **v2** | 23 | 23 | 25 | **23.67** |
| chart-buildup HTML (v1, unchanged) | 24 | 25 | 22 | 23.67 |

All three v2 generations used `contentDecimals: 1` unprompted (beyond the
guide mentioning it), every judge saw correct one-decimal count-ups, and no
decimal-related deduction remains. **The eDSL now scores identical to HTML on
the task that produced the entire arm-level gap** — supporting the original
reading that the 21.47-vs-20.40 difference measured a missing runtime feature,
not a format-level generation disadvantage. Remaining deductions (late/abrupt
final fade) are shared by both arms and are choreography taste, not format
artifacts. n remains 3; directional, as ever.
