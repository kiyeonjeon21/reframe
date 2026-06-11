# Task: Broadcast lower third

Canvas: 1920x1080, 30fps. Total duration: **5.0 seconds**. Background: #0E1116.

Create a broadcast-style lower third for an interview:

- Name line: **"Dr. Maya Chen"** — large, bold, white.
- Role line: **"Climate Scientist, NOAA"** — smaller, muted gray (#A8B0BD).
- An accent element (vertical bar, underline, or shape) in **#00C2A8**.
- Positioned in the lower-left safe area (roughly 120px from left, baseline around y=940).

Motion:
1. 0.0–0.4s: empty frame (hold).
2. 0.4–1.2s: the lower third enters — accent element leads, then name, then role,
   with a slight per-element delay. Movement should feel snappy but smooth
   (decelerating ease), sliding in subtly from the left while fading in.
3. Hold fully visible until 4.2s.
4. 4.2–5.0s: exits cleanly (fade + slight slide back, accelerating ease).

The result should look like a real news/documentary graphic: tight typography,
clear hierarchy, no clutter.
