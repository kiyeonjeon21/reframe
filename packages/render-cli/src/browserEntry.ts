/**
 * Bundled (esbuild IIFE) and injected into the capture page for IR mode.
 * Exposes window.__reframe so the Node harness can drive frames.
 */

import { compileScene, type CompiledScene, type SceneIR } from "@reframe/core";
import { renderFrame, type VideoRegistry } from "@reframe/renderer-canvas";
import "./reframeGlobal.js";

let compiled: CompiledScene | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let canvas: HTMLCanvasElement | null = null;
const images = new Map<string, CanvasImageSource>();
const videoFrames = new Map<string, CanvasImageSource[]>();

async function decode(dataUrl: string, label = ""): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
    return img;
  } catch (e) {
    throw new Error(`decode failed for ${label} (len=${dataUrl.length}): ${String(e)}`, { cause: e });
  }
}

/** Decode a list with bounded concurrency — many concurrent decodes (a long clip's
 *  frames) can spuriously fail under memory pressure, so cap the in-flight count. */
async function decodeAll(urls: string[], label: string): Promise<HTMLImageElement[]> {
  const out: HTMLImageElement[] = new Array(urls.length);
  const LIMIT = 8;
  for (let base = 0; base < urls.length; base += LIMIT) {
    const batch = urls.slice(base, base + LIMIT);
    const decoded = await Promise.all(batch.map((u, j) => decode(u, `${label}#${base + j}`)));
    for (let j = 0; j < decoded.length; j++) out[base + j] = decoded[j]!;
  }
  return out;
}

const videos: VideoRegistry = {
  frame(src, index) {
    const frames = videoFrames.get(src);
    if (!frames || frames.length === 0) return undefined;
    // clamp: hold the last frame past the clip end (and guard negatives)
    return frames[Math.max(0, Math.min(index, frames.length - 1))];
  },
};

window.__reframe = {
  // fully decode every image/video frame before the first frame — renderFrame is sync
  async init(
    ir: SceneIR,
    assets: Record<string, string> = {},
    videoAssets: Record<string, string[]> = {},
  ) {
    compiled = compileScene(ir);
    canvas = document.createElement("canvas");
    canvas.width = ir.size.width;
    canvas.height = ir.size.height;
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("could not create 2d context");
    await Promise.all(
      Object.entries(assets).map(async ([src, dataUrl]) => {
        images.set(src, await decode(dataUrl, `image ${src}`));
      }),
    );
    for (const [src, frames] of Object.entries(videoAssets)) {
      videoFrames.set(src, await decodeAll(frames, `video ${src}`));
    }
    return { duration: compiled.duration, fps: ir.fps ?? 30 };
  },
  renderFrame(t: number): string {
    if (!compiled || !ctx || !canvas) throw new Error("init() not called");
    renderFrame(ctx, compiled, t, images, videos);
    return canvas.toDataURL("image/png");
  },
  // Accumulation motion blur: average `samples` sub-frames over a shutter window
  // of `windowSec` centered on `t`. The temporal analog of supersampling — anything
  // moving smears across the window, anything static renders identical so stays crisp.
  // Averaging is in sRGB (like the ffmpeg lanczos downscale); linear-light is a
  // possible future refinement. samples <= 1 falls back to a single render(t).
  renderFrameBlur(t: number, samples: number, windowSec: number): string {
    if (!compiled || !ctx || !canvas) throw new Error("init() not called");
    const n = Math.max(1, Math.floor(samples));
    if (n === 1) {
      renderFrame(ctx, compiled, t, images, videos);
      return canvas.toDataURL("image/png");
    }
    const w = canvas.width, h = canvas.height;
    const acc = new Float32Array(w * h * 4);
    for (let s = 0; s < n; s++) {
      // midpoint samples across the window, symmetric about t (n=1 ⇒ exactly t)
      const tSub = t + ((s + 0.5) / n - 0.5) * windowSec;
      renderFrame(ctx, compiled, tSub, images, videos);
      const d = ctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < acc.length; i++) acc[i]! += d[i]!;
    }
    const out = ctx.getImageData(0, 0, w, h);
    const od = out.data;
    for (let i = 0; i < od.length; i++) od[i] = Math.round(acc[i]! / n);
    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL("image/png");
  },
};
