import { describe, expect, it } from "vitest";
import { scene, rect, group, tween, seq, par, beat, to, wait, motionPath, oscillate } from "../src/dsl.js";
import { compileScene } from "../src/compile.js";
import { sceneManifest, lintScene } from "../src/manifest.js";
import { TIMELINE_PATCHABLE } from "../src/compose.js";
import { PROPS_BY_TYPE } from "../src/validate.js";

// A small scene exercising every addressable surface: a group with a child, a
// state, a LABELED tween + an UNLABELED tween, a motionPath, a beat, a behavior.
const fixture = () =>
  scene({
    id: "fix",
    size: { width: 100, height: 100 },
    background: "#000",
    states: { open: { card: { opacity: 1 }, label: { y: 10 } } },
    behaviors: [oscillate("card", "rotation", { amplitude: 5, frequency: 1 })],
    nodes: [
      group({ id: "card", x: 0, y: 0, opacity: 0 }, [
        rect({ id: "label", x: 0, y: 0, width: 10, height: 10, fill: "#fff" }),
      ]),
      rect({ id: "dot", x: 0, y: 0, width: 4, height: 4, fill: "#f00" }),
    ],
    timeline: seq(
      beat("intro", { nodes: ["card"] }, [
        par(
          tween("card", { opacity: 1 }, { duration: 0.5, label: "reveal" }), // labeled
          tween("dot", { x: 50 }, { duration: 0.5 }), // UNLABELED motion
        ),
      ]),
      to("open", { duration: 0.4, label: "open-it" }),
      motionPath("dot", [[0, 0], [20, 20]], { duration: 0.5 }), // UNLABELED motion
      wait(0.2),
    ),
  });

describe("sceneManifest", () => {
  it("enumerates every node with type, parent, address, and editableProps == PROPS_BY_TYPE", () => {
    const m = sceneManifest(compileScene(fixture()));
    const ids = m.nodes.map((n) => n.id);
    expect(ids).toEqual(["card", "label", "dot"]);
    const card = m.nodes.find((n) => n.id === "card")!;
    expect(card.type).toBe("group");
    expect(card.parent).toBeUndefined();
    expect(card.address).toBe("nodes.card");
    expect(card.editableProps).toEqual(PROPS_BY_TYPE.group);
    const label = m.nodes.find((n) => n.id === "label")!;
    expect(label.parent).toBe("card");
    expect(label.editableProps).toEqual(PROPS_BY_TYPE.rect);
  });

  it("reports animatedProps (segments + motion paths) and inStates", () => {
    const m = sceneManifest(compileScene(fixture()));
    const card = m.nodes.find((n) => n.id === "card")!;
    expect(card.animatedProps).toContain("opacity"); // tween + state
    expect(card.inStates).toEqual(["open"]);
    const dot = m.nodes.find((n) => n.id === "dot")!;
    // tween sets x; motionPath drives x/y
    expect(dot.animatedProps).toEqual(expect.arrayContaining(["x", "y"]));
    const label = m.nodes.find((n) => n.id === "label")!;
    expect(label.inStates).toEqual(["open"]); // state "open" touches label.y
  });

  it("lists states with the nodes/props they touch", () => {
    const m = sceneManifest(compileScene(fixture()));
    expect(m.states).toHaveLength(1);
    const open = m.states[0]!;
    expect(open.name).toBe("open");
    expect(open.address).toBe("states.open");
    const touched = Object.fromEntries(open.touches.map((t) => [t.id, t.props]));
    expect(touched.card).toEqual(["opacity"]);
    expect(touched.label).toEqual(["y"]);
  });

  it("separates beats from labeled steps and advertises patchable params", () => {
    const m = sceneManifest(compileScene(fixture()));
    expect(m.beats.map((b) => b.name)).toEqual(["intro"]);
    expect(m.beats[0]!.ownsNodes).toEqual(["card"]);
    expect(m.beats[0]!.address).toBe("timeline.intro");

    const reveal = m.timeline.find((t) => t.label === "reveal")!;
    expect(reveal.kind).toBe("tween");
    expect(reveal.patchable).toEqual(TIMELINE_PATCHABLE.tween);
    const openIt = m.timeline.find((t) => t.label === "open-it")!;
    expect(openIt.kind).toBe("to");
    expect(openIt.patchable).toEqual(TIMELINE_PATCHABLE.to);
  });

  it("lists behaviors by (target, prop) with their address", () => {
    const m = sceneManifest(compileScene(fixture()));
    expect(m.behaviors).toEqual([{ target: "card", prop: "rotation", kind: "oscillate", address: "behaviors.card.rotation" }]);
  });

  it("summary counts labeled steps and the motion-addressable ratio", () => {
    const m = sceneManifest(compileScene(fixture()));
    // labeled: beat "intro" + tween "reveal" + to "open-it" = 3
    expect(m.summary.labeledSteps).toBe(3);
    // motion steps: tween card (labeled), tween dot (unlabeled), to (labeled), motionPath dot (unlabeled) = 4 total, 2 labeled
    expect(m.summary.unlabeledMotionSteps).toBe(2);
    expect(m.summary.motionAddressableRatio).toBeCloseTo(0.5, 5);
  });

  it("is deterministic — same scene → identical JSON", () => {
    const a = JSON.stringify(sceneManifest(compileScene(fixture())));
    const b = JSON.stringify(sceneManifest(compileScene(fixture())));
    expect(a).toBe(b);
  });
});

describe("lintScene", () => {
  it("flags unlabeled motion and not labeled motion", () => {
    const findings = lintScene(compileScene(fixture()));
    expect(findings.every((f) => f.rule === "unlabeled-motion" && f.severity === "warn")).toBe(true);
    const msg = findings.map((f) => f.message).join("\n");
    expect(msg).toContain('tween on "dot"'); // unlabeled
    expect(msg).toContain('motionPath on "dot"'); // unlabeled
    expect(msg).not.toContain('"reveal"'); // labeled tween is fine
    expect(findings).toHaveLength(2);
  });

  it("a fully-labeled scene has no findings", () => {
    const clean = scene({
      id: "clean",
      size: { width: 100, height: 100 },
      nodes: [rect({ id: "a", x: 0, y: 0, width: 10, height: 10, fill: "#fff" })],
      timeline: seq(tween("a", { x: 10 }, { duration: 0.5, label: "move" })),
    });
    expect(lintScene(compileScene(clean))).toEqual([]);
  });
});
