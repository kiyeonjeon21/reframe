/**
 * Bundled (esbuild IIFE) and injected into the capture page for IR mode.
 * Exposes window.__reframe so the Node harness can drive frames.
 */

import { compileScene, type CompiledScene, type SceneIR } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";
import "./reframeGlobal.js";

let compiled: CompiledScene | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let canvas: HTMLCanvasElement | null = null;
const images = new Map<string, CanvasImageSource>();

window.__reframe = {
  // fully decode every image before the first frame — renderFrame is sync
  async init(ir: SceneIR, assets: Record<string, string> = {}) {
    compiled = compileScene(ir);
    canvas = document.createElement("canvas");
    canvas.width = ir.size.width;
    canvas.height = ir.size.height;
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("could not create 2d context");
    await Promise.all(
      Object.entries(assets).map(async ([src, dataUrl]) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        images.set(src, img);
      }),
    );
    return { duration: compiled.duration, fps: ir.fps ?? 30 };
  },
  renderFrame(t: number): string {
    if (!compiled || !ctx || !canvas) throw new Error("init() not called");
    renderFrame(ctx, compiled, t, images);
    return canvas.toDataURL("image/png");
  },
};
