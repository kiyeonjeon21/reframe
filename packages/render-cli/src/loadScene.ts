/**
 * Load a scene module from anywhere on disk.
 *
 * The file is bundled with esbuild before importing, with `@reframe/core`
 * aliased to this repo's core entry — so a scene is a single self-contained
 * document that needs no package.json or node_modules next to it. Relative
 * imports beside the scene file (shared palettes, layout helpers) bundle in
 * too. JSON inputs are the IR itself and skip the bundler.
 */
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateScene, type SceneIR } from "@reframe/core";

const CORE_ENTRY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "core", "src", "index.ts",
);

export async function loadScene(path: string): Promise<SceneIR> {
  if (path.endsWith(".json")) {
    const ir = JSON.parse(await readFile(path, "utf8")) as SceneIR;
    validateScene(ir);
    return ir;
  }
  let code: string;
  try {
    const out = await build({
      entryPoints: [path],
      bundle: true,
      format: "esm",
      platform: "neutral",
      write: false,
      logLevel: "silent",
      sourcemap: "inline",
      alias: { "@reframe/core": CORE_ENTRY },
    });
    code = out.outputFiles[0]!.text;
  } catch (err) {
    throw new Error(
      `failed to bundle ${path}:\n${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const mod = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  )) as { default?: SceneIR };
  if (!mod.default) throw new Error(`${path} must default-export a scene`);
  return mod.default;
}
