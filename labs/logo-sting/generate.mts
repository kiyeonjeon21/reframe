#!/usr/bin/env tsx
/**
 * Logo → sting: one command, your logo as a share-worthy animated reveal.
 *
 *   npx tsx labs/logo-sting/generate.mts <logo.svg | brand-slug> ["Display Name"] \
 *       [--motion <preset>] [--energy 0..1] [--speed n] [--intensity 0..1] \
 *       [--from left|right|top|bottom] [--seed n]
 *
 * Pass a local SVG file, or a brand slug to pull from simple-icons
 * (e.g. `react`, `figma`, `vercel`). The motion is chosen from the vocabulary
 * (--motion: draw-bloom | punch-in | rise-settle | slide-bank | reveal-orbit |
 * spin-forge; default reveal-orbit). A different --seed varies it within the
 * preset family. Output: out/logo-<slug>.mp4. Orchestrator only — no
 * @reframe/core import (the render step resolves it).
 *
 * v1 parses <path> elements (the common case). Transforms, <polygon>/<circle>
 * and CSS styling are not yet applied.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

function exec(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "inherit", "pipe"] });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}: ${err.slice(-400)}`))));
  });
}

const titleCase = (s: string) =>
  s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

async function loadSvg(arg: string): Promise<{ svg: string; name: string }> {
  if (existsSync(arg)) {
    const svg = await readFile(arg, "utf8");
    return { svg, name: arg.split("/").pop()!.replace(/\.svg$/i, "") };
  }
  const slug = arg.toLowerCase().replace(/[^a-z0-9]/g, "");
  const r = await fetch(`https://cdn.simpleicons.org/${slug}`);
  if (!r.ok) throw new Error(`no local file "${arg}", and simple-icons has no "${slug}" (${r.status})`);
  return { svg: await r.text(), name: arg };
}

interface Parsed {
  paths: { d: string; fill: string }[];
  viewBox: { minX: number; minY: number; w: number; h: number };
}

/** Is a hex colour too dark to read on the near-black background? */
function tooDark(hex: string): boolean {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 40; // perceived luma
}

function parseSvg(svg: string): Parsed {
  let viewBox = { minX: 0, minY: 0, w: 100, h: 100 };
  const vb = svg.match(/viewBox\s*=\s*"([\d.\-\s]+)"/i);
  if (vb) {
    const [a, b, c, d] = vb[1]!.trim().split(/\s+/).map(Number);
    viewBox = { minX: a!, minY: b!, w: c!, h: d! };
  } else {
    const w = svg.match(/\bwidth\s*=\s*"([\d.]+)/i);
    const h = svg.match(/\bheight\s*=\s*"([\d.]+)/i);
    if (w && h) viewBox = { minX: 0, minY: 0, w: +w[1]!, h: +h[1]! };
  }
  const rootFill = svg.match(/<svg[^>]*\bfill\s*=\s*"(#[0-9a-fA-F]{3,8})"/)?.[1];
  const fallback = rootFill && !tooDark(rootFill) ? rootFill : "#E6EDF3";

  const paths: { d: string; fill: string }[] = [];
  const re = /<path\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const tag = m[0];
    const d = tag.match(/\bd\s*=\s*"([^"]+)"/)?.[1];
    if (!d) continue;
    let fill = tag.match(/\bfill\s*=\s*"(#[0-9a-fA-F]{3,8})"/)?.[1] ?? fallback;
    if (tooDark(fill)) fill = fallback; // never invisible on the dark stage
    paths.push({ d, fill });
  }
  return { paths, viewBox };
}

const MOTIONS = ["draw-bloom", "punch-in", "rise-settle", "slide-bank", "reveal-orbit", "spin-forge"];

/** Split argv into positionals and --key value flags. */
function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) flags[a.slice(2)] = argv[++i] ?? "";
    else positional.push(a);
  }
  return { positional, flags };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const arg = positional[0];
  if (!arg) {
    console.error('usage: npx tsx labs/logo-sting/generate.mts <logo.svg | brand-slug> ["Display Name"] [--motion <preset>] [--energy 0..1] [--speed n] [--intensity 0..1] [--from left|right|top|bottom] [--seed n]');
    process.exit(2);
  }
  if (flags.motion && !MOTIONS.includes(flags.motion)) {
    throw new Error(`unknown --motion "${flags.motion}". options: ${MOTIONS.join(", ")}`);
  }
  console.log(`loading logo: ${arg} …`);
  const { svg, name } = await loadSvg(arg);
  const { paths, viewBox } = parseSvg(svg);
  if (paths.length === 0) {
    throw new Error("no <path> elements found — v1 supports path-based SVG logos");
  }
  const num = (k: string) => (flags[k] !== undefined ? Number(flags[k]) : undefined);
  const data = {
    name: positional[1] ?? titleCase(name),
    paths,
    viewBox,
    ...(flags.motion && { motion: flags.motion }),
    ...(num("energy") !== undefined && { energy: num("energy") }),
    ...(num("speed") !== undefined && { speed: num("speed") }),
    ...(num("intensity") !== undefined && { intensity: num("intensity") }),
    ...(flags.from && { from: flags.from }),
    ...(num("seed") !== undefined && { seed: num("seed") }),
  };

  const genPath = join(HERE, "_gen.ts");
  await writeFile(
    genPath,
    `import { buildLogoSting } from "./template.js";\nexport default buildLogoSting(${JSON.stringify(data)});\n`,
  );
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const out = join(ROOT, "out", `logo-${slug}.mp4`);
  console.log(`rendering → out/logo-${slug}.mp4  (${paths.length} path${paths.length > 1 ? "s" : ""}, motion: ${flags.motion ?? "reveal-orbit"})`);
  await exec("npx", ["tsx", join(ROOT, "packages", "render-cli", "src", "reframe.ts"), "render", genPath, "-o", out, "--no-audio"]);
  console.log(`\n✓ out/logo-${slug}.mp4 — post it, tag @reframe`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
