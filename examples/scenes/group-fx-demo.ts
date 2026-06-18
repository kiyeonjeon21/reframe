// Group composite effects: blur / shadow / blend applied to a WHOLE group as one
// layer (offscreen-composited, the same mechanism as track mattes). Three panels:
//   A — focus pull on a multi-node lockup: the group sharpens as ONE image (the
//       blur is on the composite, not each child — overlaps blur together).
//   B — one composite drop shadow under a multi-shape mark (a single silhouette
//       shadow, not one per child).
//   C — a stack of overlapping discs composited onto the background with ONE group
//       `blend: "screen"` (the discs screen against the bg as a single layer).
// Deterministic, offscreen, same-machine. mp4 (and live in player/preview).

import {
  scene, group, rect, ellipse, text,
  seq, par, tween, wait, oscillate,
  linearGradient, radialGradient,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", FG = "#EDEFF5", DIM = "#7C859B";

const cap = (id: string, x: number, s: string): NodeIR =>
  text({ id, x, y: 720, anchor: "center", content: s, fontFamily: "Inter", fontSize: 22, fontWeight: 600, fill: DIM, letterSpacing: 2 });

export default scene({
  id: "group-fx-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    text({ id: "title", x: 96, y: 112, anchor: "center-left", content: "group blur · shadow · blend", fontFamily: "Inter", fontSize: 60, fontWeight: 800, fill: FG }),
    text({ id: "sub", x: 96, y: 160, anchor: "center-left", content: "effects on a whole group, composited as one layer", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: DIM }),

    // A — focus pull: a multi-node lockup blurs/sharpens as ONE composite (blur on the group)
    group({ id: "lockup", x: 0, y: 0, blur: 20 }, [
      rect({ id: "lk-card", x: 400, y: 420, width: 300, height: 220, radius: 26, anchor: "center", fill: linearGradient(["#7C5CFF", "#3AA0FF"], { angle: 135 }) }),
      ellipse({ id: "lk-dot", x: 330, y: 360, width: 70, height: 70, anchor: "center", fill: "#FFD24B" }),
      text({ id: "lk-t", x: 400, y: 470, anchor: "center", content: "FOCUS", fontFamily: "Inter", fontSize: 52, fontWeight: 800, fill: "#0A0C14" }),
    ]),
    cap("la", 400, "GROUP BLUR · FOCUS"),

    // B — one composite drop shadow under a multi-shape mark (group shadow = single silhouette)
    group({ id: "mark", x: 0, y: 0, opacity: 0, shadowColor: "#000000", shadowBlur: 40, shadowX: 0, shadowY: 26 }, [
      rect({ id: "mk-a", x: 930, y: 400, width: 120, height: 120, radius: 20, anchor: "center", fill: "#FF4D6D" }),
      rect({ id: "mk-b", x: 1000, y: 460, width: 120, height: 120, radius: 20, anchor: "center", fill: "#FF8A3A" }),
      ellipse({ id: "mk-c", x: 970, y: 360, width: 96, height: 96, anchor: "center", fill: "#FFD24B" }),
    ]),
    cap("lb", 960, "GROUP SHADOW"),

    // C — overlapping discs composited onto the bg as ONE screen layer (group blend)
    group({ id: "burst", x: 1520, y: 420, opacity: 0, blend: "screen" }, [
      ellipse({ id: "bu-1", x: -46, y: 0, width: 190, height: 190, anchor: "center", fill: radialGradient(["#FF3D6E", "#FF3D6E00"], { r: 0.5 }) }),
      ellipse({ id: "bu-2", x: 46, y: -10, width: 190, height: 190, anchor: "center", fill: radialGradient(["#3AA0FF", "#3AA0FF00"], { r: 0.5 }) }),
      ellipse({ id: "bu-3", x: 0, y: 56, width: 190, height: 190, anchor: "center", fill: radialGradient(["#36E0A0", "#36E0A000"], { r: 0.5 }) }),
    ]),
    cap("lc", 1520, "GROUP BLEND · SCREEN"),
  ],

  timeline: seq(
    wait(0.3),
    par(
      // the whole lockup sharpens as one composite (group blur 20 → 0)
      tween("lockup", { blur: 0 }, { duration: 1.1, ease: "easeInOutCubic", label: "focus" }),
      seq(wait(0.2), tween("mark", { opacity: 1 }, { duration: 0.6, ease: "easeOutBack", label: "mark-in" })),
      seq(wait(0.4), tween("burst", { opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "burst-in" })),
    ),
    wait(0.4),
    // re-blur the lockup back out (composite breathes)
    tween("lockup", { blur: 14 }, { duration: 0.9, ease: "easeInOutCubic", label: "defocus" }),
    wait(1.6),
  ),

  // the burst gently sways, screening as one layer the whole time
  behaviors: [
    oscillate("mark", "rotation", { amplitude: 4, frequency: 0.5, phase: 0 }),
    oscillate("burst", "rotation", { amplitude: 12, frequency: 0.3, phase: 0 }),
  ],
});
