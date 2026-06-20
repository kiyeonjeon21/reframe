import { describe, expect, it } from "vitest";
import { scene, seq } from "../src/dsl.js";
import { title, lowerThird } from "../src/titles.js";
import { compileScene } from "../src/compile.js";
import { validateScene } from "../src/validate.js";

const ids = (tl: import("../src/ir.js").TimelineIR): string[] => {
  const out: string[] = [];
  const walk = (t: import("../src/ir.js").TimelineIR) => {
    if (t.kind === "beat") out.push(t.name);
    if ("label" in t && t.label !== undefined) out.push(t.label);
    if ("children" in t) t.children.forEach(walk);
  };
  walk(tl);
  return out;
};

describe("title", () => {
  it("returns kinetic glyph nodes + an entrance timeline + the block", () => {
    const t = title({ text: "HELLO", id: "ttl" });
    expect(t.nodes.length).toBe(5); // one node per glyph
    expect(t.nodes.every((n) => n.id.startsWith("ttl-"))).toBe(true);
    expect(t.block.ids).toEqual(["ttl-0", "ttl-1", "ttl-2", "ttl-3", "ttl-4"]);
    expect(ids(t.timeline)).toContain("ttl-in");
  });

  it("adds a hold + exit when `exit` is set", () => {
    const t = title({ text: "BYE", id: "ttl", exit: "dissolve", hold: 1 });
    const labels = ids(t.timeline);
    expect(labels).toContain("ttl-in");
    expect(labels).toContain("ttl-out");
  });

  it("composes into a valid scene and is deterministic", () => {
    const t = title({ text: "Our Year", id: "ttl", entrance: "rise", seed: 3 });
    const s = scene({ id: "s", size: { width: 1920, height: 1080 }, nodes: t.nodes, timeline: seq(t.timeline) });
    expect(() => validateScene(s)).not.toThrow();
    expect(() => compileScene(s)).not.toThrow();
    expect(JSON.stringify(title({ text: "Our Year", id: "ttl", entrance: "rise", seed: 3 }))).toBe(JSON.stringify(t));
  });
});

describe("lowerThird", () => {
  it("builds a group with stable bar/name/role ids", () => {
    const lt = lowerThird({ name: "Kiyeon Jeon", role: "Design Engineer", id: "lt" });
    expect(lt.nodes).toHaveLength(1);
    const grp = lt.nodes[0] as Extract<import("../src/ir.js").NodeIR, { type: "group" }>;
    expect(grp.id).toBe("lt");
    const childIds = grp.children.map((c) => c.id);
    expect(childIds).toEqual(["lt-bar", "lt-name", "lt-role"]);
    expect(ids(lt.timeline)).toEqual(expect.arrayContaining(["lt-in", "lt-out"]));
  });

  it("omits the role node when no role is given", () => {
    const lt = lowerThird({ name: "Solo", id: "lt" });
    const grp = lt.nodes[0] as Extract<import("../src/ir.js").NodeIR, { type: "group" }>;
    expect(grp.children.map((c) => c.id)).toEqual(["lt-bar", "lt-name"]);
  });

  it("composes into a valid scene and is deterministic", () => {
    const lt = lowerThird({ name: "A", role: "B", id: "lt" });
    const s = scene({ id: "s", size: { width: 1920, height: 1080 }, nodes: lt.nodes, timeline: seq(lt.timeline) });
    expect(() => validateScene(s)).not.toThrow();
    expect(JSON.stringify(lowerThird({ name: "A", role: "B", id: "lt" }))).toBe(JSON.stringify(lt));
  });
});
