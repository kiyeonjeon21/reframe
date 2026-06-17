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

const decode = (dataUrl: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.src = dataUrl;
  return img.decode().then(() => img);
};

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
    await Promise.all([
      ...Object.entries(assets).map(async ([src, dataUrl]) => {
        images.set(src, await decode(dataUrl));
      }),
      ...Object.entries(videoAssets).map(async ([src, frames]) => {
        videoFrames.set(src, await Promise.all(frames.map(decode)));
      }),
    ]);
    return { duration: compiled.duration, fps: ir.fps ?? 30 };
  },
  renderFrame(t: number): string {
    if (!compiled || !ctx || !canvas) throw new Error("init() not called");
    renderFrame(ctx, compiled, t, images, videos);
    return canvas.toDataURL("image/png");
  },
};
