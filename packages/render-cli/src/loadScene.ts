/**
 * Load a scene (or composition) module from anywhere on disk.
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
import { validateComposition, validateScene, type CompositionIR, type SceneIR } from "@reframe/core";

// In the published package the loader sits at dist/cli.js and core is the
// prebuilt dist/index.js; in the repo it aliases to core's TS source.
// REFRAME_PACKAGED is constant-folded in by the package build.
const HERE = dirname(fileURLToPath(import.meta.url));
const CORE_ENTRY =
  process.env.REFRAME_PACKAGED === "1"
    ? resolve(HERE, "index.js")
    : resolve(HERE, "..", "..", "core", "src", "index.ts");

/** Bundle + import the module's default export (unknown — scene or composition). */
async function loadDefault(path: string): Promise<unknown> {
  if (path.endsWith(".json")) return JSON.parse(await readFile(path, "utf8"));
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
      // both specifiers accepted: the guide's canonical "@reframe/core" and
      // the published package name
      alias: { "@reframe/core": CORE_ENTRY, "reframe-video": CORE_ENTRY },
    });
    code = out.outputFiles[0]!.text;
  } catch (err) {
    throw new Error(`failed to bundle ${path}:\n${err instanceof Error ? err.message : String(err)}`);
  }
  const mod = (await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  )) as { default?: unknown };
  if (mod.default === undefined) throw new Error(`${path} must default-export a scene or composition`);
  return mod.default;
}

/** True for a default export that is a CompositionIR (has a `scenes` array). */
export function isComposition(def: unknown): def is CompositionIR {
  return typeof def === "object" && def !== null && Array.isArray((def as { scenes?: unknown }).scenes);
}

export async function loadScene(path: string): Promise<SceneIR> {
  const def = await loadDefault(path);
  if (isComposition(def)) {
    throw new Error(`${path} is a composition — render it directly, not as a single scene`);
  }
  validateScene(def as SceneIR);
  return def as SceneIR;
}

/** Load a scene OR composition, validated and discriminated. */
export async function loadModule(
  path: string,
): Promise<{ kind: "scene"; ir: SceneIR } | { kind: "composition"; ir: CompositionIR }> {
  const def = await loadDefault(path);
  if (isComposition(def)) {
    validateComposition(def);
    return { kind: "composition", ir: def };
  }
  validateScene(def as SceneIR);
  return { kind: "scene", ir: def as SceneIR };
}
