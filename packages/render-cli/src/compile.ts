#!/usr/bin/env tsx
/**
 * `reframe compile <scene.ts|.json>` — bundle + evaluate the eDSL source and
 * emit the validated SceneIR JSON, WITHOUT rendering (no ffmpeg / chromium).
 * The fast path for a consumer that needs the IR for a canvas preview, a
 * semantic-diff loop, or an agentic self-correction loop.
 *
 *   reframe compile scene.ts                 # JSON to stdout
 *   reframe compile scene.ts -o scene.json   # JSON to a file
 *   reframe compile --stdin                  # source on stdin
 *   reframe compile --code "<src>"           # source as an arg
 *   reframe compile scene.ts --json          # on failure: { ok:false, error, kind }
 *
 * On bundle / eval / validation failure: exit non-zero with a concise message
 * (never the base64 bundle). With --json the failure is structured.
 */
import { writeFile } from "node:fs/promises";
import type { SceneIR } from "@reframe/core";
import { loadScene, loadSceneFromCode, SceneLoadError } from "./loadScene.js";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i !== -1 ? args[i + 1] : undefined;
};
const jsonMode = flag("--json");

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => {
      const t = setTimeout(() => rej(new SceneLoadError("eval", `compile timed out after ${ms}ms`)), ms);
      t.unref();
    }),
  ]);
}

async function main() {
  const out = opt("-o");
  const timeoutMs = Number(opt("--timeout") ?? 8000);
  const code = opt("--code");
  // positional file = a non-flag arg that is not the value of -o/--code/--timeout
  const input = args.find((a, i) => !a.startsWith("-") && !["-o", "--code", "--timeout"].includes(args[i - 1] ?? ""));

  const load: Promise<SceneIR> =
    code !== undefined
      ? loadSceneFromCode(code)
      : flag("--stdin")
        ? readStdin().then((src) => loadSceneFromCode(src))
        : input
          ? loadScene(input)
          : Promise.reject(new SceneLoadError("eval", 'compile needs a scene file, --stdin, or --code "<src>"'));

  const ir = await withTimeout(load, timeoutMs);
  const text = JSON.stringify(ir);
  if (out) await writeFile(out, `${text}\n`);
  else process.stdout.write(`${text}\n`);
}

main().catch((err: unknown) => {
  const kind = err instanceof SceneLoadError ? err.kind : "eval";
  const issues = err instanceof SceneLoadError ? err.issues : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (jsonMode) process.stdout.write(`${JSON.stringify({ ok: false, error: message, kind, ...(issues && { issues }) })}\n`);
  else console.error(`error: ${message}`);
  process.exit(1);
});
