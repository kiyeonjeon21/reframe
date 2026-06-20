/**
 * Build the publishable reframe-video package from the workspace sources.
 *
 * Everything node-side is esbuild-bundled with REFRAME_PACKAGED constant-
 * folded to "1" (see the switches in render-cli sources), so the published
 * layout is self-contained:
 *
 *   dist/bin.js            the `reframe` bin (dispatcher)
 *   dist/cli.js            render pipeline (spawned by bin)
 *   dist/analyze.js        motion profiler
 *   dist/index.js|.d.ts    the core API (`import { scene } from "reframe-video"`)
 *   dist/browserEntry.js   prebundled capture-page script
 *   dist/renderer-canvas.js  preview's renderer (vite-aliased)
 *   assets/ guides/ preview/ copied alongside
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(PKG, "..", "..");
const define = { "process.env.REFRAME_PACKAGED": '"1"' };
const external = ["esbuild", "playwright", "vite"];

for (const dir of ["dist", "assets", "guides", "preview", ".claude-plugin", "skills"]) {
  await rm(join(PKG, dir), { recursive: true, force: true });
}

// --- node-side bundles ---------------------------------------------------
const nodeBundles: [entry: string, out: string][] = [
  ["packages/render-cli/src/reframe.ts", "bin.js"],
  ["packages/render-cli/src/cli.ts", "cli.js"],
  ["packages/render-cli/src/labels.ts", "labels.js"],
  ["packages/render-cli/src/compile.ts", "compile.js"],
  ["packages/render-cli/src/manifest.ts", "manifest.js"],
  ["packages/render-cli/src/lint.ts", "lint.js"],
  ["packages/render-cli/src/verifyOverlay.ts", "verifyOverlay.js"],
  ["packages/render-cli/src/compileApi.ts", "compile-api.js"],
  ["packages/render-cli/src/player.ts", "player.js"],
  ["packages/render-cli/src/diff.ts", "diff.js"],
  ["packages/render-cli/src/frame.ts", "frame.js"],
  ["benchmark/harness/motion/analyze.ts", "analyze.js"],
  ["benchmark/harness/motion/trace-cli.ts", "trace-cli.js"],
];
for (const [entry, out] of nodeBundles) {
  await build({
    entryPoints: [join(REPO, entry)],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: join(PKG, "dist", out),
    define,
    external,
    logLevel: "warning",
  });
}
// the bin must run under node, not tsx
const binPath = join(PKG, "dist", "bin.js");
const bin = await readFile(binPath, "utf8");
await writeFile(binPath, bin.replace(/^#!.*\n/, "#!/usr/bin/env node\n"));
await chmod(binPath, 0o755);

// --- core API (runtime + declarations) ------------------------------------
await build({
  entryPoints: [join(REPO, "packages/core/src/index.ts")],
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  outfile: join(PKG, "dist", "index.js"),
  logLevel: "warning",
});
const dtsConfig = join(PKG, "dist", "tsconfig.dts.json");
await mkdir(join(PKG, "dist"), { recursive: true });
await writeFile(
  dtsConfig,
  JSON.stringify({
    extends: join(REPO, "tsconfig.base.json"),
    include: [join(REPO, "packages/core/src")],
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: join(REPO, "packages/core/src"),
      outDir: join(PKG, "dist", "types"),
    },
  }),
);
execFileSync("npx", ["tsc", "-p", dtsConfig], { cwd: REPO, stdio: "inherit" });
await rm(dtsConfig);
await writeFile(join(PKG, "dist", "index.d.ts"), 'export * from "./types/index.js";\n');

// --- compile API declarations (the `reframe-video/compile` library entry) -----
// Small, stable surface — hand-authored against the package's own core types.
await writeFile(
  join(PKG, "dist", "compile-api.d.ts"),
  [
    'import type { CompositionIR, SceneIR } from "./index.js";',
    'export declare class SceneLoadError extends Error { readonly kind: "bundle" | "eval" | "validation"; }',
    "export declare function loadScene(path: string): Promise<SceneIR>;",
    "export declare function loadSceneFromCode(code: string, resolveDir?: string): Promise<SceneIR>;",
    "export declare function isComposition(def: unknown): def is CompositionIR;",
    'export declare function loadModule(path: string): Promise<{ kind: "scene"; ir: SceneIR } | { kind: "composition"; ir: CompositionIR }>;',
    "",
  ].join("\n"),
);

// --- browser-side bundles --------------------------------------------------
await build({
  entryPoints: [join(REPO, "packages/render-cli/src/browserEntry.ts")],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: join(PKG, "dist", "browserEntry.js"),
  logLevel: "warning",
});
// The published renderer imports core by the PACKAGE name so a downstream
// consumer (who has `reframe-video`, not `@reframe/core`) can resolve it — and
// so it shares the ONE core instance the main entry exports (no duplicate
// `evaluate`). esbuild keeps `@reframe/core` external but rewrites the specifier
// to `reframe-video` (a self-import that resolves via the package's exports map).
const coreToSelf = {
  name: "core-to-self-import",
  setup(b: { onResolve: (o: { filter: RegExp }, cb: () => { path: string; external: true }) => void }) {
    b.onResolve({ filter: /^@reframe\/core$/ }, () => ({ path: "reframe-video", external: true as const }));
  },
};
await build({
  entryPoints: [join(REPO, "packages/renderer-canvas/src/index.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: join(PKG, "dist", "renderer-canvas.js"),
  plugins: [coreToSelf],
  logLevel: "warning",
});
// renderer-canvas declarations: tsc emits with the source's `@reframe/core`
// import; repoint it at the package's own core types so `reframe-video/renderer`
// type-resolves for consumers.
const rcDtsConfig = join(PKG, "dist", "tsconfig.rc-dts.json");
await writeFile(
  rcDtsConfig,
  JSON.stringify({
    extends: join(REPO, "tsconfig.base.json"),
    include: [join(REPO, "packages/renderer-canvas/src")],
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      lib: ["ES2022", "DOM"],
      rootDir: join(REPO, "packages/renderer-canvas/src"),
      outDir: join(PKG, "dist", "types-renderer"),
    },
  }),
);
execFileSync("npx", ["tsc", "-p", rcDtsConfig], { cwd: REPO, stdio: "inherit" });
await rm(rcDtsConfig);
const rcTypes = join(PKG, "dist", "types-renderer", "index.d.ts");
await writeFile(rcTypes, (await readFile(rcTypes, "utf8")).replaceAll('"@reframe/core"', '"../types/index.js"'));
await writeFile(join(PKG, "dist", "renderer-canvas.d.ts"), 'export * from "./types-renderer/index.js";\n');

// regression guard: the published renderer must self-import the package, never a
// bare `@reframe/core` (which a consumer can't resolve).
const rcJs = await readFile(join(PKG, "dist", "renderer-canvas.js"), "utf8");
if (rcJs.includes("@reframe/core")) throw new Error("renderer-canvas.js still imports @reframe/core — the self-import rewrite regressed");
if (!/from\s*["']reframe-video["']/.test(rcJs)) throw new Error("renderer-canvas.js does not import reframe-video — expected a self-import of core");

// --- assets & guides -------------------------------------------------------
await cp(join(REPO, "assets", "fonts"), join(PKG, "assets", "fonts"), { recursive: true });
await cp(join(REPO, "assets", "sfx"), join(PKG, "assets", "sfx"), { recursive: true });
await mkdir(join(PKG, "guides"), { recursive: true });
// Guides ship flat under guides/; sources are the authoring docs under docs/.
// Keep this set in sync with the GUIDE map in render-cli/src/reframe.ts.
const GUIDES = [
  { src: "docs/guides/edsl-guide.md", dst: "edsl-guide.md" },
  { src: "docs/guides/directing-guide.md", dst: "directing-guide.md" },
  { src: "docs/guides/html-guide.md", dst: "html-guide.md" },
  { src: "docs/guides/regen-contract.md", dst: "regen-contract.md" },
];
for (const { src, dst } of GUIDES) {
  const out = join(PKG, "guides", dst);
  await cp(join(REPO, src), out);
  if (!existsSync(out)) throw new Error(`guide not shipped: ${out} (from ${src})`);
}
await cp(join(REPO, "LICENSE"), join(PKG, "LICENSE"));

// --- authoring brain: the Claude Code plugin + skill (portable for SDK/agent
// consumers — SKILL.md already points at `reframe-video guide`, not repo files,
// so it works from node_modules with no sibling repo). Kept at the same relative
// paths so `reframe skill` resolves them in repo and packaged alike.
await cp(join(REPO, "plugin", ".claude-plugin"), join(PKG, ".claude-plugin"), { recursive: true });
await cp(join(REPO, "plugin", "skills"), join(PKG, "skills"), { recursive: true });

// --- preview ---------------------------------------------------------------
await mkdir(join(PKG, "preview", "src"), { recursive: true });
const html = await readFile(join(REPO, "packages/preview/index.html"), "utf8");
await writeFile(
  join(PKG, "preview", "index.html"),
  html.replaceAll("../../assets/fonts/", "../assets/fonts/"),
);
for (const f of ["main.ts", "panel.ts", "store.ts", "virtual.d.ts"]) {
  let src = await readFile(join(REPO, "packages/preview/src", f), "utf8");
  if (f === "main.ts") {
    // the packaged preview has no examples/ — only cwd scenes/compositions
    src = src.replace(
      /import\.meta\.glob<\{ default: SceneIR \}>\("\.\.\/\.\.\/\.\.\/examples\/scenes\/\*\.ts"\)/,
      "({} as Record<string, () => Promise<{ default: SceneIR }>>)",
    );
    src = src.replace(
      /import\.meta\.glob<\{ default: CompositionIR \}>\("\.\.\/\.\.\/\.\.\/examples\/compositions\/\*\.ts"\)/,
      "({} as Record<string, () => Promise<{ default: CompositionIR }>>)",
    );
    if (src.includes("import.meta.glob")) throw new Error("examples glob not stripped");
  }
  await writeFile(join(PKG, "preview", "src", f), src);
}
await writeFile(
  join(PKG, "preview", "vite.config.ts"),
  `import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const PKG_ROOT = resolve(__dirname, "..");
const userDir = process.env.REFRAME_SCENE_DIR ? resolve(process.env.REFRAME_SCENE_DIR) : undefined;
const SCENE_DIR = userDir && existsSync(userDir) ? userDir : undefined;

function userScenes(): { name: string; path: string }[] {
  if (!SCENE_DIR) return [];
  return readdirSync(SCENE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .map((f) => join(SCENE_DIR, f))
    .filter((p) => {
      try {
        const src = readFileSync(p, "utf8");
        return src.includes("@reframe/core") || src.includes("reframe-video");
      } catch {
        return false;
      }
    })
    .map((p) => ({ name: basename(p, ".ts"), path: p }));
}

const userScenesPlugin: Plugin = {
  name: "reframe-user-scenes",
  resolveId(id) {
    return id === "virtual:reframe-user-scenes" ? "\\0reframe-user-scenes" : undefined;
  },
  load(id) {
    if (id !== "\\0reframe-user-scenes") return undefined;
    const entries = userScenes().map(
      (s) =>
        \`  { name: \${JSON.stringify(s.name)}, dir: \${JSON.stringify(dirname(s.path))}, load: () => import(\${JSON.stringify(\`/@fs\${s.path}\`)}) },\`,
    );
    return \`export const userScenes = [\\n\${entries.join("\\n")}\\n];\\n\`;
  },
};

export default defineConfig({
  plugins: [userScenesPlugin],
  define: { __REFRAME_EXAMPLES_DIR__: '""' }, // packaged preview ships no examples
  resolve: {
    alias: {
      "@reframe/core": resolve(PKG_ROOT, "dist", "index.js"),
      "reframe-video": resolve(PKG_ROOT, "dist", "index.js"),
      "@reframe/renderer-canvas": resolve(PKG_ROOT, "dist", "renderer-canvas.js"),
    },
  },
  server: {
    fs: { allow: [PKG_ROOT, ...(SCENE_DIR ? [SCENE_DIR] : [])] },
  },
});
`,
);

console.log("built reframe-video");
