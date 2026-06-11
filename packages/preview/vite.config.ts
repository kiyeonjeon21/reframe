import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const REPO_ROOT = resolve(__dirname, "..", "..");
const EXAMPLES_DIR = resolve(REPO_ROOT, "examples", "scenes");

// `reframe preview` passes the invoking directory so scenes there appear in
// the picker alongside examples/scenes/ — a scene is a standalone document,
// not something that has to live inside this repo.
const userDir = process.env.REFRAME_SCENE_DIR ? resolve(process.env.REFRAME_SCENE_DIR) : undefined;
const EXTRA_DIR = userDir && userDir !== EXAMPLES_DIR && existsSync(userDir) ? userDir : undefined;

/** .ts files in the user's directory that look like reframe scenes. */
function userScenes(): { name: string; path: string }[] {
  if (!EXTRA_DIR) return [];
  return readdirSync(EXTRA_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .map((f) => join(EXTRA_DIR, f))
    .filter((p) => {
      try {
        return readFileSync(p, "utf8").includes("@reframe/core");
      } catch {
        return false;
      }
    })
    .map((p) => ({ name: basename(p, ".ts"), path: p }));
}

/** Serves `virtual:reframe-user-scenes`: name + lazy loader per cwd scene. */
const userScenesPlugin: Plugin = {
  name: "reframe-user-scenes",
  resolveId(id) {
    return id === "virtual:reframe-user-scenes" ? "\0reframe-user-scenes" : undefined;
  },
  load(id) {
    if (id !== "\0reframe-user-scenes") return undefined;
    const entries = userScenes().map(
      (s) =>
        `  { name: ${JSON.stringify(s.name)}, dir: ${JSON.stringify(dirname(s.path))}, load: () => import(${JSON.stringify(`/@fs${s.path}`)}) },`,
    );
    return `export const userScenes = [\n${entries.join("\n")}\n];\n`;
  },
};

export default defineConfig({
  plugins: [userScenesPlugin],
  // relative image srcs in example scenes resolve against this directory
  define: { __REFRAME_EXAMPLES_DIR__: JSON.stringify(EXAMPLES_DIR) },
  resolve: {
    // scene files outside the workspace still import "@reframe/core"
    alias: { "@reframe/core": resolve(REPO_ROOT, "packages", "core", "src", "index.ts") },
  },
  server: {
    fs: { allow: [REPO_ROOT, ...(EXTRA_DIR ? [EXTRA_DIR] : [])] },
  },
});
