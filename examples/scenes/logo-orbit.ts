import { scene, rect, path, text, group, seq, par, tween, wait, motionPreset, type PresetRig } from "@reframe/core";

// A self-contained logo sting for the preview: a star mark drawn on, then a
// reveal-orbit swoop. Open this in `reframe preview` and DRAG the blue waypoint
// handles on the orbit curve — your drag is a timeline.orbit.points overlay
// edit that survives regenerating the base. Swap the preset/seed below to feel
// the motion vocabulary.
const STAR = "M12 1.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.27l-6.18 3.24L7 13.63l-5-4.87 6.91-1z";
const ACCENT = "#58A6FF";
const fit = 520 / 24;

const rig: PresetRig = { group: "logo", center: [540, 500], baseScale: fit, fills: ["fill"], inks: ["ink"] };

export default scene({
  id: "logo-orbit",
  size: { width: 1080, height: 1080 },
  fps: 30,
  background: "#0D1117",
  nodes: [
    rect({ id: "bg", x: 0, y: 0, width: 1080, height: 1080, fill: "#0D1117" }),
    group({ id: "logo", x: 540, y: 500, scale: fit }, [
      path({ id: "fill", d: STAR, originX: 12, originY: 12, x: 0, y: 0, fill: ACCENT, opacity: 0 }),
      path({ id: "ink", d: STAR, originX: 12, originY: 12, x: 0, y: 0, stroke: ACCENT, strokeWidth: 2.2 / fit, progress: 0 }),
    ]),
    text({ id: "word", x: 540, y: 905, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: "#E6EDF3", opacity: 0 }),
  ],
  timeline: seq(
    // try: "punch-in" | "rise-settle" | "slide-bank" | "spin-forge" | "draw-bloom"
    motionPreset("reveal-orbit", { target: rig, energy: 0.6, seed: 1 }),
    par(tween("word", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "word" })),
    wait(0.8, "hold"),
  ),
});
