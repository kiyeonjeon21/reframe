#!/usr/bin/env tsx
/**
 * Bundle a scene + the canvas renderer into ONE self-contained HTML file that
 * plays the motion live in any browser (and pastes straight into a Claude.ai
 * Artifact). Same core + renderer the preview editor uses, driven by a rAF loop.
 *
 * Everything is inlined (the esbuild IIFE bundle + the Inter fonts as base64), so
 * the file needs no network, no server, no node_modules. Visual only: audio cues
 * and image-node sources are not embedded (those belong to the mp4 render path).
 *
 *   player <scene.ts|.json> <out.html>
 */
import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGED = process.env.REFRAME_PACKAGED === "1";
const HERE = dirname(fileURLToPath(import.meta.url));
// In the package both live next to this file in dist/; in the repo, alias to src.
const CORE = PACKAGED ? resolve(HERE, "index.js") : resolve(HERE, "..", "..", "core", "src", "index.ts");
const RENDERER = PACKAGED ? resolve(HERE, "renderer-canvas.js") : resolve(HERE, "..", "..", "renderer-canvas", "src", "index.ts");
const FONTS = PACKAGED ? resolve(HERE, "..", "assets", "fonts") : resolve(HERE, "..", "..", "..", "assets", "fonts");

async function fontFace(weight: number): Promise<string> {
  try {
    const b64 = (await readFile(resolve(FONTS, `inter-${weight}.woff2`))).toString("base64");
    return `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  } catch {
    return ""; // fall back to system font if the woff2 isn't where we expect
  }
}

async function main(): Promise<void> {
  const [scenePath, outPath] = process.argv.slice(2);
  if (!scenePath || !outPath) {
    console.error("usage: player <scene.ts|.json> <out.html>");
    process.exit(2);
  }

  // a tiny browser entry: compile once, then draw every frame to a <canvas>
  const entry = `
import { compileScene } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";
import sceneIR from ${JSON.stringify(scenePath)};
const compiled = compileScene(sceneIR);
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = sceneIR.size.width;
canvas.height = sceneIR.size.height;
const dur = compiled.duration || 1;
function frame(now){ renderFrame(ctx, compiled, (now / 1000) % dur); requestAnimationFrame(frame); }
const ff = document.fonts;
if (ff && ff.ready) ff.ready.then(() => requestAnimationFrame(frame));
else requestAnimationFrame(frame);
`;

  let bundle;
  try {
    bundle = await build({
      stdin: { contents: entry, resolveDir: dirname(scenePath), loader: "ts" },
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2022",
      write: false,
      logLevel: "silent",
      alias: { "@reframe/core": CORE, "@reframe/renderer-canvas": RENDERER, "reframe-video": CORE },
    });
  } catch (err) {
    console.error(`failed to bundle ${scenePath}:\n${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const js = bundle.outputFiles![0]!.text;
  const faces = (await Promise.all([400, 700, 800].map(fontFace))).join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${basename(scenePath)} · reframe</title>
<style>${faces}
html,body{margin:0;height:100%;background:#06070b;display:grid;place-items:center;font-family:Inter,system-ui}
canvas{max-width:94vw;max-height:94vh;border-radius:16px;box-shadow:0 24px 90px rgba(0,0,0,.55)}</style></head>
<body><canvas id="c"></canvas><script>${js}</script></body></html>`;

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  console.log(outPath);
}

void main();
