import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium, type Page } from "playwright";
import type { SceneIR } from "@reframe/core";
import { fontFaceCss } from "./fonts.js";
import { buildImageAssets } from "./images.js";
import { buildVideoFrameAssets, resolveTiming } from "./videos.js";
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
  opts: { deviceScaleFactor?: number } = {},
): Promise<T> {
  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
  });
  try {
    // deviceScaleFactor N renders the page at N× physical pixels (supersampling);
    // the captured PNG comes out N×-sized and is downscaled to `size` at encode/write.
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: opts.deviceScaleFactor ?? 1 });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/** Lanczos-downscale a PNG buffer to `width`×`height` via ffmpeg (for supersampled single frames). */
export function downscalePng(png: Buffer, width: number, height: number): Buffer {
  const res = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", "pipe:0",
      "-vf", `scale=${width}:${height}:flags=lanczos`, "-f", "image2pipe", "-c:v", "png", "pipe:1"],
    { input: png, maxBuffer: 512 * 1024 * 1024 },
  );
  if (res.status !== 0) {
    throw new Error(`ffmpeg downscale failed: ${res.stderr?.toString() ?? res.error?.message ?? "unknown"}`);
  }
  return res.stdout;
}

let bundleCache: string | null = null;
async function browserBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  if (process.env.REFRAME_PACKAGED === "1") {
    // the package build prebundles browserEntry next to dist/cli.js
    const { readFile } = await import("node:fs/promises");
    bundleCache = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), "browserEntry.js"),
      "utf8",
    );
    return bundleCache;
  }
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
  opts: { fps?: number; duration?: number; framesDir: string; sceneDir?: string; supersample?: number },
): Promise<CaptureResult> {
  await mkdir(opts.framesDir, { recursive: true });
  const sceneDir = opts.sceneDir ?? process.cwd();
  // resolve + read image/video assets BEFORE the browser launches — a missing
  // file fails here with the tried paths, not as an opaque page error
  const assets = await buildImageAssets(ir, sceneDir);
  const { fps, duration } = resolveTiming(ir, opts);
  const videoAssets = await buildVideoFrameAssets(ir, sceneDir, fps, duration);
  const bundle = await browserBundle();

  return withPage(ir.size, async (page) => {
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:#000"></body></html>`,
    );
    await injectFonts(page);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(
      ([sceneIr, imageAssets, vAssets]) =>
        window.__reframe.init(sceneIr as never, imageAssets as never, vAssets as never),
      [ir, assets, videoAssets] as unknown[],
    );

    const frameCount = Math.max(1, Math.round(duration * fps));
    for (let f = 0; f < frameCount; f++) {
      const dataUrl = await page.evaluate((t) => window.__reframe.renderFrame(t), f / fps);
      await writeFile(framePath(opts.framesDir, f), Buffer.from(dataUrl.slice(22), "base64"));
    }
    return { framesDir: opts.framesDir, frameCount, fps };
  }, opts.supersample !== undefined ? { deviceScaleFactor: opts.supersample } : {});
}

/** Render ONE frame of an IR scene at scene-time `t` → PNG buffer (for the `diff` tool). */
export async function renderFrameAt(ir: SceneIR, t: number, opts: { sceneDir?: string; supersample?: number } = {}): Promise<Buffer> {
  const sceneDir = opts.sceneDir ?? process.cwd();
  const assets = await buildImageAssets(ir, sceneDir);
  const { fps, duration } = resolveTiming(ir, {});
  const videoAssets = await buildVideoFrameAssets(ir, sceneDir, fps, duration);
  const bundle = await browserBundle();
  return withPage(ir.size, async (page) => {
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#000"></body></html>`);
    await injectFonts(page);
    await page.addScriptTag({ content: bundle });
    await page.evaluate(
      ([sceneIr, imageAssets, vAssets]) =>
        window.__reframe.init(sceneIr as never, imageAssets as never, vAssets as never),
      [ir, assets, videoAssets] as unknown[],
    );
    const dataUrl = await page.evaluate((tt) => window.__reframe.renderFrame(tt), t);
    return Buffer.from(dataUrl.slice(22), "base64");
  }, opts.supersample !== undefined ? { deviceScaleFactor: opts.supersample } : {});
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
    supersample?: number;
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
  }, opts.supersample !== undefined ? { deviceScaleFactor: opts.supersample } : {});
}
