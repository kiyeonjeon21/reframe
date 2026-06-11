/**
 * Bundled (esbuild IIFE) and injected into the capture page for IR mode.
 * Exposes window.__reframe so the Node harness can drive frames.
 */

import { compileScene, type CompiledScene, type SceneIR } from "@reframe/core";
import { renderFrame } from "@reframe/renderer-canvas";

let compiled: CompiledScene | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let canvas: HTMLCanvasElement | null = null;

declare global {
  interface Window {
    __reframe: {
      init(ir: SceneIR): { duration: number; fps: number };
      renderFrame(t: number): string;
    };
  }
}

window.__reframe = {
  init(ir: SceneIR) {
    compiled = compileScene(ir);
    canvas = document.createElement("canvas");
    canvas.width = ir.size.width;
    canvas.height = ir.size.height;
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("could not create 2d context");
    return { duration: compiled.duration, fps: ir.fps ?? 30 };
  },
  renderFrame(t: number): string {
    if (!compiled || !ctx || !canvas) throw new Error("init() not called");
    renderFrame(ctx, compiled, t);
    return canvas.toDataURL("image/png");
  },
};
