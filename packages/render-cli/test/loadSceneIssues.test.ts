/**
 * `loadScene` surfaces structured validation issues on `SceneLoadError`. The error
 * is thrown by the scene's OWN bundled core (cross-bundle), so `instanceof` fails and
 * `.issues` must be read as a plain-object property — this guards that path.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadScene, SceneLoadError } from "../src/loadScene.js";

const dirs: string[] = [];
async function fixture(src: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reframe-issues-"));
  dirs.push(dir);
  const path = join(dir, "scene.ts");
  await writeFile(path, src, "utf8");
  return path;
}
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe("loadScene → structured validation issues", () => {
  it("attaches .issues (code + path) across the scene bundle boundary", async () => {
    const src = `import { scene, rect } from "@reframe/core";
export default scene({ id: "t", size: { width: 100, height: 100 },
  nodes: [rect({ id: "box", x: 0, y: 0, width: 10, height: 10, fill: "#fff", blend: "nope" as never })] });`;
    const path = await fixture(src);
    try {
      await loadScene(path);
      throw new Error("expected load to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(SceneLoadError);
      const err = e as SceneLoadError;
      expect(err.kind).toBe("validation");
      expect(err.issues).toBeDefined();
      expect(err.issues!.some((i) => i.code === "unknown-blend" && i.path === "nodes.box")).toBe(true);
    }
  }, 30_000);
});
