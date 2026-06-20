/**
 * Photo/video montage — a SEEDED GENERATOR that turns a list of shots (images AND
 * video clips, mixed freely) into a polished slideshow: layered image/video nodes +
 * a retimable `beat` that crossfades between shots and pans/zooms each (Ken Burns),
 * with an optional cinematic grade (vignette + bottom scrim) built from gradients +
 * blend modes. A video src plays as a clip for its `hold`. The photo analog of
 * `motionPreset` / `splitText`. (`videoMontage` is the same generator, by intent.)
 *
 * Pure and deterministic: the per-slide Ken Burns direction / framing is chosen by
 * a seeded PRNG (mulberry32) — same (images, opts) → identical IR; a different
 * `seed` re-frames within the same family. No Math.random / Date.
 *
 * Each layer is sized to the frame and uses `fit: "cover"`, so images of ANY aspect
 * ratio fill the frame (cropped, centered) with no distortion — no pre-cropping. The
 * Ken Burns keeps `scale >= 1` with the pan bounded to the scale's slack, so an edge
 * is never revealed.
 */

import type { ColorStop, NodeIR, TimelineIR } from "./ir.js";
import { beat, image, par, rect, seq, tween, video } from "./dsl.js";
import { linearGradient, radialGradient } from "./gradient.js";

export type KenBurns = "in" | "out" | "pan";

/** A shot is a still (image) or a video clip — detected by the src extension. */
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)$/i;
const isVideoSrc = (src: string) => VIDEO_EXT.test(src);

/**
 * One shot: a bare src, or a src with per-shot overrides. A video src plays as a
 * clip for its `hold`; `volume` (video shots only) is the clip-audio gain — default
 * 0 (muted) in a montage to avoid stacking soundtracks; set it per shot to include.
 */
export type MontageImage = string | { src: string; hold?: number; ken?: KenBurns; volume?: number };

export interface MontageOpts {
  /** Node-id prefix → stable regen addresses `${id}-${i}`. Default "shot". */
  id?: string;
  /** Frame size; must match the scene size. Default 1920×1080. */
  size?: { width: number; height: number };
  /** Seconds each slide is held (incl. its incoming crossfade). Default 3.2. */
  hold?: number;
  /** Crossfade seconds between slides. Default 0.6. */
  transition?: number;
  /** Max Ken Burns zoom (>1). Default 1.18. */
  zoom?: number;
  /** Emit the vignette + bottom-scrim grade overlays. Default true. */
  grade?: boolean;
  /** Deterministic framing. Same seed → identical IR. Default 0. */
  seed?: number;
}

export interface MontageResult {
  /** Image layers (+ grade overlays) — place these in `scene({ nodes })`. */
  nodes: NodeIR[];
  /** The montage beat — place in `scene({ timeline })` (compose with `seq`). */
  timeline: TimelineIR;
}

