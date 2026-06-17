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
import { cp, mkdir, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(PKG, "..", "..");
const define = { "process.env.REFRAME_PACKAGED": '"1"' };
const external = ["esbuild", "playwright", "vite"];

for (const dir of ["dist", "assets", "guides", "preview"]) {
  await rm(join(PKG, dir), { recursive: true, force: true });
}

// --- node-side bundles ---------------------------------------------------
const nodeBundles: [entry: string, out: string][] = [
  ["packages/render-cli/src/reframe.ts", "bin.js"],
  ["packages/render-cli/src/cli.ts", "cli.js"],
  ["packages/render-cli/src/labels.ts", "labels.js"],
  ["packages/render-cli/src/player.ts", "player.js"],
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

// --- browser-side bundles --------------------------------------------------
await build({
  entryPoints: [join(REPO, "packages/render-cli/src/browserEntry.ts")],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: join(PKG, "dist", "browserEntry.js"),
  logLevel: "warning",
});
await build({
  entryPoints: [join(REPO, "packages/renderer-canvas/src/index.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: join(PKG, "dist", "renderer-canvas.js"),
  external: ["@reframe/core"], // vite aliases it to dist/index.js → one core instance
  logLevel: "warning",
});

// --- assets & guides -------------------------------------------------------
await cp(join(REPO, "assets", "fonts"), join(PKG, "assets", "fonts"), { recursive: true });
await cp(join(REPO, "assets", "sfx"), join(PKG, "assets", "sfx"), { recursive: true });
await mkdir(join(PKG, "guides"), { recursive: true });
await cp(join(REPO, "benchmark/guides/edsl-guide.md"), join(PKG, "guides", "edsl-guide.md"));
await cp(join(REPO, "docs/regen-contract.md"), join(PKG, "guides", "regen-contract.md"));
await cp(join(REPO, "LICENSE"), join(PKG, "LICENSE"));

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
