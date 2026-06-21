// Narrated demo — a pure-vector scene whose voiceover is authored as a sibling
// `narrated-demo-vo/script.json` (imported into `audio.narration`) and synthesized
// + fitted to the timeline by `reframe narrate`. Each line anchors to a timeline
// label, so the VO survives retiming/regen; `narrate` reads the label clock and
// fits each line's speech rate to its slot.
//
//   reframe narrate examples/scenes/narrated-demo.ts --dry-run   # fit table (no synth)
//   reframe narrate examples/scenes/narrated-demo.ts             # synth + fit (python+kokoro)
//   reframe render  examples/scenes/narrated-demo.ts             # mp4, bed ducks under the VO
//
// The .wav are out-of-band assets (not bundled to npm, not golden) — commit
// script.json + the generated wavs together. Image/audio file cues don't render
// in player/artifacts; mp4 only.

import { scene, rect, text, seq, tween, wait, linearGradient } from "@reframe/core";
import vo from "./narrated-demo-vo/script.json";

const W = 1920, H = 1080;

export default scene({
  id: "narrated-demo",
  size: { width: W, height: H },
  fps: 30,
  background: "#06070C",
  nodes: [
    rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: linearGradient(["#0A1430", "#06070C"], { angle: 90 }) }),
    text({ id: "title", x: W / 2, y: H / 2 - 40, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 200, fontWeight: 800, fill: "#FFFFFF", opacity: 0 }),
    text({ id: "sub", x: W / 2, y: H / 2 + 110, anchor: "center", content: "voice that fits the scene", fontFamily: "Inter", fontSize: 46, fontWeight: 500, fill: "#7FB4FF", opacity: 0 }),
  ],
  // labels (intro / point / close) are the stable anchors the narration lines bind to
  timeline: seq(
    wait(0.4),
    tween("title", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "intro" }),
    wait(2.4),
    tween("sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "point" }),
    wait(3.2),
    tween("title", { opacity: 0 }, { duration: 0.6, ease: "easeInCubic", label: "close" }),
    tween("sub", { opacity: 0 }, { duration: 0.6, ease: "easeInCubic", label: "close-sub" }),
    wait(0.6),
  ),
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.25, fadeIn: 1, fadeOut: 1.5, duck: { depth: 0.6 } },
    narration: vo,
  },
});
