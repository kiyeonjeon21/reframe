/**
 * Structured validation: every problem carries a stable `code` + a `path` locator
 * alongside the verbatim `message`. Back-compat (`.problems`/`.message`/class) is
 * covered by the existing toThrow tests staying green; this pins the structure.
 */
import { describe, expect, it } from "vitest";
import type { CompositionIR, SceneIR } from "../src/ir.js";
import { SceneValidationError, validateComposition, validateScene, type ValidationIssue } from "../src/validate.js";

function issuesOf(run: () => void): ValidationIssue[] {
  try {
    run();
  } catch (e) {
    if (e instanceof SceneValidationError) return e.issues;
    throw e;
  }
  throw new Error("expected validation to throw");
}
const has = (issues: ValidationIssue[], code: string, path: string) =>
  issues.some((i) => i.code === code && i.path === path);

describe("structured validation issues", () => {
  const bad: SceneIR = {
    version: 1,
    id: "t",
    size: { width: 100, height: 100 },
    nodes: [
      { type: "rect", id: "box", props: { x: 0, y: 0, width: 10, height: 10, fill: "#fff", blend: "nope" } },
      { type: "rect", id: "box", props: { x: 0, y: 0, width: 10, height: 10, fill: "#fff" } }, // duplicate id
    ],
    timeline: { kind: "beat", name: "b", at: "ghost", children: [{ kind: "wait", duration: 0.5 }] },
  } as unknown as SceneIR;

  it("each problem gets a stable code + path locator", () => {
    const issues = issuesOf(() => validateScene(bad));
    expect(has(issues, "unknown-blend", "nodes.box")).toBe(true);
    expect(has(issues, "duplicate-node-id", "nodes.box")).toBe(true);
    expect(has(issues, "unknown-timeline-label", "timeline")).toBe(true); // the beat's anchor
  });

  it("a prop error points at nodes.<id>.<prop>", () => {
    const ir = {
      version: 1, id: "t", size: { width: 100, height: 100 },
      nodes: [{ type: "rect", id: "r", props: { x: 0, y: 0, width: 1, height: 1, fill: "#fff" } }],
      states: { s: { r: { content: "x" } } }, // content is not a rect prop
    } as unknown as SceneIR;
    const issues = issuesOf(() => validateScene(ir));
    expect(has(issues, "unknown-prop", "nodes.r.content")).toBe(true);
  });

  it("back-compat: .problems mirrors the messages and .message is the joined format", () => {
    const issues = issuesOf(() => validateScene(bad));
    const err = (() => {
      try { validateScene(bad); } catch (e) { return e as SceneValidationError; }
      throw new Error("unreachable");
    })();
    expect(err.problems).toEqual(issues.map((i) => i.message));
    expect(err.message.startsWith("Scene validation failed:\n  - ")).toBe(true);
    // a message is verbatim (byte-identical to the pre-refactor string)
    expect(err.problems).toContain(`node "box": unknown blend "nope" — use normal, multiply, screen, overlay, lighten, darken, add, color-dodge, soft-light, hard-light, difference`);
  });

  it("composition issues keep the child code and nest the path", () => {
    const mk = (id: string, blend?: string): SceneIR =>
      ({ version: 1, id, size: { width: 1, height: 1 },
         nodes: [{ type: "rect", id: "r", props: { x: 0, y: 0, width: 1, height: 1, fill: "#fff", ...(blend && { blend }) } }] } as unknown as SceneIR);
    const comp = { id: "c", scenes: [{ scene: mk("a", "nope") }, { scene: mk("a") }] } as unknown as CompositionIR;
    const issues = issuesOf(() => validateComposition(comp));
    expect(has(issues, "unknown-blend", "scenes[0].nodes.r")).toBe(true); // nested path
    expect(issues.some((i) => i.code === "duplicate-scene-id")).toBe(true);
  });
});
