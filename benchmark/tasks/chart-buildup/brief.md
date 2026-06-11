# Task: Animated bar chart build-up

Canvas: 1920x1080, 30fps. Total duration: **6.0 seconds**. Background: #0B0E14.

Create an animated vertical bar chart:

- Title: **"2025 Revenue ($M)"** — top-left of the chart area, bold, white.
- Four bars for quarterly data: Q1 = 8.2, Q2 = 9.1, Q3 = 11.4, Q4 = 14.0.
- Bars in **#5B8CFF**, slightly rounded top corners, sitting on a thin baseline
  axis line (#3A4150). Quarter labels (Q1–Q4) below the axis in muted gray.
- A numeric value label above each bar showing its value (one decimal, e.g. "8.2").

Motion:
1. 0.0–0.5s: title fades in.
2. 0.5–2.5s: bars grow up from the baseline one after another (left to right,
   ~0.15s stagger), with a decelerating ease. Each value label counts up from 0
   to its final value while its bar grows, and rides just above the bar top.
3. Quarter labels fade in with their bars.
4. Hold until 5.2s.
5. 5.2–6.0s: everything fades out together.

The chart must be plausibly proportioned: bar heights proportional to values,
consistent spacing, labels centered on their bars.
