#!/usr/bin/env tsx
/**
 * reframe diff <ref-image> [<scene.ts>] [--t <sec>] [--mode side|blend|diff|grid] [-o out.png]
 *
 * The reference-matching tool: render a scene's frame at time `t` and composite it
 * against a reference image so an agent can iterate toward a faithful match instead
 * of eyeballing. Modes:
 *   side  — reference | render, side by side (default)
 *   blend — render over the reference at 50% (spot drift)
 *   diff  — absolute pixel difference (bright where they disagree)
 *   grid  — a labelled 100px coordinate grid over the reference ALONE (no scene
 *           needed) — to MEASURE a screenshot before any render exists
 * Writes one PNG. The loop: `diff ref --mode grid` (measure) → write the scene →
 * `diff ref scene.ts --mode side` (compare) → fix → repeat.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadModule } from "./loadScene.js";
import { renderFrameAt } from "./frameLoop.js";

export type Mode = "side" | "blend" | "diff" | "grid";
const MODES: Mode[] = ["side", "blend", "diff", "grid"];

export const dataUrl = (buf: Buffer, ext: string): string =>
  `data:image/${ext === ".jpg" || ext === ".jpeg" ? "jpeg" : ext === ".webp" ? "webp" : "png"};base64,${buf.toString("base64")}`;

export async function composite(refUrl: string, renderUrl: string | null, mode: Mode, outPath: string): Promise<void> {
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    // tsx/esbuild keepNames wraps inner functions with __name(); shim it in the page
    // (string form, so this line itself isn't transformed) before the evaluate below.
    await page.evaluate("globalThis.__name = globalThis.__name || ((f) => f)");
    const png = await page.evaluate(
      async ([ref, render, m]) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = rej;
            im.src = src;
          });
        const refImg = await load(ref!);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const tag = (s: string, x: number, y: number) => {
          ctx.save();
          ctx.font = "600 18px sans-serif";
          const w = ctx.measureText(s).width + 16;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x, y, w, 28);
          ctx.fillStyle = "#fff";
          ctx.fillText(s, x + 8, y + 20);
          ctx.restore();
        };
        if (m === "grid") {
          canvas.width = refImg.width;
          canvas.height = refImg.height;
          ctx.drawImage(refImg, 0, 0);
          ctx.save();
          ctx.font = "14px sans-serif";
          ctx.lineWidth = 1;
          for (let x = 0; x <= canvas.width; x += 100) {
            ctx.strokeStyle = x % 500 === 0 ? "rgba(255,90,90,0.85)" : "rgba(255,90,90,0.4)";
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
            ctx.fillStyle = "rgba(255,150,150,0.95)";
            ctx.fillText(String(x), x + 3, 15);
          }
          for (let y = 0; y <= canvas.height; y += 100) {
            ctx.strokeStyle = y % 500 === 0 ? "rgba(255,90,90,0.85)" : "rgba(255,90,90,0.4)";
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            ctx.fillStyle = "rgba(255,150,150,0.95)";
            ctx.fillText(String(y), 3, y + 15);
          }
          ctx.restore();
        } else {
          const rImg = render ? await load(render) : null;
          if (m === "side") {
            const H = Math.min(refImg.height, rImg ? rImg.height : refImg.height, 1000);
            const rw = refImg.width * (H / refImg.height);
            const rrw = rImg ? rImg.width * (H / rImg.height) : 0;
            const gap = rImg ? 24 : 0;
            canvas.width = Math.round(rw + (rImg ? gap + rrw : 0));
            canvas.height = Math.round(H);
            ctx.fillStyle = "#0a0a0a";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(refImg, 0, 0, rw, H);
            if (rImg) ctx.drawImage(rImg, rw + gap, 0, rrw, H);
            tag("reference", 10, 10);
            if (rImg) tag("render", Math.round(rw + gap) + 10, 10);
          } else {
            // blend / diff: overlay render onto reference at the reference's size
            canvas.width = refImg.width;
            canvas.height = refImg.height;
            ctx.drawImage(refImg, 0, 0);
            if (rImg) {
              ctx.globalAlpha = m === "blend" ? 0.5 : 1;
              ctx.globalCompositeOperation = m === "diff" ? "difference" : "source-over";
              ctx.drawImage(rImg, 0, 0, canvas.width, canvas.height);
              ctx.globalAlpha = 1;
              ctx.globalCompositeOperation = "source-over";
            }
            tag(m, 10, 10);
          }
        }
        return canvas.toDataURL("image/png");
      },
      [refUrl, renderUrl, mode] as const,
    );
    await writeFile(outPath, Buffer.from(png.slice(22), "base64"));
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const ref = argv[0];
  if (!ref || ref.startsWith("-")) {
    console.error("usage: reframe diff <ref-image> [<scene.ts>] [--t <sec>] [--mode side|blend|diff|grid] [-o out.png]");
    process.exit(2);
  }
  let scene: string | undefined;
  let t = 0;
  let mode: Mode = "side";
  let out = "";
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--t") t = Number(argv[++i]);
    else if (a === "--mode") mode = argv[++i] as Mode;
    else if (a === "-o") out = argv[++i]!;
    else if (!a.startsWith("-") && !scene) scene = a;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!MODES.includes(mode)) {
    console.error(`unknown --mode "${mode}" — use ${MODES.join(", ")}`);
    process.exit(2);
  }
  const refPath = resolve(ref);
  const refUrl = dataUrl(await readFile(refPath), extname(refPath).toLowerCase());

  let renderUrl: string | null = null;
  if (mode !== "grid") {
    if (!scene) {
      console.error(`--mode ${mode} needs a scene file (only --mode grid works on the reference alone)`);
      process.exit(2);
    }
    const scenePath = resolve(scene);
    const loaded = await loadModule(scenePath);
    if (loaded.kind !== "scene") {
      console.error("diff needs a single scene (not a composition)");
      process.exit(2);
    }
    const buf = await renderFrameAt(loaded.ir, t, { sceneDir: dirname(scenePath) });
    renderUrl = dataUrl(buf, ".png");
  }

  const outPath = out ? resolve(out) : resolve(`diff-${mode}.png`);
  await composite(refUrl, renderUrl, mode, outPath);
  console.log(outPath);
}

// run only when invoked directly (not when imported by a test)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
