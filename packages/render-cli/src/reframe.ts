#!/usr/bin/env tsx
/**
 * reframe — the single user-facing entry point.
 *
 *   pnpm reframe render <scene.ts|.json|.html> [--overlay f]... [-o out.mp4]
 *   pnpm reframe preview
 *   pnpm reframe new <scene-name>
 *   pnpm reframe motion <out.mp4|framesDir> [...analyze args]
 *   pnpm reframe guide [--regen]
 *   pnpm reframe demo
 *
 * Thin dispatcher over the existing tools, plus the onboarding affordances:
 * user paths resolve against the invoking directory, outputs default to
 * out/, and the two classic first-run failures (missing ffmpeg, missing
 * Playwright browser) produce actionable hints instead of raw stack traces.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SceneIR } from "@reframe/core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const USER_CWD = process.env.INIT_CWD ?? process.cwd();
const RENDER_CLI = join(ROOT, "packages", "render-cli", "src", "cli.ts");
const ANALYZE = join(ROOT, "benchmark", "harness", "motion", "analyze.ts");

const USAGE = `reframe — declarative motion graphics

usage:
  pnpm reframe render <scene.ts|.json|.html> [--overlay edits.json]... [-o out.mp4] [--fps N] [--duration S] [--no-audio]
  pnpm reframe batch <scene.ts> <data.json|csv> [-o outDir] [--overlay base.json]... [--concurrency N] [--fps N]
  pnpm reframe preview                 open the scrub/edit UI (scenes from examples/scenes/)
  pnpm reframe new <scene-name>        scaffold examples/scenes/<scene-name>.ts
  pnpm reframe motion <mp4|framesDir>  motion-profile a rendered clip
  pnpm reframe guide [--regen]         print the scene-authoring guide (for you or your AI)
  pnpm reframe demo                    run the edit-survival demo (3 mp4s into out/)
`;

const userPath = (p: string) => (isAbsolute(p) ? p : resolve(USER_CWD, p));

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(2);
}

function preflightFfmpeg() {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).error) {
    fail("ffmpeg not found on PATH — install it first (macOS: brew install ffmpeg, debian: apt install ffmpeg)");
  }
}

/** Run a child, mirroring output and appending a hint on known failures. */
function run(cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<number> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: ["inherit", "inherit", "pipe"] });
    let sawBrowserError = false;
    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      if (/Executable doesn't exist|browserType\.launch/.test(text)) sawBrowserError = true;
      process.stderr.write(text);
    });
    proc.on("close", (code) => {
      if (code !== 0 && sawBrowserError) {
        console.error("\nhint: the Playwright browser is not installed yet — run: pnpm exec playwright install chromium");
      }
      res(code ?? 1);
    });
  });
}

