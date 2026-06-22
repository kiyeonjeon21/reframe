// A first-class character rig: ONE humanoid() call → a poseable skeleton.
// Posed entirely through the rig API — poseTo() for FK poses, ikReach() to make
// the hand meet a target. No hand-authored group tree; the rig compiles to IR.

import {
  scene, group, ellipse, text,
  seq, par, tween, wait, oscillate,
  humanoid, poseTo, ikReach,
} from "@reframe/core";

const BG = "#0A0E1A";
const ACC = "#FF5A1F";
const ID = "hero";
const CX = 960, SCALE = 1.6;
const BASE_Y = 462;            // places the chest; feet land near y≈820

// soft concentric-ellipse glow (the renderer has no real gradient)
const ce = (id: string, x: number, y: number, d: number, fill: string, opacity = 1) =>
  ellipse({ id, x, y, width: d, height: d, fill, opacity, anchor: "center" });

// --- poses (jointName -> degrees; 0 = bone points down) -------------------
const WAVE = { armUpperR: -150, armLowerR: -28 };
const CROUCH = { legUpperL: 16, legLowerL: 52, legUpperR: -16, legLowerR: 52, armUpperL: 26, armUpperR: -26 };
const LAUNCH = { legUpperL: 0, legLowerL: 0, legUpperR: 0, legLowerR: 0, armUpperL: 150, armUpperR: -150 };
const TUCK = { legUpperL: -26, legLowerL: 64, legUpperR: -26, legLowerR: 64, armUpperL: 120, armUpperR: -120 };
const REST = { armUpperL: 10, armLowerL: 8, armUpperR: -10, armLowerR: -8, legUpperL: 3, legLowerL: -2, legUpperR: -3, legLowerR: 2 };

// IK: reach the right hand to a target relative to its shoulder pivot.
// humanoid arm lengths: upper 60, lower 56 → max reach 116. Keep the target
// inside that so the hand actually meets it. Shoulder pivot (chest-local) = (42,-20).
const TARGET = [64, -58] as [number, number];
const [ikS, ikE] = ikReach(60, 56, TARGET[0], TARGET[1]);
const REACH = { armUpperR: ikS, armLowerR: ikE, armUpperL: 18 };
// the target dot, in scene space (chest-local → scene): (42+tx, -20+ty)
const dotX = CX + (42 + TARGET[0]) * SCALE;
const dotY = BASE_Y + (-20 + TARGET[1]) * SCALE;

export default scene({
  id: "character-rig",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    ce("wash", CX, 470, 1300, "#121A30", 0.5),
    ce("wash2", CX, 470, 760, "#17213B", 0.5),
    ellipse({ id: "shadow", x: CX, y: 824, width: 220, height: 32, fill: "#000000", opacity: 0.3, anchor: "center" }),
    ellipse({ id: "target", x: dotX, y: dotY, width: 30, height: 30, fill: ACC, opacity: 0, anchor: "center" }),
    ellipse({ id: "target-ring", x: dotX, y: dotY, width: 30, height: 30, fill: "none", stroke: ACC, strokeWidth: 3, opacity: 0, anchor: "center" }),

    // THE CHARACTER — one call. Starts hidden + crouched for the entrance.
    humanoid({ id: ID, x: CX, y: BASE_Y, scale: SCALE, opacity: 0, glow: ACC }),

    group({ id: "cap", x: CX, y: 962, opacity: 0 }, [
      text({ id: "cap-t", x: 0, y: 0, content: "one humanoid(). rigged, posed, IK.", fontFamily: "Inter", fontSize: 32, fontWeight: 700, fill: "#7E8AA8", anchor: "center" }),
    ]),
  ],

  timeline: seq(
    // entrance: rise + fade in
    wait(0.2),
    par(
      tween(ID, { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
      seq(tween(ID, { y: BASE_Y - 40 }, { duration: 0.01 }), tween(ID, { y: BASE_Y }, { duration: 0.6, ease: "easeOutBack" })),
    ),
    wait(0.3),

    // 1. wave (FK pose + oscillate handled by a behavior window)
    poseTo(ID, WAVE, { duration: 0.45, ease: "easeOutBack" }),
    wait(1.3),
    poseTo(ID, REST, { duration: 0.4 }),
    wait(0.25),

    // 2. jump: crouch → launch (extend + rise) → tuck (apex) → land → settle
    par(poseTo(ID, CROUCH, { duration: 0.24, ease: "easeOutQuad" }), tween(ID, { y: BASE_Y + 26 }, { duration: 0.24, ease: "easeOutQuad" }), tween("shadow", { scaleX: 1.15 }, { duration: 0.24 })),
    par(poseTo(ID, LAUNCH, { duration: 0.22, ease: "easeOutCubic" }), tween(ID, { y: BASE_Y - 150 }, { duration: 0.34, ease: "easeOutCubic" }), tween("shadow", { scaleX: 0.6, opacity: 0.16 }, { duration: 0.34 })),
    par(poseTo(ID, TUCK, { duration: 0.22 })),
    par(poseTo(ID, CROUCH, { duration: 0.26, ease: "easeInQuad" }), tween(ID, { y: BASE_Y + 18 }, { duration: 0.3, ease: "easeInCubic" }), tween("shadow", { scaleX: 1.25, opacity: 0.3 }, { duration: 0.3 })),
    par(poseTo(ID, REST, { duration: 0.45, ease: "easeOutBack" }), tween(ID, { y: BASE_Y }, { duration: 0.45, ease: "easeOutBack" }), tween("shadow", { scaleX: 1 }, { duration: 0.45 })),
    wait(0.3),

    // 3. IK reach: hand meets the target dot
    par(
      tween("target", { opacity: 1 }, { duration: 0.3 }),
      tween("target-ring", { opacity: 0.8, scaleX: 1.6, scaleY: 1.6 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
    poseTo(ID, REACH, { duration: 0.55, ease: "easeOutCubic" }),
    wait(1.0),
    par(poseTo(ID, REST, { duration: 0.4 }), tween("target", { opacity: 0 }, { duration: 0.4 }), tween("target-ring", { opacity: 0 }, { duration: 0.4 })),

    // 4. caption
    tween("cap", { opacity: 1, y: 920 }, { duration: 0.7, ease: "easeOutCubic" }),
    wait(1.4),
  ),

  behaviors: [
    oscillate(`${ID}-chest`, "scaleY", { amplitude: 0.02, frequency: 0.7 }, { from: 1.2, ramp: 0.6 }),  // breathe
    oscillate(ID, "y", { amplitude: 4, frequency: 0.55 }, { from: 7.4, ramp: 0.6 }),                      // idle bob
    oscillate(`${ID}-armUpperR`, "rotation", { amplitude: 14, frequency: 2.6 }, { from: 1.3, until: 2.5, ramp: 0.15 }), // wave
  ],
});
