import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, type Page } from "playwright";
import type { SceneIR } from "@reframe/core";
import { fontFaceCss } from "./fonts.js";
import { VCLOCK_SOURCE } from "./vclock.js";
import "./reframeGlobal.js";

async function injectFonts(page: Page): Promise<void> {
  await page.addStyleTag({ content: await fontFaceCss() });
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((f) => f.load()));
    await document.fonts.ready;
  });
}

export interface CaptureResult {
  framesDir: string;
  frameCount: number;
  fps: number;
}

const framePath = (dir: string, i: number) => join(dir, `${String(i).padStart(5, "0")}.png`);

async function withPage<T>(
  size: { width: number; height: number },
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

let bundleCache: string | null = null;
async function browserBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const entry = join(dirname(fileURLToPath(import.meta.url)), "browserEntry.ts");
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2022",
  });
  bundleCache = result.outputFiles[0]!.text;
  return bundleCache;
}

/** Render a reframe IR scene: evaluate(t) per frame inside the page, pull PNGs out. */
export async function captureIr(
  ir: SceneIR,
  opts: { fps?: number; duration?: number; framesDir: string },
): Promise<CaptureResult> {
  await mkdir(opts.framesDir, { recursive: true });
  const bundle = await browserBundle();

  return withPage(ir.size, async (page) => {
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:#000"></body></html>`,
    );
    await injectFonts(page);
    await page.addScriptTag({ content: bundle });
    const info = await page.evaluate(
      (sceneIr) => window.__reframe.init(sceneIr as never),
      ir as unknown,
    );

    const fps = opts.fps ?? info.fps;
    const duration = opts.duration ?? info.duration;
    const frameCount = Math.max(1, Math.round(duration * fps));
    for (let f = 0; f < frameCount; f++) {
      const dataUrl = await page.evaluate((t) => window.__reframe.renderFrame(t), f / fps);
      await writeFile(framePath(opts.framesDir, f), Buffer.from(dataUrl.slice(22), "base64"));
    }
    return { framesDir: opts.framesDir, frameCount, fps };
  });
}

/**
 * Render an arbitrary HTML page deterministically: virtual-clock shim is
 * injected before any page script, then time advances exactly 1000/fps ms per
 * captured frame. Captures #stage when present, else the full viewport.
 */
export async function captureHtml(
  htmlPath: string,
  opts: {
    fps: number;
    duration: number;
    framesDir: string;
    width?: number;
    height?: number;
  },
): Promise<CaptureResult> {
  await mkdir(opts.framesDir, { recursive: true });
  const size = { width: opts.width ?? 1920, height: opts.height ?? 1080 };

  return withPage(size, async (page) => {
    await page.addInitScript(VCLOCK_SOURCE);
    await page.goto(pathToFileURL(htmlPath).href);
    await injectFonts(page);

    const stage = page.locator("#stage");
    const hasStage = (await stage.count()) > 0;
    const frameCount = Math.max(1, Math.round(opts.duration * opts.fps));

    for (let f = 0; f < frameCount; f++) {
      await page.evaluate(
        (ms) => (window as never as { __vclock: { advanceTo(ms: number): void } }).__vclock.advanceTo(ms),
        (f / opts.fps) * 1000,
      );
      const path = framePath(opts.framesDir, f);
      if (hasStage) await stage.screenshot({ path, animations: "allow" });
      else await page.screenshot({ path, animations: "allow" });
    }
    return { framesDir: opts.framesDir, frameCount, fps: opts.fps };
  });
}
