/**
 * DisplayList -> Canvas 2D. Drawing only — all animation math lives in
 * @reframe/core's evaluate(). Restricted to the plain Canvas 2D API so the
 * same code runs in the browser (preview), under Playwright (export), and
 * could port to skia-canvas later.
 */

import type { CompiledScene, DisplayList, SceneIR } from "@reframe/core";
import { evaluate } from "@reframe/core";

export function renderFrame(ctx: CanvasRenderingContext2D, compiled: CompiledScene, t: number): void {
  const { size, background } = compiled.ir;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  drawDisplayList(ctx, evaluate(compiled, t));
}

export function drawDisplayList(ctx: CanvasRenderingContext2D, ops: DisplayList): void {
  for (const op of ops) {
    ctx.save();
    ctx.setTransform(...op.transform);
    ctx.globalAlpha = Math.max(0, Math.min(1, op.opacity));

    switch (op.type) {
      case "rect": {
        ctx.beginPath();
        if (op.radius && op.radius > 0) {
          ctx.roundRect(op.offsetX, op.offsetY, op.width, op.height, op.radius);
        } else {
          ctx.rect(op.offsetX, op.offsetY, op.width, op.height);
        }
        if (op.fill) {
          ctx.fillStyle = op.fill;
          ctx.fill();
        }
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = op.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      }
      case "ellipse": {
        ctx.beginPath();
        ctx.ellipse(
          op.offsetX + op.width / 2,
          op.offsetY + op.height / 2,
          Math.abs(op.width / 2),
          Math.abs(op.height / 2),
          0,
          0,
          Math.PI * 2,
        );
        if (op.fill) {
          ctx.fillStyle = op.fill;
          ctx.fill();
        }
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = op.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      }
      case "line": {
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.strokeWidth;
        ctx.lineCap = "round";
        ctx.stroke();
        break;
      }
      case "text": {
        ctx.font = `${op.fontWeight} ${op.fontSize}px ${quoteFamily(op.fontFamily)}`;
        if (op.letterSpacing) ctx.letterSpacing = `${op.letterSpacing}px`;
        ctx.textAlign = op.align;
        ctx.textBaseline = op.baseline;
        ctx.fillStyle = op.fill;
        ctx.fillText(op.content, 0, 0);
        if (op.letterSpacing) ctx.letterSpacing = "0px";
        break;
      }
    }
    ctx.restore();
  }
}

function quoteFamily(family: string): string {
  return family.includes(" ") && !family.includes('"') ? `"${family}"` : family;
}

export type { SceneIR };
