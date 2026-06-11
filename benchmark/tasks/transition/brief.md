# Task: Scene-to-scene wipe transition

Canvas: 1920x1080, 30fps. Total duration: **4.0 seconds**. Background: #101014.

Create a two-slide sequence joined by a wipe transition:

- Slide A: full-frame background **#14324F**, centered title **"THE PROBLEM"**
  (bold, white, large).
- Slide B: full-frame background **#1F4032**, centered title **"THE SOLUTION"**
  (same styling).
- Transition element: a vertical accent bar in **#FF5C39** (roughly 140px wide,
  full height) that sweeps across the frame and motivates the cut.

Motion:
1. 0.0–1.2s: slide A holds (its title may settle in during the first 0.4s).
2. 1.2–2.2s: the accent bar sweeps left-to-right across the full frame; as it
   passes, slide A is replaced by slide B (B's title should not be visible
   before the bar has passed the center). Use a confident ease-in-out for
   the sweep — fast through the middle.
3. 2.2–4.0s: slide B holds; its title can land with a small settle as the bar
   clears the right edge.

The wipe must feel mechanically coherent: the bar leads, content changes
behind it, no flash frames or visible seams.
