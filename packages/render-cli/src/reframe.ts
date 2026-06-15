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

// REFRAME_PACKAGED is constant-folded in by the npm package build: there the
// dispatcher lives at <pkg>/dist/bin.js next to prebuilt cli/analyze bundles,
// guides/ and assets/ — no tsx, no repo layout.
const PACKAGED = process.env.REFRAME_PACKAGED === "1";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = PACKAGED ? resolve(HERE, "..") : resolve(HERE, "..", "..", "..");
const USER_CWD = process.env.INIT_CWD ?? process.cwd();
const RENDER_CLI = PACKAGED
  ? join(ROOT, "dist", "cli.js")
  : join(ROOT, "packages", "render-cli", "src", "cli.ts");
const ANALYZE = PACKAGED
  ? join(ROOT, "dist", "analyze.js")
  : join(ROOT, "benchmark", "harness", "motion", "analyze.ts");
const TRACE = PACKAGED
  ? join(ROOT, "dist", "trace-cli.js")
  : join(ROOT, "benchmark", "harness", "motion", "trace-cli.ts");
const CMD = PACKAGED ? "reframe" : "pnpm reframe";

const USAGE = `reframe — declarative motion graphics

usage:
  ${CMD} render <scene.ts|.json|.html> [--overlay edits.json]... [-o out.mp4] [--fps N] [--duration S] [--no-audio]
  ${CMD} batch <scene.ts> <data.json|csv> [-o outDir] [--overlay base.json]... [--concurrency N] [--fps N]
  ${CMD} logo <logo.svg|brand-slug> ["Name"] [--motion <preset>] [--energy 0..1] [--seed N] [-o out.mp4]
                                 animate a logo into a sting (presets: draw-bloom, punch-in,
                                 rise-settle, slide-bank, reveal-orbit, spin-forge)
  ${CMD} preview                 open the scrub/edit UI (lists scenes in your directory)
  ${CMD} new <scene-name>        scaffold <scene-name>.ts in your directory
  ${CMD} motion <mp4|framesDir>  motion-profile a rendered clip
  ${CMD} trace <ref.mp4> [--apply scene.ts]  extract a video's motion structure → MotionSketch / timeline
  ${CMD} guide [--regen]         print the scene-authoring guide (for you or your AI)
  ${CMD} demo                    run the edit-survival demo (3 mp4s into out/)
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
function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<number> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? (PACKAGED ? USER_CWD : ROOT),
      stdio: ["inherit", "inherit", "pipe"],
      ...(opts.env && { env: { ...process.env, ...opts.env } }),
    });
    let sawBrowserError = false;
    proc.stderr.on("data", (d: Buffer) => {
      const text = d.toString();
      if (/Executable doesn't exist|browserType\.launch/.test(text)) sawBrowserError = true;
      process.stderr.write(text);
    });
    proc.on("close", (code) => {
      if (code !== 0 && sawBrowserError) {
        console.error(
          `\nhint: the Playwright browser is not installed yet — run: ${PACKAGED ? "npx playwright install chromium" : "pnpm exec playwright install chromium"}`,
        );
      }
      res(code ?? 1);
    });
  });
}

const SCENE_TEMPLATE = (name: string, id: string) => `import { scene, group, rect, text, seq, to, wait } from "@reframe/core";

