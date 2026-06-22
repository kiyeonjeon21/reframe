#!/usr/bin/env tsx
/**
 * `reframe assemble <media...> [-o name] [--title "…"] [--bgm <synth>] [--hold s]
 *  [--seed N]` — the "files → scene" path. Probe each image/video for its real
 * duration, then scaffold an editable scene `.ts` that wires `photoMontage`
 * (clip-aware holds, so a short clip never freezes) + an optional `title` + a
 * music bed. The emitted `.ts` is a normal deterministic scene (probed numbers
 * are baked in) — edit it, then `reframe render` it.
 */

import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { probeMedia } from "./media/probe.js";

const BGM_SYNTHS = ["ambient-pad", "lofi", "pulse", "tension", "uplift"];

interface Args {
  media: string[];
  out?: string;
  title?: string;
  bgm?: string;
  hold: number;
  seed: number;
}

function parseArgs(argv: string[]): Args {
  const media: string[] = [];
  const a: Args = { media, hold: 3.5, seed: 0 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => argv[++i] ?? fail(`${arg} needs a value`);
    if (arg === "-o" || arg === "--out") a.out = next();
    else if (arg === "--title") a.title = next();
    else if (arg === "--bgm") a.bgm = next();
    else if (arg === "--hold") a.hold = Number(next());
    else if (arg === "--seed") a.seed = Number(next());
    else if (arg.startsWith("-")) fail(`unknown flag "${arg}"`);
    else media.push(arg);
  }
  return a;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const CWD = process.env.INIT_CWD ?? process.cwd();
const userPath = (p: string) => (isAbsolute(p) ? p : resolve(CWD, p));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.media.length === 0) {
    fail("assemble needs at least one media file\nusage: reframe assemble <media...> [-o name] [--title \"…\"] [--bgm <synth>] [--hold s] [--seed N]");
  }
  if (args.bgm && !BGM_SYNTHS.includes(args.bgm)) fail(`unknown --bgm "${args.bgm}" — valid: ${BGM_SYNTHS.join(", ")}`);

  const outArg = (args.out ?? "media-story").replace(/\.ts$/, "");
  const outPath = userPath(`${outArg}.ts`);
  const name = basename(outPath, ".ts"); // the scene id (no directory)
  if (existsSync(outPath)) fail(`${outArg}.ts already exists`);
  const outDir = dirname(outPath);

  // probe each file → a montage shot (src is RELATIVE to the scene file so the
  // renderer resolves it; a video's hold is its real length, clamped).
  const shots: { src: string; hold: number; ken?: string; isVideo: boolean }[] = [];
  for (const m of args.media) {
    const abs = userPath(m);
    if (!existsSync(abs)) fail(`no such file: ${abs}`);
    const info = await probeMedia(abs);
    const rel = relative(outDir, abs) || basename(abs);
    const src = rel.split("\\").join("/"); // posix-style in the scene
    const hold = info.isVideo && info.duration ? Math.min(10, Math.max(0.5, info.duration)) : args.hold;
    const portrait = !!(info.width && info.height && info.height > info.width); // portrait → pan
    shots.push({ src, hold: Number(hold.toFixed(3)), isVideo: info.isVideo, ...(portrait ? { ken: "pan" } : {}) });
  }

  await writeFile(outPath, sceneSource(name, shots, args));
  const vids = shots.filter((s) => s.isVideo).length;
  console.log(`created ${name}.ts — ${shots.length} shots (${vids} video, ${shots.length - vids} image)`);
  console.log(`  next: reframe render ${name}.ts`);
}

function sceneSource(name: string, shots: { src: string; hold: number; ken?: string }[], args: Args): string {
  const imports = ["scene", "photoMontage", "seq", "par"];
  if (args.title) imports.push("title");
  const shotLines = shots
    .map((s) => `  { src: ${JSON.stringify(s.src)}, hold: ${s.hold}${s.ken ? `, ken: ${JSON.stringify(s.ken)}` : ""} },`)
    .join("\n");

  const titleBlock = args.title
    ? `\nconst ttl = title({ text: ${JSON.stringify(args.title)}, id: "ttl", x: W / 2, y: H / 2, fontSize: 110, entrance: "cascade", exit: "dissolve", hold: 1.6 });\n`
    : "";
  const nodes = args.title ? "[...m.nodes, ...ttl.nodes]" : "[...m.nodes]";
  const timeline = args.title ? "par(m.timeline, ttl.timeline)" : "seq(m.timeline)";
  const audio = args.bgm ? `\n  audio: { bgm: { synth: ${JSON.stringify(args.bgm)}, gain: 0.18, fadeIn: 1.2, fadeOut: 2 } },` : "";

  return `import { ${imports.join(", ")} } from "@reframe/core";

// Assembled by \`reframe assemble\`. Clip holds were probed from the media (baked
// in, so the render is deterministic). Edit freely — change order/holds, the
// title, swap a src; node ids \`shot-0\`, \`shot-1\`… and \`ttl-*\` are stable.
const W = 1920, H = 1080;

const m = photoMontage([
${shotLines}
], { id: "shot", size: { width: W, height: H }, transition: 0.6, seed: ${args.seed} });
${titleBlock}
export default scene({
  id: ${JSON.stringify(name)},
  size: { width: W, height: H },
  fps: 30,
  background: "#000000",
  nodes: ${nodes},
  timeline: ${timeline},${audio}
});
`;
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
