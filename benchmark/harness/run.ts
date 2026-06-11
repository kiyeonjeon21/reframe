/**
 * Non-LLM half of the benchmark loop. The orchestrating agent generates code
 * into runs/<runId>/attempt-N/, then calls:
 *
 *   tsx benchmark/harness/run.ts render <runDir>
 *
 * which renders the latest attempt, extracts stills + filmstrip, computes
 * objective metrics, and appends the outcome to <runDir>/run.json. On failure
 * it writes <runDir>/attempt-N/errors.txt (the repair-round input) and exits 1.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFilmstrip } from "@reframe/render-cli";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "packages", "render-cli", "src", "cli.ts");
const GSAP = join(ROOT, "benchmark", "vendor", "gsap.min.js");

interface Meta {
  runId: string;
  task: string;
  arm: "edsl" | "html";
  trial: number;
  duration: number;
  fps: number;
}

interface AttemptResult {
  round: number;
  renderOk: boolean;
  static: boolean;
  error: string | null;
}

async function latestAttempt(runDir: string): Promise<{ dir: string; round: number }> {
  const dirs = (await readdir(runDir)).filter((d) => d.startsWith("attempt-")).sort();
  if (dirs.length === 0) throw new Error(`no attempt-* dir in ${runDir}`);
  const dir = dirs[dirs.length - 1]!;
  return { dir: join(runDir, dir), round: Number(dir.split("-")[1]) };
}

function exec(cmd: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => (output += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (output += d.toString()));
    proc.on("close", (code) => res({ code: code ?? 1, output }));
  });
}

async function main() {
  const [command, runDirArg] = process.argv.slice(2);
  if (command !== "render" || !runDirArg) {
    console.error("usage: tsx benchmark/harness/run.ts render <runDir>");
    process.exit(2);
  }
  const runDir = resolve(runDirArg);
  const meta = JSON.parse(await readFile(join(runDir, "meta.json"), "utf8")) as Meta;
  const { dir: attemptDir, round } = await latestAttempt(runDir);

  const sceneFile = join(attemptDir, meta.arm === "edsl" ? "scene.ts" : "scene.html");
  if (!existsSync(sceneFile)) throw new Error(`missing ${sceneFile}`);

  if (meta.arm === "html") await cp(GSAP, join(attemptDir, "gsap.min.js"));

  const framesDir = join(runDir, "frames");
  await rm(framesDir, { recursive: true, force: true });
  const mp4 = join(runDir, "out.mp4");

  const args =
    meta.arm === "edsl"
      ? ["ir", sceneFile, "-o", mp4, "--fps", String(meta.fps), "--duration", String(meta.duration), "--frames-dir", framesDir]
      : ["html", sceneFile, "-o", mp4, "--fps", String(meta.fps), "--duration", String(meta.duration), "--frames-dir", framesDir];

  const { code, output } = await exec("npx", ["tsx", CLI, ...args]);

  const code_ = await readFile(sceneFile, "utf8");
  const objective = {
    loc: code_.split("\n").filter((l) => l.trim().length > 0).length,
    codeChars: code_.length,
  };

  let attempt: AttemptResult;
  if (code !== 0) {
    await writeFile(join(attemptDir, "errors.txt"), output);
    attempt = { round, renderOk: false, static: false, error: output.slice(-3000) };
  } else {
    // Static-clip heuristic: all frames byte-identical means the page's motion
    // escaped the virtual clock (e.g. CSS animations) or nothing animates.
    const frames = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
    const hashes = new Set<string>();
    for (const f of frames) {
      hashes.add(createHash("sha256").update(await readFile(join(framesDir, f))).digest("hex"));
    }
    const isStatic = hashes.size <= 1;

    const stillsDir = join(runDir, "stills");
    await mkdir(stillsDir, { recursive: true });
    const last = frames.length - 1;
    const picks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(last * p));
    await Promise.all(
      picks.map((idx, i) => cp(join(framesDir, frames[idx]!), join(stillsDir, `s${i}.png`))),
    );
    await extractFilmstrip(mp4, join(runDir, "strip.png"), { frameCount: frames.length });

    attempt = { round, renderOk: true, static: isStatic, error: null };
  }
  await rm(framesDir, { recursive: true, force: true });

  const runJsonPath = join(runDir, "run.json");
  const runJson = existsSync(runJsonPath)
    ? (JSON.parse(await readFile(runJsonPath, "utf8")) as Record<string, unknown>)
    : { ...meta, attempts: [] };
  (runJson.attempts as AttemptResult[]).push(attempt);
  runJson.objective = objective;
  await writeFile(runJsonPath, JSON.stringify(runJson, null, 2));

  if (!attempt.renderOk) {
    console.error(`render FAILED (round ${round}) — errors.txt written`);
    process.exit(1);
  }
  console.log(`render ok (round ${round})${attempt.static ? " [WARNING: static clip]" : ""}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
