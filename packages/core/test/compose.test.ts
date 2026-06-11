import { describe, expect, it } from "vitest";
import { composeScene, type OverlayDoc } from "../src/compose.js";
import { compileScene } from "../src/compile.js";
import { scene, group, rect, text, seq, to, tween, wait, oscillate } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { SceneValidationError } from "../src/validate.js";

const baseScene = () =>
  scene({
    id: "demo",
    size: { width: 1920, height: 1080 },
    background: "#000000",
    nodes: [
      group({ id: "lockup", x: 960, y: 540 }, [
        rect({ id: "plate", x: 0, y: 0, width: 100, height: 50, fill: "#ff0000", stroke: "#ffffff", radius: 8 }),
        text({ id: "label", x: 0, y: 0, content: "HELLO", fontFamily: "Inter", fontSize: 40 }),
      ]),
    ],
    states: {
      hidden: { plate: { opacity: 0 }, label: { opacity: 0, y: 20 } },
      shown: { plate: { opacity: 1 }, label: { opacity: 1, y: 0 } },
    },
    initial: "hidden",
    timeline: seq(
      to("shown", { duration: 1, label: "reveal" }),
      wait(2, "hold"),
      tween("plate", { opacity: 0 }, { duration: 0.5, label: "exit" }),
    ),
    behaviors: [oscillate("lockup", "y", { amplitude: 5, frequency: 1 })],
  });

const overlay = (doc: Partial<OverlayDoc>): OverlayDoc => ({ reframeOverlay: 1, ...doc });

describe("composeScene merge semantics", () => {
  it("patches props of nodes nested in groups and leaves base untouched", () => {
    const base = baseScene();
    const snapshot = structuredClone(base);
    const { ir, report } = composeScene(base, overlay({ nodes: { plate: { fill: "#00ff00" } } }));
    expect((ir.nodes[0] as unknown as { children: { props: { fill?: string } }[] }).children[0]!.props.fill).toBe("#00ff00");
    expect(base).toEqual(snapshot);
    expect(report.applied).toEqual([{ layer: "overlay-0", address: "nodes.plate.fill", action: "set" }]);
  });

  it("shallow-merges props, preserving unpatched keys", () => {
    const { ir } = composeScene(baseScene(), overlay({ nodes: { plate: { width: 200 } } }));
    const plate = (ir.nodes[0] as unknown as { children: { props: Record<string, unknown> }[] }).children[0]!;
    expect(plate.props.width).toBe(200);
    expect(plate.props.fill).toBe("#ff0000");
    expect(plate.props.radius).toBe(8);
  });

  it("null deletes a prop key", () => {
    const { ir, report } = composeScene(baseScene(), overlay({ nodes: { plate: { stroke: null } } }));
    const plate = (ir.nodes[0] as unknown as { children: { props: Record<string, unknown> }[] }).children[0]!;
    expect("stroke" in plate.props).toBe(false);
    expect(report.applied[0]).toMatchObject({ action: "unset" });
  });

  it("deep-merges states, preserving sibling node overrides", () => {
    const { ir } = composeScene(baseScene(), overlay({ states: { shown: { label: { y: -10 } } } }));
    expect(ir.states!.shown!.label).toEqual({ opacity: 1, y: -10 });
    expect(ir.states!.shown!.plate).toEqual({ opacity: 1 });
  });

  it("patches whitelisted scene keys and ignores everything else", () => {
    const { ir } = composeScene(
      baseScene(),
      overlay({
        scene: { background: "#111111", duration: 9, id: "hacked", size: { width: 1 } } as never,
      }),
    );
    expect(ir.background).toBe("#111111");
    expect(ir.duration).toBe(9);
    expect(ir.id).toBe("demo");
    expect(ir.size.width).toBe(1920);
  });

  it("behaviors: remove deletes, set replaces matching (target,prop), set appends new", () => {
    const { ir } = composeScene(
      baseScene(),
      overlay({
        behaviors: {
          remove: [{ target: "lockup", prop: "y" }],
          set: [oscillate("plate", "rotation", { amplitude: 3, frequency: 0.5 })],
        },
      }),
    );
    expect(ir.behaviors).toHaveLength(1);
    expect(ir.behaviors![0]).toMatchObject({ target: "plate", prop: "rotation" });

    const replaced = composeScene(
      baseScene(),
      overlay({ behaviors: { set: [oscillate("lockup", "y", { amplitude: 99, frequency: 1 })] } }),
    ).ir;
    expect(replaced.behaviors).toHaveLength(1);
    expect(
      (replaced.behaviors![0]!.behavior as { params: { amplitude: number } }).params.amplitude,
    ).toBe(99);
  });

  it("appends addNodes at the root, painted on top", () => {
    const { ir } = composeScene(
      baseScene(),
      overlay({
        addNodes: [
          rect({ id: "watermark", x: 0, y: 0, width: 10, height: 10, fill: "#ffffff" }),
        ],
      }),
    );
    expect(ir.nodes.at(-1)).toMatchObject({ id: "watermark" });
    const ops = evaluate(compileScene(ir), 2);
    expect((ops.at(-1) as { type: string }).type).toBe("rect");
  });

  it("addNodes with a conflicting id is an overlay defect -> validation error", () => {
    expect(() =>
      composeScene(
        baseScene(),
        overlay({ addNodes: [rect({ id: "plate", x: 0, y: 0, width: 1, height: 1 })] }),
      ),
    ).toThrowError(SceneValidationError);
  });
});

