/**
 * DisplayList -> Canvas 2D. Drawing only — all animation math lives in
 * @reframe/core's evaluate(). Restricted to the plain Canvas 2D API so the
 * same code runs in the browser (preview), under Playwright (export), and
 * could port to skia-canvas later.
 */

import type { CompiledScene, DisplayList, Paint, SceneIR } from "@reframe/core";
import { evaluate } from "@reframe/core";

/** Resolve a paint into a Canvas fillStyle/strokeStyle. A string is used as-is; a
 *  gradient is built mapped to the op's local bounding box `{x,y,w,h}` (the fill is
 *  applied after setTransform, so this is node-local space). */
function resolvePaint(
  ctx: CanvasRenderingContext2D,
  paint: Paint,
  box: { x: number; y: number; w: number; h: number },
): string | CanvasGradient {
  if (typeof paint === "string") return paint;
  const { x, y, w, h } = box;
  let g: CanvasGradient;
  if (paint.kind === "linear") {
    const a = ((paint.angle ?? 0) * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const half = Math.abs(dx) * (w / 2) + Math.abs(dy) * (h / 2); // span the box along the angle
    g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  } else if (paint.kind === "radial") {
    const cx = x + (paint.cx ?? 0.5) * w;
    const cy = y + (paint.cy ?? 0.5) * h;
    const r = Math.max((paint.r ?? 0.5) * Math.max(w, h), 1e-4);
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  } else {
    const cx = x + (paint.cx ?? 0.5) * w;
    const cy = y + (paint.cy ?? 0.5) * h;
    g = ctx.createConicGradient(((paint.angle ?? 0) * Math.PI) / 180, cx, cy);
  }
  for (const s of paint.stops) g.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color);
  return g;
}

/**
 * Decoded images keyed by the RAW src string from the IR (never a resolved
 * path/URL — the DisplayList stays machine-independent). Consumers populate
 * it before the first frame; a plain Map satisfies the interface.
 */
export interface ImageRegistry {
  get(src: string): CanvasImageSource | undefined;
}

/**
 * Decoded video frames keyed by the RAW src string + frame index. A video is
 * rendered as a frame sequence (extracted at the scene fps): `frame(src, i)`
 * returns the i-th source frame, clamped to the available range by the consumer.
 */
export interface VideoRegistry {
  frame(src: string, index: number): CanvasImageSource | undefined;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  compiled: CompiledScene,
  t: number,
  images?: ImageRegistry,
  videos?: VideoRegistry,
): void {
  const { size, background } = compiled.ir;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  drawDisplayList(ctx, evaluate(compiled, t), images, videos);
}

