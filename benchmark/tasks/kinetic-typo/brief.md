# Task: Kinetic typography statement

Canvas: 1920x1080, 30fps. Total duration: **5.0 seconds**. Background: #0D0D0F.

Animate the four-word statement, one word per line, centered as a block:

- **"SHIP"**, **"FAST"**, **"BREAK"** — white, heavy weight (800), uppercase.
- **"NOTHING"** — the punchline: larger than the others and in **#FFC400**.

Motion:
1. Words punch in one at a time, in reading order, ~0.25s apart: each scales up
   from small (~40%) with a quick overshoot (pop past 100%, settle back) while
   fading in.
2. After the last word lands, the full block holds for ~1.5s. During the hold,
   give NOTHING a subtle continuous pulse (gentle scale oscillation) so the
   frame doesn't feel frozen.
3. Final ~0.6s: all words exit fast — fly out horizontally (alternating
   directions per line) while fading, accelerating ease.

Typography must stay optically centered as a block; spacing between lines
consistent; the pop should feel energetic, not bouncy-cartoonish.