describe("orphan handling (base drift never throws)", () => {
  it("skips unknown node ids, applies the rest, result still validates", () => {
    const { ir, report } = composeScene(
      baseScene(),
      overlay({ nodes: { ghost: { fill: "#00ff00" }, plate: { fill: "#0000ff" } } }),
    );
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]!.reason).toMatch(/unknown node "ghost".*rename/s);
    expect(report.applied).toHaveLength(1);
    expect(() => compileScene(ir)).not.toThrow();
  });

  it("reports unknown state and unknown node inside a state as distinct addresses", () => {
    const { report } = composeScene(
      baseScene(),
      overlay({
        states: {
          missing: { plate: { opacity: 0.5 } },
          shown: { ghost: { opacity: 0.5 } },
        },
      }),
    );
    const addresses = report.orphans.map((o) => o.address).sort();
    expect(addresses).toEqual(["states.missing", "states.shown.ghost"]);
  });

  it("skips props invalidated by a type drift, per prop", () => {
    // overlay was authored when "label" was a rect; base now has it as text
    const { report } = composeScene(
      baseScene(),
      overlay({ nodes: { label: { radius: 4, opacity: 0.5 } } }),
    );
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]!.reason).toMatch(/"radius" is not a prop of text "label"/);
    expect(report.applied).toEqual([
      { layer: "overlay-0", address: "nodes.label.opacity", action: "set" },
    ]);
  });

  it("reports behavior orphans for missing targets and missing removals", () => {
    const { report } = composeScene(
      baseScene(),
      overlay({
        behaviors: {
          remove: [{ target: "plate", prop: "rotation" }],
          set: [oscillate("ghost", "x", { amplitude: 1, frequency: 1 })],
        },
      }),
    );
    expect(report.orphans.map((o) => o.address).sort()).toEqual([
      "behaviors.remove.plate.rotation",
      "behaviors.set.ghost.x",
    ]);
  });

  it("warns on scene-id mismatch via target", () => {
    const { report } = composeScene(baseScene(), overlay({ target: "other-scene" }));
    expect(report.warnings[0]).toMatch(/authored against scene "other-scene"/);
  });
});

describe("multi-layer composition", () => {
  it("later layers win on the same address; both applications are recorded", () => {
    const { ir, report } = composeScene(
      baseScene(),
      overlay({ name: "first", nodes: { plate: { fill: "#111111" } } }),
      overlay({ name: "second", nodes: { plate: { fill: "#222222" } } }),
    );
    const plate = (ir.nodes[0] as unknown as { children: { props: { fill?: string } }[] }).children[0]!;
    expect(plate.props.fill).toBe("#222222");
    expect(report.applied.map((a) => a.layer)).toEqual(["first", "second"]);
  });

  it("a later behavior set replaces an earlier layer's", () => {
    const { ir } = composeScene(
      baseScene(),
      overlay({ behaviors: { set: [oscillate("lockup", "y", { amplitude: 10, frequency: 1 })] } }),
      overlay({ behaviors: { set: [oscillate("lockup", "y", { amplitude: 20, frequency: 1 })] } }),
    );
    expect(ir.behaviors).toHaveLength(1);
    expect(
      (ir.behaviors![0]!.behavior as { params: { amplitude: number } }).params.amplitude,
    ).toBe(20);
  });
});

