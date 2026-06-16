import { describe, expect, it } from "vitest";
import { scene, group, seq, wait } from "../src/dsl.js";
import { rig, rigPose, poseTo, ikReach, humanoid, type Bone } from "../src/rig.js";
import { validateScene } from "../src/validate.js";
import type { NodeIR } from "../src/ir.js";

type Grp = Extract<NodeIR, { type: "group" }>;
const asGroup = (n: NodeIR) => n as Grp;
const child = (g: Grp, id: string) => asGroup(g.children.find((c) => c.id === id)!);

const ARM: Bone = {
  name: "shoulder",
  at: [0, 0],
  length: 80,
  width: 18,
  children: [{ name: "elbow", at: [0, 80], length: 70, width: 14 }],
};

describe("rig", () => {
  it("compiles a skeleton to a nested group tree with stable ${id}-${name} joints", () => {
    const r = asGroup(rig(ARM, { id: "a", x: 100, y: 50 }));
    expect(r.type).toBe("group");
    expect(r.id).toBe("a"); // outer placement group
    expect(r.props.x).toBe(100);
    const shoulder = child(r, "a-shoulder");
    expect(shoulder.props.x).toBe(0);
    expect(shoulder.props.y).toBe(0);
    const elbow = child(shoulder, "a-elbow"); // nested under its parent → FK
    expect(elbow.props.x).toBe(0);
    expect(elbow.props.y).toBe(80); // pivot in parent-bone local space
  });

  it("rest rotation lands on the joint group; default bone draws a capsule path", () => {
    const r = asGroup(rig({ name: "b", at: [0, 0], length: 60, width: 16, rotation: 25 }, { id: "j" }));
    const joint = child(r, "j-b");
    expect(joint.props.rotation).toBe(25);
    const shape = joint.children.find((c) => c.id === "j-b-shape");
    expect(shape?.type).toBe("path");
    // a length-0 / pivot-only joint draws nothing
    const pivot = asGroup(rig({ name: "p", at: [0, 0] }, { id: "k" }));
    expect(child(pivot, "k-p").children.length).toBe(0);
  });

  it("custom shape overrides the default; glow adds a second accent path", () => {
    const probe = group({ id: "art", x: 0, y: 0 }, []);
    const custom = asGroup(rig({ name: "c", at: [0, 0], length: 40, shape: [probe] }, { id: "s" }));
    expect(child(custom, "s-c").children).toContainEqual(probe);

    const glowed = asGroup(rig({ name: "g", at: [0, 0], length: 40, width: 12 }, { id: "z", glow: "#FF5A1F" }));
    const joint = child(glowed, "z-g");
    expect(joint.children.some((c) => c.id === "z-g-glow")).toBe(true);
    expect(joint.children.some((c) => c.id === "z-g-shape")).toBe(true);
  });

  it("rigPose → a states fragment; poseTo → a par of rotation tweens", () => {
    expect(rigPose("a", { shoulder: 30, elbow: -45 })).toEqual({
      "a-shoulder": { rotation: 30 },
      "a-elbow": { rotation: -45 },
    });
    const tl = poseTo("a", { shoulder: 30, elbow: -45 }, { duration: 0.4 }) as Extract<
      import("../src/ir.js").TimelineIR,
      { kind: "par" }
    >;
    expect(tl.kind).toBe("par");
    expect(tl.children).toHaveLength(2);
    const t0 = tl.children[0] as Extract<import("../src/ir.js").TimelineIR, { kind: "tween" }>;
    expect(t0.target).toBe("a-shoulder");
    expect(t0.props).toEqual({ rotation: 30 });
    expect(t0.duration).toBe(0.4);
  });

  it("ikReach: forward-kinematics of the returned angles lands the tip on target", () => {
    // FK in the rig's +Y-down convention: tip = R(θ1)·[(0,upper) + R(θ2)·(0,lower)]
    const R = (deg: number, x: number, y: number): [number, number] => {
      const a = (deg * Math.PI) / 180;
      return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    };
    const fk = (upper: number, lower: number, t1: number, t2: number): [number, number] => {
      const [lx, ly] = R(t2, 0, lower);
      return R(t1, lx, upper + ly);
    };
    for (const [dx, dy] of [[60, 90], [-40, 70], [10, -30], [120, 0]] as const) {
      const [t1, t2] = ikReach(90, 80, dx, dy);
      const [hx, hy] = fk(90, 80, t1, t2);
      expect(hx).toBeCloseTo(dx, 4);
      expect(hy).toBeCloseTo(dy, 4);
    }
    // out of reach → clamps, no NaN
    const [a, b] = ikReach(50, 40, 999, 0);
    expect(Number.isFinite(a) && Number.isFinite(b)).toBe(true);
  });

  it("humanoid is a one-call body with the documented joint names", () => {
    const body = asGroup(humanoid({ id: "hero" }));
    const chest = child(body, "hero-chest");
    for (const j of ["hero-head", "hero-armUpperL", "hero-armUpperR", "hero-legUpperL", "hero-legUpperR"]) {
      expect(chest.children.some((c) => c.id === j)).toBe(true);
    }
    expect(child(chest, "hero-armUpperL").children.some((c) => c.id === "hero-armLowerL")).toBe(true);
  });

  it("is deterministic and obeys the duplicate-id contract", () => {
    expect(JSON.stringify(rig(ARM, { id: "a" }))).toBe(JSON.stringify(rig(ARM, { id: "a" })));
    const mk = (nodes: NodeIR[]) =>
      scene({ id: "s", size: { width: 100, height: 100 }, fps: 30, nodes, timeline: seq(wait(1)) });
    // one rig validates; two same-id rigs collide (the stable-address contract).
    // scene() validates eagerly, so the duplicate throws at construction.
    expect(() => validateScene(mk([humanoid({ id: "h" })]))).not.toThrow();
    expect(() => mk([humanoid({ id: "h" }), humanoid({ id: "h" })])).toThrow();
  });
});