/** mulberry32 — deterministic PRNG seeded by an integer. Pure. */
function makeRng(seed: number): () => number {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const norm = (img: MontageImage): { src: string; hold?: number; ken?: KenBurns; volume?: number } =>
  typeof img === "string" ? { src: img } : img;

/**
 * Build a montage from a list of frame-aspect images.
 *
 *   const m = photoMontage(["a.jpg", "b.jpg", "c.jpg"], { seed: 7 });
 *   scene({ size, nodes: [...m.nodes, ...titles], timeline: seq(m.timeline) });
 */
export function photoMontage(images: MontageImage[], opts: MontageOpts = {}): MontageResult {
  const id = opts.id ?? "shot";
  const W = opts.size?.width ?? 1920;
  const H = opts.size?.height ?? 1080;
  const hold = Math.max(0.5, opts.hold ?? 3.2);
  const zoom = Math.max(1.001, opts.zoom ?? 1.18);
  const grade = opts.grade !== false;
  const rand = makeRng((opts.seed ?? 0) + 1);

  const slides = images.map(norm);
  const cx = W / 2;
  const cy = H / 2;

  const nodes: NodeIR[] = [];
  const shots: TimelineIR[] = [];

  slides.forEach((slide, i) => {
    const nid = `${id}-${i}`;
    const slideHold = Math.max(0.5, slide.hold ?? hold);
    const transition = Math.min(opts.transition ?? 0.6, slideHold * 0.9);

    // Seeded framing (draw in a fixed order → deterministic).
    const kind: KenBurns = slide.ken ?? (["in", "out", "pan"] as const)[Math.floor(rand() * 3)] ?? "in";
    const angle = rand() * Math.PI * 2;
    const panFrac = 0.4 + rand() * 0.35; // 0.40..0.75 of the available slack
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // scale endpoints; pan offset = dir * (scale-1) * dim/2 * panFrac. Because x/y and
    // scale share one ease+duration, the offset stays proportional to (scale-1) at every
    // instant → never exceeds the slack, so no image edge is ever revealed.
    let kA: number, kB: number;
    let xA: number, xB: number, yA: number, yB: number;
    if (kind === "pan") {
      kA = kB = zoom;
      const sx = dx * (zoom - 1) * (W / 2) * panFrac;
      const sy = dy * (zoom - 1) * (H / 2) * panFrac;
      xA = cx - sx; xB = cx + sx; yA = cy - sy; yB = cy + sy;
    } else {
      kA = kind === "in" ? 1 : zoom;
      kB = kind === "in" ? zoom : 1;
      xA = cx + dx * (kA - 1) * (W / 2) * panFrac;
      xB = cx + dx * (kB - 1) * (W / 2) * panFrac;
      yA = cy + dy * (kA - 1) * (H / 2) * panFrac;
      yB = cy + dy * (kB - 1) * (H / 2) * panFrac;
    }

    const box = { id: nid, src: slide.src, x: xA, y: yA, width: W, height: H, anchor: "center" as const, fit: "cover" as const, scale: kA, opacity: i === 0 ? 1 : 0 };
    nodes.push(
      isVideoSrc(slide.src)
        // anchor the clip's playback start to its shot label, so it ripples when the
        // montage is retimed (an overlay or AI regen) instead of staying baked at shotStart.
        ? video({ ...box, start: `shot-${i}`, volume: slide.volume ?? 0 }) // clips muted by default in a montage
        : image(box),
    );

    const ken = tween(
      nid,
      { scale: kB, x: xB, y: yB },
      { duration: slideHold, ease: "easeInOutQuad", label: `shot-${i}` },
    );
    const shot =
      i === 0
        ? par(ken)
        : par(
            ken,
            tween(`${id}-${i - 1}`, { opacity: 0 }, { duration: transition, ease: "linear", label: `cross-${i}` }),
            tween(nid, { opacity: 1 }, { duration: transition, ease: "linear" }),
          );
    shots.push(shot);
  });

  if (grade) {
    // vignette: white centre (multiply = identity) fading to a dark edge → corners deepen
    nodes.push(
      rect({
        id: `${id}-vignette`,
        x: 0,
        y: 0,
        width: W,
        height: H,
        fill: radialGradient(
          [
            { offset: 0.55, color: "#FFFFFF" },
            { offset: 1, color: "#6E6E6E" },
          ] as ColorStop[],
          { cx: 0.5, cy: 0.5, r: 0.72 },
        ),
        blend: "multiply",
      }),
    );
    // bottom scrim: a soft darken at the lower third so captions stay legible
    nodes.push(
      rect({
        id: `${id}-scrim`,
        x: 0,
        y: 0,
        width: W,
        height: H,
        fill: linearGradient(
          [
            { offset: 0, color: "#00000000" },
            { offset: 0.62, color: "#00000000" },
            { offset: 1, color: "#000000B0" },
          ] as ColorStop[],
          { angle: 90 },
        ),
      }),
    );
  }

  return { nodes, timeline: beat("montage", { nodes: nodes.map((n) => n.id) }, [seq(...shots)]) };
}

/**
 * Same as `photoMontage`, named for clip-driven montages — shots may be images or
 * video clips (mixed freely; a video src plays for its `hold`, muted by default).
 *
 *   videoMontage(["intro.jpg", "shot-a.mp4", { src: "shot-b.mp4", volume: 1 }], { seed: 3 })
 */
export const videoMontage = photoMontage;
