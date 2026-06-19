import { describe, expect, it } from "vitest";
import { loadScene, loadSceneFromCode, SceneLoadError } from "../src/loadScene.js";

const good = (id = "ok") =>
  `import { scene, text } from "@reframe/core";
   export default scene({ id: "${id}", size: { width: 100, height: 100 }, fps: 30,
     nodes: [text({ id: "t", x: 0, y: 0, content: "hi", fontFamily: "Inter", fontSize: 12 })] });`;

async function kindOf(code: string): Promise<string> {
  try {
    await loadSceneFromCode(code);
    return "ok";
  } catch (err) {
    expect(err).toBeInstanceOf(SceneLoadError);
    return (err as SceneLoadError).kind;
  }
}

describe("loadSceneFromCode → validated SceneIR", () => {
  it("compiles eDSL source to a SceneIR (no render)", async () => {
    const ir = await loadSceneFromCode(good("from-code"));
    expect(ir.id).toBe("from-code");
    expect(ir.nodes).toHaveLength(1);
  });

  it("classifies a bundle error (syntax)", async () => {
    expect(await kindOf("export default scene({ ")).toBe("bundle");
  });

  it("classifies an eval error (ReferenceError)", async () => {
    expect(await kindOf("export default nope();")).toBe("eval");
  });

  it("classifies a validation error (duplicate id), surfaced at scene() construction", async () => {
    const dup = `import { scene, rect } from "@reframe/core";
      export default scene({ id: "d", size: { width: 10, height: 10 }, fps: 30,
        nodes: [rect({ id: "a", x: 0, y: 0, width: 1, height: 1 }), rect({ id: "a", x: 1, y: 1, width: 1, height: 1 })] });`;
    expect(await kindOf(dup)).toBe("validation");
  });

  it("rejects a composition as a single scene", async () => {
    const comp = `export default { version: 1, scenes: [] };`;
    expect(await kindOf(comp)).toBe("validation");
  });

  it("error messages are sanitized — never the base64 bundle", async () => {
    try {
      await loadSceneFromCode("export default boom();");
      throw new Error("expected a throw");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain("data:text/javascript");
      expect(msg).toContain("boom is not defined");
    }
  });
});

describe("loadScene (path) shares the same error contract", () => {
  it("a missing file fails cleanly, not with a stack dump", async () => {
    await expect(loadScene("/no/such/scene.ts")).rejects.toBeInstanceOf(SceneLoadError);
  });
});
