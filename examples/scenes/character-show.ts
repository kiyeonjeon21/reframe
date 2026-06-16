// characterPreset showcase: ONE humanoid() rig performing a montage —
// walk → run → jump → dance → cheer — each a single characterPreset() call.
// The motion is generated, not hand-keyed.

import {
  scene, group, ellipse, rect, text,
  seq, tween, wait, oscillate,
  humanoid, characterPreset,
} from "@reframe/core";

const BG = "#0A0E1A";
const ACC = "#FF5A1F";
const ID = "hero";
const CX = 960, BASE_Y = 440, SCALE = 1.7;
const AT = [CX, BASE_Y] as [number, number];

const ce = (id: string, x: number, y: number, d: number, fill: string, opacity = 1) =>
  ellipse({ id, x, y, width: d, height: d, fill, opacity, anchor: "center" });

// switch the move label (content switches discretely; a quick fade keeps it lively)
const label = (s: string) =>
  seq(
    tween("cap-move", { content: s, opacity: 0.4 }, { duration: 0.12 }),
    tween("cap-move", { opacity: 1 }, { duration: 0.18, ease: "easeOutCubic" }),
  );

export default scene({
  id: "character-show",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    ce("wash", CX, 450, 1300, "#121A30", 0.5),
    ce("wash2", CX, 450, 760, "#17213B", 0.5),
    ellipse({ id: "shadow", x: CX, y: 824, width: 230, height: 32, fill: "#000000", opacity: 0.3, anchor: "center" }),

    humanoid({ id: ID, x: CX, y: BASE_Y, scale: SCALE, opacity: 0, glow: ACC }),

    text({ id: "cap-move", x: 250, y: 120, content: "", fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: "#E7ECF5", opacity: 0, anchor: "center" }),
    group({ id: "cap", x: CX, y: 962, opacity: 0 }, [
      text({ id: "cap-t", x: 0, y: 0, content: "one humanoid(). one characterPreset() each.", fontFamily: "Inter", fontSize: 30, fontWeight: 700, fill: "#7E8AA8", anchor: "center" }),
    ]),
  ],

  timeline: seq(
    wait(0.3),
    tween(ID, { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    tween("cap", { opacity: 1, y: 928 }, { duration: 0.5, ease: "easeOutCubic" }),

    label("walk"), characterPreset("walk", { target: ID, at: AT, cycles: 3, travel: 0 }),
    label("run"), characterPreset("run", { target: ID, at: AT, cycles: 3, travel: 0 }),
    label("jump"), characterPreset("jump", { target: ID, at: AT, energy: 0.6 }),
    label("dance"), characterPreset("dance", { target: ID, at: AT, cycles: 3 }),
    label("cheer"), characterPreset("cheer", { target: ID, at: AT, cycles: 2 }),

    tween("cap-move", { opacity: 0 }, { duration: 0.5 }),
    wait(1.0),
  ),

  behaviors: [
    oscillate(`${ID}-chest`, "scaleY", { amplitude: 0.015, frequency: 0.7 }, { from: 0.8, ramp: 0.6 }),
  ],
});
