#!/usr/bin/env tsx
/**
 * `reframe narrate <scene.ts|.json> [--voice <name>] [--lang a] [--max-speed 1.3]
 *  [--script <path>] [--dry-run]` — scene-fitted Kokoro voiceover.
 *
 * Reads a narration script (a sibling `<scene>-vo/script.json` of `{ at, text }`
 * lines the scene imports into `audio.narration`), computes each line's time slot
 * from the compiled label clock, synthesizes it with a Kokoro python sidecar, and
 * AUTO-FITS its speech rate so it fits the slot (bounded; warns if even the max
 * speed overruns). Bakes `file` / `voice` / `speed` / `duration` back into the
 * script.json — the scene then plays each line as a label-anchored `file` cue that
 * survives retiming/regen, with the bed ducking under the whole utterance.
 *
 * Determinism: the .wav are external assets (same-machine, Kokoro-version
 * dependent), not part of the golden contract — commit script.json + wavs together.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileScene } from "@reframe/core";
import { loadScene } from "./loadScene.js";

const NARRATE_PY = fileURLToPath(new URL("./narrate.py", import.meta.url));
const CWD = process.env.INIT_CWD ?? process.cwd();
const userPath = (p: string) => (isAbsolute(p) ? p : resolve(CWD, p));

interface Line {
  at: string | number;
  text: string;
  voice?: string;
  gain?: number;
  offset?: number;
  file?: string;
  speed?: number;
  duration?: number;
}

interface Args {
  scene?: string;
  voice: string;
  lang: string;
  maxSpeed: number;
  script?: string;
  dryRun: boolean;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { voice: "af_heart", lang: "a", maxSpeed: 1.3, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => argv[++i] ?? fail(`${arg} needs a value`);
    if (arg === "--voice") a.voice = next();
    else if (arg === "--lang") a.lang = next();
    else if (arg === "--max-speed") a.maxSpeed = Number(next());
    else if (arg === "--script") a.script = next();
    else if (arg === "--dry-run") a.dryRun = true;
    else if (arg.startsWith("-")) fail(`unknown flag "${arg}"`);
    else if (!a.scene) a.scene = arg;
    else fail(`unexpected argument "${arg}"`);
  }
  return a;
}

const slug = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "line";
const stemOf = (line: Line, i: number) => (typeof line.at === "string" ? slug(line.at) : `line${i}`);
const posix = (p: string) => p.split("\\").join("/");
// ~2.6 words/sec is a typical narration pace — a rough length estimate for --dry-run.
const estimateSecs = (text: string) => Math.max(0.4, text.trim().split(/\s+/).length / 2.6);

/** Run narrate.py with a JSON request on stdin, parse the JSON result. */
function synth(req: unknown): Promise<{ durations?: Record<string, number>; error?: string }> {
  return new Promise((res, rej) => {
    const proc = spawn("python3", [NARRATE_PY], { stdio: ["pipe", "pipe", "inherit"] });
    let stdout = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.on("error", rej); // ENOENT — python3 missing
    proc.on("close", (code) => {
      try {
        res(JSON.parse(stdout.trim().split("\n").pop() ?? "{}"));
      } catch {
        rej(new Error(`narrate.py produced no JSON (exit ${code})`));
      }
    });
    proc.stdin.write(JSON.stringify(req));
    proc.stdin.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scene) {
    fail('narrate needs a scene file\nusage: reframe narrate <scene.ts|.json> [--voice <name>] [--lang a] [--max-speed 1.3] [--script <path>] [--dry-run]');
  }
  const scenePath = userPath(args.scene);
  if (!existsSync(scenePath)) fail(`no such file: ${scenePath}`);

  // the label clock — every line's slot is a window in the scene's own timeline
  const scene = await loadScene(scenePath);
  const compiled = compileScene(scene);
  const duration = compiled.duration;

  const sceneDir = dirname(scenePath);
  const sceneBase = basename(scenePath).replace(/\.(ts|json)$/, "");
  const scriptPath = args.script ? userPath(args.script) : join(sceneDir, `${sceneBase}-vo`, "script.json");
  if (!existsSync(scriptPath)) {
    fail(
      `no narration script at ${scriptPath}\n` +
        `create it as a JSON array and import it into your scene's audio.narration, e.g.:\n` +
        `  [ { "at": "<label>", "text": "Your line." } ]`,
    );
  }
  const voDir = dirname(scriptPath);
  const voBase = posix(relative(sceneDir, voDir)); // e.g. "demo-vo"

  const lines: Line[] = JSON.parse(await readFile(scriptPath, "utf8"));
  if (!Array.isArray(lines) || lines.length === 0) fail(`${scriptPath}: expected a non-empty JSON array of narration lines`);

  // resolve each line's anchor (label start + offset) and its slot (gap to the
  // next line, or to the scene end for the last line)
  const resolved = lines.map((line, i) => {
    let anchor: number;
    if (typeof line.at === "number") anchor = line.at;
    else {
      const span = compiled.labelTimes.get(line.at);
      if (!span) fail(`line ${i}: unknown timeline label "${line.at}" (run \`reframe labels ${args.scene}\`)`);
      anchor = span.t0;
    }
    return { line, i, stem: stemOf(line, i), anchor: Math.max(0, anchor + (line.offset ?? 0)) };
  });
  // slot = gap from this line's anchor to the next line's (last → scene end)
  const order = [...resolved].sort((a, b) => a.anchor - b.anchor);
  const slots = new Map<number, number>();
  for (let k = 0; k < order.length; k++) {
    const start = order[k]!.anchor;
    const end = k + 1 < order.length ? order[k + 1]!.anchor : duration;
    slots.set(order[k]!.i, Math.max(0.1, end - start));
  }
  const slotOf = (i: number) => slots.get(i)!;

  const rows: { stem: string; at: string; slot: number; text: string; len: number; speed: number; warn?: string }[] = [];

  if (args.dryRun) {
    for (const r of resolved) {
      const len = estimateSecs(r.line.text);
      const slot = slotOf(r.i);
      const speed = Math.min(args.maxSpeed, Math.max(1, len / slot));
      const fitted = len / speed;
      rows.push({ stem: r.stem, at: String(r.line.at), slot, text: r.line.text, len: fitted, speed, ...(fitted > slot + 0.05 ? { warn: "overruns" } : {}) });
    }
    printTable(rows, true);
    console.log(`\n(dry run — estimates only, no synthesis. drop --dry-run to generate.)`);
    return;
  }

  await mkdir(voDir, { recursive: true });

  // PASS 1 — synth every line at natural speed, measure
  const pass1 = await synth({ outDir: voDir, lang: args.lang, lines: resolved.map((r) => ({ stem: r.stem, text: r.line.text, voice: r.line.voice ?? args.voice, speed: 1 })) });
  if (pass1.error) fail(pass1.error);
  const dur1 = pass1.durations!;

  // PASS 2 — re-synth only the lines that overrun their slot, sped up to fit
  const refit = resolved
    .map((r) => ({ r, speed: Math.min(args.maxSpeed, Math.max(1, +(dur1[r.stem]! / slotOf(r.i)).toFixed(3))) }))
    .filter(({ speed }) => speed > 1.001);
  let dur2: Record<string, number> = {};
  if (refit.length > 0) {
    const p2 = await synth({ outDir: voDir, lang: args.lang, lines: refit.map(({ r, speed }) => ({ stem: r.stem, text: r.line.text, voice: r.line.voice ?? args.voice, speed })) });
    if (p2.error) fail(p2.error);
    dur2 = p2.durations!;
  }
  const speedFor = new Map(refit.map(({ r, speed }) => [r.stem, speed]));

  // bake file / voice / speed / duration back into each line
  for (const r of resolved) {
    const speed = speedFor.get(r.stem) ?? 1;
    const len = (speed > 1 ? dur2[r.stem] : dur1[r.stem]) ?? dur1[r.stem]!;
    const slot = slotOf(r.i);
    r.line.file = posix(join(voBase, `${r.stem}.wav`));
    r.line.voice = r.line.voice ?? args.voice;
    if (speed > 1) r.line.speed = speed; else delete r.line.speed;
    r.line.duration = +len.toFixed(3);
    rows.push({ stem: r.stem, at: String(r.line.at), slot, text: r.line.text, len, speed, ...(len > slot + 0.05 ? { warn: "overruns" } : {}) });
  }

  await writeFile(scriptPath, JSON.stringify(lines, null, 2) + "\n");
  printTable(rows.sort((a, b) => Number(a.warn ? 1 : 0) - Number(b.warn ? 1 : 0)), false);
  const warned = rows.filter((r) => r.warn).length;
  console.log(`\nwrote ${resolved.length} wav → ${voBase}/  ·  baked ${basename(scriptPath)}`);
  if (warned > 0) console.log(`⚠ ${warned} line(s) overrun their slot even at ${args.maxSpeed}× — shorten the text or retime the beat.`);
  console.log(`  next: reframe render ${args.scene}`);
}

function printTable(rows: { at: string; slot: number; text: string; len: number; speed: number; warn?: string }[], dry: boolean) {
  console.log(`# narration ${dry ? "(estimated)" : "fit"} — label · slot · length · speed`);
  for (const r of rows) {
    const mark = r.warn ? "⚠" : "✓";
    const sp = r.speed > 1.001 ? `${r.speed.toFixed(2)}×` : "1.0×";
    const text = r.text.length > 40 ? r.text.slice(0, 37) + "…" : r.text;
    console.log(`${mark} ${r.at.padEnd(16)} slot ${r.slot.toFixed(2)}s  len ${r.len.toFixed(2)}s  ${sp.padStart(5)}  ${JSON.stringify(text)}`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ENOENT/.test(msg)) {
    fail("python3 not found on PATH — install Python 3, then: pip install kokoro && (macOS) brew install espeak-ng");
  }
  fail(msg);
});
