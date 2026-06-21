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
 *   player <scene.ts|.json> [--overlay <doc.json>]... <out.html>
 *   player <scene.ts|.json> --edit [--t <sec>] [--edit-origin <origin>] <out.html>
 *
 * `--edit` builds an EMBEDDED-EDITOR build: no autoplay, seek-driven, with
 * `window.__reframe = { seek, hitTest, bounds, waypoints, setOverlay, play, pause }`
 * and a host↔iframe postMessage channel. `setOverlay(doc)` re-composes + re-renders
 * IN-BROWSER (no reload) — the live overlay-preview loop for an embedded editor.
 */
import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { OverlayDoc } from "@reframe/core";
import { formatComposeReport } from "@reframe/core";
import { loadModule } from "./loadScene.js";
import { applyOverlays } from "./overlay.js";

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

/** The default build: compile once, autoplay every frame to a <canvas> (byte-identical to before). */
function playEntry(sceneSource: string): string {
  return `
import { compileScene } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";
${sceneSource}
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
}

/**
 * The `--edit` build: no autoplay; seek-driven; exposes `window.__reframe` + a
 * postMessage channel. `setOverlay(doc)` re-composes onto the base IR and re-renders
 * in-browser (no reload). Hit-test / bounds / waypoints come from the core spatial
 * query at the current time. `baseIR`/`initialDocs`/`t0`/`origin` are inlined literals.
 */
function editEntry(baseIRJson: string, initialDocsJson: string, t0: number, originJson: string): string {
  return `
import { compileScene, composeScene, sceneGeometry, hitTest } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";
const baseIR = ${baseIRJson};
const initialDocs = ${initialDocsJson};
const ORIGIN = ${originJson};
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = baseIR.size.width;
canvas.height = baseIR.size.height;
const composeAll = (docs) => docs.reduce((ir, d) => composeScene(ir, d).ir, baseIR);
let compiled = compileScene(initialDocs.length ? composeAll(initialDocs) : baseIR);
let t = ${Number.isFinite(t0) ? t0 : 0};
let raf = 0;
const draw = () => renderFrame(ctx, compiled, t);
const geo = () => sceneGeometry(compiled, t);
const post = (msg) => { try { parent && parent.postMessage(msg, ORIGIN); } catch (e) {} };
const api = {
  size: { width: baseIR.size.width, height: baseIR.size.height },
  get time(){ return t; },
  seek(nt){ t = +nt || 0; if (!raf) draw(); },
  play(){ if (raf) return; const dur = compiled.duration || 1; const start = performance.now() - t * 1000;
    const loop = (now) => { t = ((now - start) / 1000) % dur; draw(); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); },
  pause(){ if (raf) { cancelAnimationFrame(raf); raf = 0; } },
  setOverlay(doc){ compiled = compileScene(doc ? composeScene(baseIR, doc).ir : baseIR); draw(); return true; },
  hitTest(x, y){ return hitTest(geo(), x, y); },
  bounds(){ const g = geo(); return { nodes: g.nodes.map((n) => ({ id: n.id, bounds: n.bounds })), groups: g.groups, waypoints: g.waypoints }; },
  waypoints(){ return geo().waypoints; },
  geometry(){ return geo(); },
};
window.__reframe = api;
addEventListener("message", (e) => {
  if (ORIGIN !== "*" && e.origin !== ORIGIN) return;
  const m = e.data; if (!m || typeof m !== "object") return;
  switch (m.type) {
    case "seek": api.seek(m.t); break;
    case "setOverlay": api.setOverlay(m.doc); break;
    case "play": api.play(); break;
    case "pause": api.pause(); break;
    case "hitTest": post({ type: "pick", nodeId: api.hitTest(m.x, m.y), sceneXY: [+m.x || 0, +m.y || 0] }); break;
    case "bounds": post(Object.assign({ type: "bounds", t }, api.bounds())); break;
  }
});
const ff = document.fonts;
if (ff && ff.ready) ff.ready.then(draw); else draw();
post({ type: "ready", size: api.size });
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const overlays: string[] = [];
  const positional: string[] = [];
  let edit = false;
  let editOrigin = "*";
  let initialT = 0;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--overlay") overlays.push(resolve(argv[++i]!));
    else if (a === "--edit") edit = true;
    else if (a === "--edit-origin") editOrigin = argv[++i]!;
    else if (a === "--t") initialT = Number(argv[++i]);
    else positional.push(a);
  }
  const [scenePath, outPath] = positional;
  if (!scenePath || !outPath) {
    console.error("usage: player <scene.ts|.json> [--overlay <doc.json>]... [--edit [--t <sec>]] <out.html>");
    process.exit(2);
  }

  let entry: string;
  if (edit) {
    // EMBEDDED-EDITOR build: inline the base IR (for live re-compose) + any initial overlays.
    const loaded = await loadModule(scenePath);
    if (loaded.kind !== "scene") {
      console.error("player --edit needs a single scene (not a composition)");
      process.exit(2);
    }
    const docs = await Promise.all(overlays.map(async (p) => JSON.parse(await readFile(p, "utf8")) as OverlayDoc));
    entry = editEntry(JSON.stringify(loaded.ir), JSON.stringify(docs), initialT, JSON.stringify(editOrigin));
  } else {
    // default build: import the scene file, or inline the composed IR when --overlay is given
    let sceneSource = `import sceneIR from ${JSON.stringify(scenePath)};`;
    if (overlays.length > 0) {
      const loaded = await loadModule(scenePath);
      if (loaded.kind !== "scene") {
        console.error("player needs a single scene (not a composition)");
        process.exit(2);
      }
      const composed = await applyOverlays(loaded.ir, overlays);
      console.error(formatComposeReport(composed.report));
      sceneSource = `const sceneIR = ${JSON.stringify(composed.ir)};`;
    }
    entry = playEntry(sceneSource);
  }

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