// Scenes are pure functions of time: no Math.random()/Date — randomness via
// wiggle(seed). Full syntax: ${CMD} guide
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
      // default output: out/<basename>.mp4 (repo out/ in the repo, ./out when installed)
      const outBase = PACKAGED ? join(USER_CWD, "out") : join(ROOT, "out");
      let outArgs = args;
      if (!args.includes("-o")) {
        await mkdir(outBase, { recursive: true });
        outArgs = [...args, "-o", join(outBase, `${basename(input).replace(/\.[^.]+$/, "")}.mp4`)];
      }
      // user-relative paths for overlays and -o
      outArgs = outArgs.map((a, i) =>
        outArgs[i - 1] === "--overlay" || outArgs[i - 1] === "-o" ? userPath(a) : a,
      );
      process.exit(
        await (PACKAGED
          ? run(process.execPath, [RENDER_CLI, mode, inputPath, ...outArgs])
          : run("npx", ["tsx", RENDER_CLI, mode, inputPath, ...outArgs])),
      );
    }

    case "logo": {
      // positional: <slug|file> [Display Name]; everything else is a flag
      const positional: string[] = [];
      const flags: Record<string, string> = {};
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i]!;
        if (a.startsWith("--")) flags[a.slice(2)] = rest[++i] ?? "";
        else if (a === "-o") flags.o = rest[++i] ?? "";
        else positional.push(a);
      }
      const arg = positional[0];
      if (!arg) {
        fail(`usage: ${CMD} logo <logo.svg | brand-slug> ["Display Name"] [--motion <preset>] [--energy 0..1] [--speed n] [--intensity 0..1] [--from left|right|top|bottom] [--seed n] [-o out.mp4]`);
      }
      preflightFfmpeg();
      const { tmpdir } = await import("node:os");
      const { resolveLogo, buildLogoSting } = await import("./logoSting.js");
      const num = (k: string) => (flags[k] !== undefined ? Number(flags[k]) : undefined);
      console.log(`loading logo: ${arg} …`);
      const { data, slug } = await resolveLogo(arg, positional[1], {
        motion: flags.motion,
        energy: num("energy"),
        speed: num("speed"),
        intensity: num("intensity"),
        from: flags.from,
        seed: num("seed"),
      });
      const sceneIR = buildLogoSting(data);
      const tmp = join(tmpdir(), `reframe-logo-${slug}-${process.pid}.json`);
      await writeFile(tmp, JSON.stringify(sceneIR));
      const outBase = PACKAGED ? join(USER_CWD, "out") : join(ROOT, "out");
      const out = flags.o ? userPath(flags.o) : join(outBase, `logo-${slug}.mp4`);
      await mkdir(dirname(out), { recursive: true });
      console.log(`rendering ${data.name} (${data.paths.length} path${data.paths.length > 1 ? "s" : ""}, motion: ${data.motion ?? "reveal-orbit"}) → ${out}`);
      process.exit(
        await (PACKAGED
          ? run(process.execPath, [RENDER_CLI, "ir", tmp, "-o", out, "--no-audio"])
          : run("npx", ["tsx", RENDER_CLI, "ir", tmp, "-o", out, "--no-audio"])),
      );
    }

    case "batch": {
      const [sceneArg, dataArg, ...flags] = rest;
      if (!sceneArg || !dataArg) fail(`usage: ${CMD} batch <scene.ts> <data.json|csv> [...]`);
      const scenePath = userPath(sceneArg);
      const dataPath = userPath(dataArg);
      for (const p of [scenePath, dataPath]) if (!existsSync(p)) fail(`no such file: ${p}`);
      preflightFfmpeg();

      let outDir = PACKAGED ? join(USER_CWD, "out", "batch") : join(ROOT, "out", "batch");
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
      const { loadScene } = await import("./loadScene.js");
      const { readFile } = await import("node:fs/promises");
      const scene = await loadScene(scenePath);
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

    case "preview": {
      // the editor lists examples/scenes/ (repo) plus scenes found in the invoking dir
      if (PACKAGED) {
        const { createRequire } = await import("node:module");
        // vite's exports map blocks resolving bin/vite.js directly — locate it
        // via package.json (an always-exported subpath)
        const vitePkg = createRequire(import.meta.url).resolve("vite/package.json");
        const viteBin = join(dirname(vitePkg), "bin", "vite.js");
        process.exit(
          await run(process.execPath, [viteBin, join(ROOT, "preview")], {
            env: { REFRAME_SCENE_DIR: USER_CWD },
          }),
        );
      }
      process.exit(
        await run("pnpm", ["--filter", "@reframe/preview", "dev"], {
          env: { REFRAME_SCENE_DIR: USER_CWD },
        }),
      );
    }

    case "new": {
      const name = rest[0];
      if (!name) fail(`usage: ${CMD} new <scene-name>`);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
        fail(`scene name must be kebab-case (a-z, 0-9, -): got "${name}"`);
      }
      // Inside the repo, scenes go to the showcase dir; elsewhere a scene is
      // a standalone document — render/preview resolve @reframe/core for it.
      const inRepo = USER_CWD === ROOT || USER_CWD.startsWith(ROOT + "/");
      const targetDir = inRepo ? join(ROOT, "examples", "scenes") : USER_CWD;
      const target = join(targetDir, `${name}.ts`);
      const shown = inRepo ? `examples/scenes/${name}.ts` : `${name}.ts`;
      if (existsSync(target)) fail(`${shown} already exists`);
      const id = name.split("-")[0] ?? name;
      await writeFile(target, SCENE_TEMPLATE(name, id));
      console.log(`created ${shown}
  preview:  ${CMD} preview        (pick "${name}" in the dropdown)
  render:   ${CMD} render ${shown}
  syntax:   ${CMD} guide`);
      return;
    }

    case "motion": {
      const input = rest[0];
      if (!input) fail(`usage: ${CMD} motion <mp4|framesDir> [...args]`);
      preflightFfmpeg();
      process.exit(
        await (PACKAGED
          ? run(process.execPath, [ANALYZE, userPath(input), ...rest.slice(1)])
          : run("npx", ["tsx", ANALYZE, userPath(input), ...rest.slice(1)])),
      );
    }

    case "trace": {
      const input = rest[0];
      if (!input || input.startsWith("-")) fail(`usage: ${CMD} trace <ref.mp4> [--apply scene.ts] [-o out.json]`);
      preflightFfmpeg();
      // user-relative paths for the input, --apply scene, and -o
      const args = rest.slice(1).map((a, i) =>
        rest.slice(1)[i - 1] === "--apply" || rest.slice(1)[i - 1] === "-o" ? userPath(a) : a,
      );
      process.exit(
        await (PACKAGED
          ? run(process.execPath, [TRACE, userPath(input), ...args])
          : run("npx", ["tsx", TRACE, userPath(input), ...args])),
      );
    }

    case "guide": {
      const file = rest.includes("--regen")
        ? PACKAGED
          ? join(ROOT, "guides", "regen-contract.md")
          : join(ROOT, "docs", "regen-contract.md")
        : PACKAGED
          ? join(ROOT, "guides", "edsl-guide.md")
          : join(ROOT, "benchmark", "guides", "edsl-guide.md");
      const { readFile } = await import("node:fs/promises");
      process.stdout.write(await readFile(file, "utf8"));
      return;
    }

    case "demo":
      if (PACKAGED) {
        fail(
          "the edit-survival demo ships with the repo, not the package — git clone https://github.com/kiyeonjeon21/reframe && pnpm install && pnpm reframe demo",
        );
      }
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
