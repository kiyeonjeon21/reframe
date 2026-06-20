/**
 * Load a scene (or composition) module from anywhere on disk — or straight from
 * source text.
 *
 * The file/source is bundled with esbuild before importing, with `@reframe/core`
 * aliased to this repo's core entry — so a scene is a single self-contained
 * document that needs no package.json or node_modules next to it. Relative
 * imports beside the scene file (shared palettes, layout helpers) bundle in
 * too. JSON inputs are the IR itself and skip the bundler.
 *
 * Errors are surfaced as `SceneLoadError` with a `kind` (`bundle` | `eval` |
 * `validation`) and a concise message — the giant `data:text/javascript;base64,…`
 * bundle URL is stripped, so feeding the message to a user or an LLM is useful.
 */
import { build, type BuildOptions } from "esbuild";
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

/** A load failure with a coarse stage so callers can branch / report structured errors. */
export class SceneLoadError extends Error {
  readonly kind: "bundle" | "eval" | "validation";
  constructor(kind: "bundle" | "eval" | "validation", message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SceneLoadError";
    this.kind = kind;
  }
}

/** The base64 scene bundle is ~64KB of noise in a stack/message — replace it. */
const clean = (err: unknown): string =>
  (err instanceof Error ? err.message : String(err)).replace(
    /data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,
    "<scene bundle>",
  );

const ALIAS = { "@reframe/core": CORE_ENTRY, "reframe-video": CORE_ENTRY };

/** esbuild a scene to ESM code (from a file entry or inline source) → throws `bundle`. */
export async function bundle(input: { path: string } | { code: string; resolveDir: string }): Promise<string> {
  const common: BuildOptions = {
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
    sourcemap: "inline",
    alias: ALIAS,
  };
  try {
    const out = await build(
      "path" in input
        ? { ...common, entryPoints: [input.path] }
        : { ...common, stdin: { contents: input.code, resolveDir: input.resolveDir, loader: "ts", sourcefile: "scene.ts" } },
    );
    return out.outputFiles![0]!.text;
  } catch (err) {
    throw new SceneLoadError("bundle", clean(err), { cause: err });
  }
}

/** Dynamic-import bundled code → throws `validation` (scene() validates at
 *  construction) or `eval` (ReferenceError / a throw in the scene). */
async function importDefault(code: string, label: string): Promise<unknown> {
  let mod: { default?: unknown };
  try {
    mod = (await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)) as { default?: unknown };
  } catch (err) {
    // scene() runs validateScene at construction; that SceneValidationError
    // surfaces here. It comes from the scene's own bundled core, so match by
    // name (cross-bundle `instanceof` would not).
    const kind = err instanceof Error && err.name === "SceneValidationError" ? "validation" : "eval";
    throw new SceneLoadError(kind, clean(err), { cause: err });
  }
  if (mod.default === undefined) throw new SceneLoadError("eval", `${label} must default-export a scene or composition`);
  return mod.default;
}

async function loadDefault(path: string): Promise<unknown> {
  if (path.endsWith(".json")) {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (err) {
      throw new SceneLoadError("eval", `failed to read ${path}: ${clean(err)}`, { cause: err });
    }
  }
  return importDefault(await bundle({ path }), path);
}

/** True for a default export that is a CompositionIR (has a `scenes` array). */
export function isComposition(def: unknown): def is CompositionIR {
  return typeof def === "object" && def !== null && Array.isArray((def as { scenes?: unknown }).scenes);
}

function asScene(def: unknown, label: string): SceneIR {
  if (isComposition(def)) {
    throw new SceneLoadError("validation", `${label} is a composition — render it directly, not as a single scene`);
  }
  try {
    validateScene(def as SceneIR);
  } catch (err) {
    throw new SceneLoadError("validation", clean(err), { cause: err });
  }
  return def as SceneIR;
}

/** Load + validate a scene from a file path (.ts bundled, .json parsed). */
export async function loadScene(path: string): Promise<SceneIR> {
  return asScene(await loadDefault(path), path);
}

/** Load + validate a scene straight from eDSL source text (no temp file). For a
 *  backend that hands generated source directly. `resolveDir` (default cwd) is
 *  where relative imports in the source resolve. */
export async function loadSceneFromCode(code: string, resolveDir: string = process.cwd()): Promise<SceneIR> {
  return asScene(await importDefault(await bundle({ code, resolveDir }), "<source>"), "<source>");
}

/** Evaluate ALREADY-BUNDLED scene code into a validated SceneIR. `buster` is
 *  appended as a comment so the `data:` URL differs per call — Node caches ESM by
 *  URL, so without it a second eval of identical code returns the cached module
 *  (and never re-runs module-level code). Used by the determinism check to eval
 *  the same bundle twice and compare. */
export async function evalSceneOnce(code: string, buster: string): Promise<SceneIR> {
  return asScene(await importDefault(`${code}\n//det-${buster}`, "<source>"), "<source>");
}

/** Load a scene OR composition, validated and discriminated. */
export async function loadModule(
  path: string,
): Promise<{ kind: "scene"; ir: SceneIR } | { kind: "composition"; ir: CompositionIR }> {
  const def = await loadDefault(path);
  if (isComposition(def)) {
    try {
      validateComposition(def);
    } catch (err) {
      throw new SceneLoadError("validation", clean(err), { cause: err });
    }
    return { kind: "composition", ir: def };
  }
  return { kind: "scene", ir: asScene(def, path) };
}