export function drawDisplayList(
  ctx: CanvasRenderingContext2D,
  ops: DisplayList,
  images?: ImageRegistry,
  videos?: VideoRegistry,
): void {
  for (const op of ops) {
    ctx.save();
    // ancestor-group clips: each in its own space, intersected before the op draws
    if (op.clips) {
      for (const clip of op.clips) {
        ctx.setTransform(...clip.transform);
        ctx.beginPath();
        const { shape } = clip;
        if (shape.kind === "ellipse") {
          ctx.ellipse(shape.x + shape.width / 2, shape.y + shape.height / 2, Math.abs(shape.width / 2), Math.abs(shape.height / 2), 0, 0, Math.PI * 2);
        } else if (shape.radius && shape.radius > 0) {
          ctx.roundRect(shape.x, shape.y, shape.width, shape.height, shape.radius);
        } else {
          ctx.rect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.clip();
      }
    }
    ctx.setTransform(...op.transform);
    ctx.globalAlpha = Math.max(0, Math.min(1, op.opacity));
    // paint effects (in screen pixels; ctx.save/restore around the op resets them)
    if (op.blur) ctx.filter = `blur(${op.blur}px)`;
    if (op.shadowColor) {
      ctx.shadowColor = op.shadowColor;
      ctx.shadowBlur = op.shadowBlur ?? 0;
      ctx.shadowOffsetX = op.shadowX ?? 0;
      ctx.shadowOffsetY = op.shadowY ?? 0;
    }
    if (op.blend) ctx.globalCompositeOperation = mapBlend(op.blend);

    switch (op.type) {
      case "rect": {
        const box = { x: op.offsetX, y: op.offsetY, w: op.width, h: op.height };
        ctx.beginPath();
        if (op.radius && op.radius > 0) {
          ctx.roundRect(op.offsetX, op.offsetY, op.width, op.height, op.radius);
        } else {
          ctx.rect(op.offsetX, op.offsetY, op.width, op.height);
        }
        if (op.fill) {
          ctx.fillStyle = resolvePaint(ctx, op.fill, box);
          ctx.fill();
        }
        if (op.stroke) {
          ctx.strokeStyle = resolvePaint(ctx, op.stroke, box);
          ctx.lineWidth = op.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      }
      case "ellipse": {
        const box = { x: op.offsetX, y: op.offsetY, w: op.width, h: op.height };
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
          ctx.fillStyle = resolvePaint(ctx, op.fill, box);
          ctx.fill();
        }
        if (op.stroke) {
          ctx.strokeStyle = resolvePaint(ctx, op.stroke, box);
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
      case "image": {
        drawRaster(ctx, images?.get(op.src), op);
        break;
      }
      case "video": {
        drawRaster(ctx, videos?.frame(op.src, op.frame), op);
        break;
      }
      case "path": {
        const p = new Path2D(op.d);
        const box = op.bbox
          ? { x: op.bbox[0], y: op.bbox[1], w: op.bbox[2], h: op.bbox[3] }
          : { x: 0, y: 0, w: 1, h: 1 };
        if (op.fill) {
          ctx.fillStyle = resolvePaint(ctx, op.fill, box);
          ctx.fill(p);
        }
        if (op.stroke && (op.strokeWidth ?? 1) > 0) {
          ctx.strokeStyle = resolvePaint(ctx, op.stroke, box);
          ctx.lineWidth = op.strokeWidth ?? 1;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          if (op.progress < 1) {
            // draw-on: dash the whole outline as one [len, len] pattern and slide
            // the gap off. Needs the total length, which only an SVG element
            // exposes (browser-only); without it, draw the full stroke.
            const len = pathLength(op.d);
            if (len > 0) {
              ctx.setLineDash([len, len]);
              ctx.lineDashOffset = len * (1 - op.progress);
            }
          }
          ctx.stroke(p);
          ctx.setLineDash([]);
        }
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

/** Blend mode -> Canvas `globalCompositeOperation`. `add` is the additive-light mode,
 *  which Canvas names `lighter`; every other mode is already a valid GCO name. */
function mapBlend(blend: string): GlobalCompositeOperation {
  return (blend === "add" ? "lighter" : blend) as GlobalCompositeOperation;
}

/** Center cover-crop: the source rect (in image pixels) that fills a dw×dh box at
 *  the image's natural aspect — the larger axis is cropped equally on both sides. */
export function coverRect(
  iw: number,
  ih: number,
  dw: number,
  dh: number,
): { sx: number; sy: number; sw: number; sh: number } {
  if (iw <= 0 || ih <= 0 || dw <= 0 || dh <= 0) return { sx: 0, sy: 0, sw: iw, sh: ih };
  const s = Math.max(dw / iw, dh / ih); // scale image up so it covers the box
  const sw = dw / s;
  const sh = dh / s;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

/** Decoded-image natural size (HTMLImageElement → naturalWidth; ImageBitmap/Canvas → width). */
function intrinsicSize(img: CanvasImageSource): [number, number] {
  const a = img as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return [a.naturalWidth || a.width || 0, a.naturalHeight || a.height || 0];
}

/** Draw a decoded raster (image / video frame) into the op's box with its fit; when the
 *  source is missing render an unmistakable placeholder instead of throwing. Shared by
 *  the `image` and `video` cases. */
function drawRaster(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource | undefined,
  op: { offsetX: number; offsetY: number; width: number; height: number; fit?: string },
): void {
  if (img) {
    if (op.fit === "cover") {
      const [iw, ih] = intrinsicSize(img);
      const { sx, sy, sw, sh } = coverRect(iw, ih, op.width, op.height);
      ctx.drawImage(img, sx, sy, sw, sh, op.offsetX, op.offsetY, op.width, op.height);
    } else {
      ctx.drawImage(img, op.offsetX, op.offsetY, op.width, op.height);
    }
    return;
  }
  // never throw: the preview reaches this while a src loads or when it 404s
  ctx.fillStyle = "#2A2A30";
  ctx.fillRect(op.offsetX, op.offsetY, op.width, op.height);
  ctx.strokeStyle = "#FF00FF";
  ctx.lineWidth = 2;
  ctx.strokeRect(op.offsetX, op.offsetY, op.width, op.height);
  ctx.beginPath();
  ctx.moveTo(op.offsetX, op.offsetY);
  ctx.lineTo(op.offsetX + op.width, op.offsetY + op.height);
  ctx.moveTo(op.offsetX + op.width, op.offsetY);
  ctx.lineTo(op.offsetX, op.offsetY + op.height);
  ctx.stroke();
}

function quoteFamily(family: string): string {
  return family.includes(" ") && !family.includes('"') ? `"${family}"` : family;
}

/** Total length of an SVG path `d`, cached. Browser-only (uses an SVG element);
 * returns 0 elsewhere so draw-on degrades to a full stroke instead of throwing. */
const pathLengthCache = new Map<string, number>();
function pathLength(d: string): number {
  const hit = pathLengthCache.get(d);
  if (hit !== undefined) return hit;
  let len = 0;
  if (typeof document !== "undefined") {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
    el.setAttribute("d", d);
    len = el.getTotalLength();
  }
  pathLengthCache.set(d, len);
  return len;
}

export type { SceneIR };