const SCENE_TEMPLATE = (name: string, id: string) => `import { scene, group, rect, text, seq, to, wait } from "@reframe/core";

// Scenes are pure functions of time: no Math.random()/Date — randomness via
// wiggle(seed). Full syntax: pnpm reframe guide
export default scene({
  id: "${name}",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    // Base props describe the FINISHED design; states override sparsely.
    group({ id: "${id}", x: 960, y: 540 }, [
      rect({
        id: "${id}-card",
        x: 0,
        y: 0,
        width: 560,
        height: 200,
        anchor: "center",
        fill: "#1E2A3A",
        radius: 24,
      }),
      text({
        id: "${id}-title",
        x: 0,
        y: 0,
        anchor: "center",
        content: "${name}",
        fontFamily: "Inter", // bundled weights: 400 / 700 / 800
        fontSize: 64,
        fontWeight: 800,
        fill: "#FFFFFF",
      }),
    ]),
  ],

  states: {
    hidden: {
      "${id}-card": { opacity: 0, scale: 0.9 },
      "${id}-title": { opacity: 0, y: 24 },
    },
    shown: {
      "${id}-card": { opacity: 1, scale: 1 },
      "${id}-title": { opacity: 1, y: 0 },
    },
  },
  initial: "hidden",

  // Labels are stable addresses: overlays (and the preview editor) can patch
  // duration/ease on labeled steps, and the edits survive regeneration.
  timeline: seq(
    to("shown", { duration: 0.6, ease: "easeOutCubic", stagger: 0.08, label: "enter" }),
    wait(2.0, "hold"),
    to("hidden", { duration: 0.4, ease: "easeInCubic", label: "exit" }),
  ),

  // behaviors: [oscillate("${id}", "y", { amplitude: 6, frequency: 0.4 }, { from: 0.8, until: 2.4 })],
});
`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "render": {
      const input = rest[0];
      if (!input || input.startsWith("-")) fail(`render needs an input file\n\n${USAGE}`);
      const inputPath = userPath(input);
      if (!existsSync(inputPath)) fail(`no such file: ${inputPath}`);
      const mode = /\.(ts|json)$/.test(input) ? "ir" : /\.html$/.test(input) ? "html" : null;
      if (!mode) {
        fail(`cannot infer render mode from "${input}" — expected .ts/.json (reframe scene) or .html (GSAP page)`);
      }
      const args = rest.slice(1);
      if (mode === "html" && !args.includes("--duration")) {
        fail("html render requires --duration <seconds> (the page does not declare its own length)");
      }
      preflightFfmpeg();
      // default output: <repo>/out/<basename>.mp4
      let outArgs = args;
      if (!args.includes("-o")) {
        await mkdir(join(ROOT, "out"), { recursive: true });
        outArgs = [...args, "-o", join(ROOT, "out", `${basename(input).replace(/\.[^.]+$/, "")}.mp4`)];
      }
      // user-relative paths for overlays and -o
      outArgs = outArgs.map((a, i) =>
        outArgs[i - 1] === "--overlay" || outArgs[i - 1] === "-o" ? userPath(a) : a,
      );
      process.exit(await run("npx", ["tsx", RENDER_CLI, mode, inputPath, ...outArgs]));
    }

    case "batch": {
      const [sceneArg, dataArg, ...flags] = rest;
      if (!sceneArg || !dataArg) fail("usage: pnpm reframe batch <scene.ts> <data.json|csv> [...]");
      const scenePath = userPath(sceneArg);
      const dataPath = userPath(dataArg);
      for (const p of [scenePath, dataPath]) if (!existsSync(p)) fail(`no such file: ${p}`);
      preflightFfmpeg();

      let outDir = join(ROOT, "out", "batch");
      let concurrency = 3;
      let fps: number | undefined;
      const baseOverlayPaths: string[] = [];
      for (let i = 0; i < flags.length; i++) {
        if (flags[i] === "-o") outDir = userPath(flags[++i]!);
        else if (flags[i] === "--overlay") baseOverlayPaths.push(userPath(flags[++i]!));
        else if (flags[i] === "--concurrency") concurrency = Number(flags[++i]);
        else if (flags[i] === "--fps") fps = Number(flags[++i]);
        else fail(`unknown flag ${flags[i]}`);
      }

      const { loadRows, runBatch } = await import("./batch.js");
      const { pathToFileURL } = await import("node:url");
      const { readFile } = await import("node:fs/promises");
      const scene = ((await import(pathToFileURL(scenePath).href)) as { default: SceneIR }).default;
      if (!scene) fail(`${scenePath} must default-export a scene`);
      const baseOverlays = await Promise.all(
        baseOverlayPaths.map(async (p) => JSON.parse(await readFile(p, "utf8"))),
      );
      const rows = await loadRows(dataPath);
      if (rows.length === 0) fail(`${dataPath}: no data rows`);
      console.log(`batch: ${rows.length} rows × ${concurrency} workers → ${outDir}`);

      const results = await runBatch(scene, rows, {
        outDir,
        baseOverlays,
        concurrency,
        scenePath,
        ...(fps !== undefined && { fps }),
        onRow: (r) => {
          if (r.error) console.error(`  ✗ ${r.name}: ${r.error.split("\n")[0]}`);
          else if (r.orphans.length > 0) {
            console.warn(`  ! ${r.name}: rendered with ${r.orphans.length} orphaned edit(s)`);
            for (const o of r.orphans) console.warn(`      ${o.address}: ${o.reason}`);
          } else console.log(`  ✓ ${r.name} (${r.applied} edits)`);
        },
      });
      const failed = results.filter((r) => r.error).length;
      const orphaned = results.filter((r) => !r.error && r.orphans.length > 0).length;
      console.log(
        `\n${results.length - failed} rendered (${orphaned} with orphans), ${failed} failed — report: ${join(outDir, "batch-report.json")}`,
      );
      process.exit(failed > 0 ? 1 : 0);
    }

    case "preview":
      process.exit(await run("pnpm", ["--filter", "@reframe/preview", "dev"]));

    case "new": {
      const name = rest[0];
      if (!name) fail("usage: pnpm reframe new <scene-name>");
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        fail(`scene name must be kebab-case (a-z, 0-9, -): got "${name}"`);
      }
      // Scenes must live here: the preview's scene list and the workspace
      // resolution of @reframe/core both only work inside examples/scenes/.
      const target = join(ROOT, "examples", "scenes", `${name}.ts`);
      if (existsSync(target)) fail(`examples/scenes/${name}.ts already exists`);
      const id = name.split("-")[0] ?? name;
      await writeFile(target, SCENE_TEMPLATE(name, id));
      console.log(`created examples/scenes/${name}.ts
  preview:  pnpm reframe preview        (pick "${name}" in the dropdown)
  render:   pnpm reframe render examples/scenes/${name}.ts
  syntax:   pnpm reframe guide`);
      return;
    }

    case "motion": {
      const input = rest[0];
      if (!input) fail("usage: pnpm reframe motion <mp4|framesDir> [...args]");
      preflightFfmpeg();
      process.exit(await run("npx", ["tsx", ANALYZE, userPath(input), ...rest.slice(1)]));
    }

    case "guide": {
      const file = rest.includes("--regen")
        ? join(ROOT, "docs", "regen-contract.md")
        : join(ROOT, "benchmark", "guides", "edsl-guide.md");
      process.exit(await run("cat", [file]));
    }

    case "demo":
      preflightFfmpeg();
      process.exit(
        await run("npx", ["tsx", join(ROOT, "examples", "scripts", "demo-edit-survival.ts")]),
      );

    default:
      console.log(USAGE);
      process.exit(command === undefined || command === "help" ? 0 : 2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
