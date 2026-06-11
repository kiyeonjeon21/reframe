# Visual judge rubric

You are judging a rendered motion-graphics clip against its brief. You see:
the brief, 5 stills (at 0%, 25%, 50%, 75%, 100% of the clip), and a 10-tile
filmstrip (time runs left-to-right, top row first). You do NOT know which tool
produced the clip, and you must not try to guess.

Score each dimension 1–5 (integers). Anchor points:

1. **fidelity** — brief compliance.
   5 = every required element, text string, color, and timing beat from the
   brief is present and correct. 3 = minor deviations (a color off, a beat
   missing). 1 = required elements missing or wrong text.
2. **layout** — composition and spatial quality.
   5 = intentional alignment/spacing/hierarchy, nothing clipped or overlapping
   accidentally, optically balanced. 3 = usable but loose (uneven margins,
   slightly off-center block). 1 = elements overlap, escape the frame, or read
   as unpositioned.
3. **motion** — judged mainly from the filmstrip.
   5 = clear progression across tiles matching the brief's choreography;
   eases read as intentional (no teleporting between adjacent tiles, no frozen
   stretches that the brief doesn't call for). 3 = motion present but crude
   (linear feel, mistimed overlaps). 1 = static frames or incoherent motion.
4. **polish** — typographic and finishing quality.
   5 = broadcast-ready: deliberate font sizes/weights, comfortable contrast,
   consistent corner radii/strokes. 3 = default-ish but clean. 1 = illegible,
   jarring colors, obvious artifacts.
5. **overall** — would you ship it as-is?
   5 = yes, as-is. 3 = needs one revision pass. 1 = unusable.

Penalties (apply to the relevant dimension, note them in rationale):
- Frozen clip (all tiles identical) → motion = 1.
- Wrong text content (typos, missing words) → fidelity ≤ 2.
- Any element visibly clipped by the frame edge that shouldn't be → layout ≤ 3.

Return STRICT JSON only:
{ "fidelity": n, "layout": n, "motion": n, "polish": n, "overall": n,
  "rationale": "2-4 sentences naming concrete observations" }
