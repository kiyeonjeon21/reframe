/**
 * The source→IR determinism guard (distinct from determinism.test.ts, which covers
 * IR→render byte-identity). `checkDeterminism` bundles a scene once, evaluates it
 * twice, and flags any difference — catching Math.random()/Date that would make a
 * scene compile to a different IR each time.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkDeterminism, firstDiff } from "../src/determinism.js";

const dirs: string[] = [];
async function fixture(name: string, src: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reframe-det-"));
  dirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, src, "utf8");
  return path;
}
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

const PURE = `import { scene, rect, beat, tween } from "@reframe/core";
export default scene({ id: "p", size: { width: 100, height: 100 },
  nodes: [rect({ id: "box", x: 10, y: 10, width: 20, height: 20, fill: "#fff", opacity: 0 })],
  timeline: beat("in", {}, [tween("box", { opacity: 1 }, { duration: 0.5, label: "f" })]) });`;

const IMPURE = `import { scene, rect } from "@reframe/core";
export default scene({ id: "i", size: { width: 100, height: 100 },
  nodes: [rect({ id: "box", x: Math.random() * 50, y: 10, width: 20, height: 20, fill: "#fff" })] });`;

describe("checkDeterminism (source → IR purity)", () => {
  it("passes a pure scene", async () => {
    const r = await checkDeterminism(await fixture("pure.ts", PURE));
    expect(r.deterministic).toBe(true);
    expect(r.findings).toEqual([]);
  }, 30_000);

  it("catches Math.random — the data:-URL module cache is actually busted", async () => {
    const r = await checkDeterminism(await fixture("impure.ts", IMPURE));
    expect(r.deterministic).toBe(false);
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0]!;
    expect(f.rule).toBe("non-deterministic-render");
    expect(f.severity).toBe("error");
    expect(f.address).toContain("props.x"); // pinned to the differing prop
    expect(f.message).toContain("Math.random"); // source-scan hint
  }, 30_000);

  it(".json input is trivially deterministic (no source to re-evaluate)", async () => {
    const json = JSON.stringify({ version: 1, id: "j", size: { width: 1, height: 1 }, nodes: [] });
    const r = await checkDeterminism(await fixture("scene.json", json));
    expect(r.deterministic).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it("firstDiff reports the first differing address", () => {
    expect(firstDiff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })?.path).toBe("b.c");
    expect(firstDiff([1, 2, 3], [1, 9, 3])?.path).toBe("[1]");
    expect(firstDiff({ x: 1 }, { x: 1 })).toBeNull();
  });
});
