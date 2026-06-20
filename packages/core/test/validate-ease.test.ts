import { describe, expect, it } from "vitest";
import { scene, rect, seq, tween } from "../src/dsl.js";
import { validateScene, SceneValidationError } from "../src/validate.js";

// Invalid ease names used to slip through `validateScene`/`compile` and only blow
// up at render time (browser `resolveEase`). They're now caught at validation —
// the ~1s cheap-loop feedback the authoring agent relies on.
const mk = (ease: unknown) =>
  scene({
    id: "ez",
    size: { width: 100, height: 100 },
    fps: 30,
    background: "#000",
    nodes: [rect({ id: "r", x: 0, y: 0, width: 10, height: 10, anchor: "center" })],
    timeline: seq(tween("r", { x: 50 }, { duration: 1, ease: ease as never })),
  });

describe("ease validation at compile/validate time", () => {
  it("rejects an unknown ease name with an actionable message", () => {
    expect(() => validateScene(mk("easeInOutSine"))).toThrow(SceneValidationError);
    expect(() => validateScene(mk("easeInOutSine"))).toThrow(/unknown ease "easeInOutSine"/);
  });

  it("accepts a valid named ease", () => {
    expect(() => validateScene(mk("easeOutBack"))).not.toThrow();
    expect(() => validateScene(mk("spring"))).not.toThrow();
  });

  it("accepts the { spring } and { cubicBezier } object forms", () => {
    expect(() => validateScene(mk({ spring: { stiffness: 120 } }))).not.toThrow();
    expect(() => validateScene(mk({ cubicBezier: [0.2, 0, 0.3, 1] }))).not.toThrow();
  });

  it("rejects a malformed cubicBezier", () => {
    expect(() => validateScene(mk({ cubicBezier: [0.2, 0] }))).toThrow(/cubicBezier/);
  });
});
