import { describe, expect, it } from "vitest";
import { compileScene } from "@reframe/core";
import { buildLogoSting } from "../src/logoSting.js";

describe("buildLogoSting", () => {
  const data = {
    name: "Acme",
    paths: [
      { d: "M0 0 L10 0 L5 10 Z", fill: "#58A6FF" },
      { d: "M2 2 L8 2 L5 8 Z", fill: "#F24E1E" },
    ],
    viewBox: { minX: 0, minY: 0, w: 24, h: 24 },
    motion: "spin-forge" as const,
    seed: 1,
  };

  it("builds a renderable logo-sting scene with fill + ink layers per path", () => {
    const s = buildLogoSting(data);
    expect(s.id).toBe("logo-sting");
    const ids = s.nodes.flatMap((n) => (n.type === "group" ? [n.id, ...n.children.map((c) => c.id)] : [n.id]));
    expect(ids).toContain("logo");
    expect(ids).toEqual(expect.arrayContaining(["fill-0", "fill-1", "ink-0", "ink-1", "word"]));
    // scene() validated on construction; it also compiles to a positive duration
    expect(compileScene(s).duration).toBeGreaterThan(0);
  });

  it("is deterministic for the same data", () => {
    expect(JSON.stringify(buildLogoSting(data))).toBe(JSON.stringify(buildLogoSting(data)));
  });
});