describe("timeline patches via labels", () => {
  it("patches a to-step's duration and re-infers the scene length", () => {
    const base = baseScene();
    expect(base.duration).toBe(3.5); // 1 + 2 + 0.5
    const { ir, report } = composeScene(
      base,
      overlay({ timeline: { reveal: { duration: 2, ease: "easeOutExpo" }, hold: { duration: 1 } } }),
    );
    expect(compileScene(ir).duration).toBe(3.5); // 2 + 1 + 0.5
    expect(ir.duration).toBe(3.5);
    expect(report.applied.map((a) => a.address).sort()).toEqual([
      "timeline.hold.duration",
      "timeline.reveal.duration",
      "timeline.reveal.ease",
    ]);
  });

  it("does not re-infer when the same overlay pins scene.duration", () => {
    const { ir } = composeScene(
      baseScene(),
      overlay({ scene: { duration: 10 }, timeline: { hold: { duration: 0.1 } } }),
    );
    expect(ir.duration).toBe(10);
  });

  it("orphans unknown labels with the known-labels list", () => {
    const { report } = composeScene(
      baseScene(),
      overlay({ timeline: { intro: { duration: 1 } } }),
    );
    expect(report.orphans[0]!.address).toBe("timeline.intro");
    expect(report.orphans[0]!.reason).toMatch(/known labels: reveal, hold, exit/);
  });

  it("orphans keys not patchable on the step kind, per key", () => {
    const { report } = composeScene(
      baseScene(),
      overlay({ timeline: { exit: { duration: 1, stagger: 0.1 }, hold: { ease: "linear" } } }),
    );
    expect(report.orphans.map((o) => o.address).sort()).toEqual([
      "timeline.exit.stagger",
      "timeline.hold.ease",
    ]);
    expect(report.orphans[0]!.reason).toMatch(/not patchable on a/);
    expect(report.applied.map((a) => a.address)).toEqual(["timeline.exit.duration"]);
  });

  it("rejects duplicate labels at scene authoring time", () => {
    expect(() =>
      scene({
        id: "t",
        size: { width: 100, height: 100 },
        nodes: [rect({ id: "a", x: 0, y: 0, width: 1, height: 1 })],
        timeline: seq(wait(1, "x"), wait(1, "x")),
      }),
    ).toThrowError(/duplicate timeline label "x"/);
  });

  it("timeline patches survive overlay JSON round-trips", () => {
    const doc = overlay({ timeline: { reveal: { duration: 1.5 } } });
    const direct = composeScene(baseScene(), doc).ir;
    const roundTripped = composeScene(
      baseScene(),
      JSON.parse(JSON.stringify(doc)) as OverlayDoc,
    ).ir;
    expect(roundTripped).toEqual(direct);
  });
});

describe("invariants", () => {
  it("overlay and composed IR survive JSON round-trips identically", () => {
    const doc = overlay({ nodes: { plate: { fill: "#00ff00" } }, scene: { duration: 7 } });
    const direct = composeScene(baseScene(), doc).ir;
    const roundTripped = composeScene(
      baseScene(),
      JSON.parse(JSON.stringify(doc)) as OverlayDoc,
    ).ir;
    expect(roundTripped).toEqual(direct);
    expect(JSON.parse(JSON.stringify(direct))).toEqual(direct);
  });

  it("composing zero overlays returns a deep clone, not the same reference", () => {
    const base = baseScene();
    const { ir } = composeScene(base);
    expect(ir).toEqual(base);
    expect(ir).not.toBe(base);
  });

  it("scene duration override flows into compileScene", () => {
    const { ir } = composeScene(baseScene(), overlay({ scene: { duration: 42 } }));
    expect(compileScene(ir).duration).toBe(42);
  });

  it("overlay defects (invalid values) throw SceneValidationError, unlike orphans", () => {
    expect(() =>
      composeScene(baseScene(), overlay({ scene: { duration: -1 } })),
    ).toThrowError(SceneValidationError);
  });
});
