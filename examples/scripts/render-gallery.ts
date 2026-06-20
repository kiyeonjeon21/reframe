#!/usr/bin/env tsx
/**
 * Render the curated showcase gallery — a deterministic, idempotent pipeline that
 * turns scenes into committed gifs under `docs/assets/gallery/`. This is the home
 * for GOOD renders (vs the gitignored `out/` scratch): add a scene to GALLERY,
 * run `pnpm gallery`, commit the gif, and it accumulates.
 *
 *   pnpm gallery              # render any missing gifs
 *   pnpm gallery --force      # re-render all
 *   pnpm gallery --only media-story
 *
 * Each entry renders a short clip (`reframe render --duration`) then converts it to
 * a palette-optimized gif via ffmpeg. Existing gifs in `docs/assets/` (hero, orbit,
 * typewave, …) are reused by the gallery page directly and are NOT re-rendered here.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCENES = join(ROOT, "examples", "scenes");
const TMP = join(ROOT, "out", "_gallery");
const GALLERY = join(ROOT, "docs", "assets", "gallery");

/** Curated showcase: scene → output name, with a clip length (s) and gif width. */
interface Shot { scene: string; name: string; secs?: number; width?: number }
const GALLERY_SHOTS: Shot[] = [
  { scene: "device-gallery", name: "device-gallery", secs: 6 },
  { scene: "media-story", name: "media-story", secs: 4, width: 460 },
  { scene: "perspective-cards", name: "perspective-cards", secs: 7 },
  { scene: "group-fx-demo", name: "group-fx-demo", secs: 7 },
  { scene: "gradient-demo", name: "gradient-demo", secs: 6 },
  { scene: "matte-demo", name: "matte-demo", secs: 6 },
  { scene: "annual-report", name: "annual-report", secs: 8 },
  { scene: "figure-styles", name: "figure-styles", secs: 6 },
];

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;

function run(cmd: string, cmdArgs: string[]): boolean {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  return r.status === 0;
}

function toGif(mp4: string, gif: string, fps: number, width: number): boolean {
  const pal = join(TMP, "palette.png");
  const scale = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  return (
    run("ffmpeg", ["-y", "-i", mp4, "-vf", `${scale},palettegen=stats_mode=diff`, pal]) &&
    run("ffmpeg", ["-y", "-i", mp4, "-i", pal, "-lavfi", `${scale} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3`, gif])
  );
}

function main() {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(GALLERY, { recursive: true });
  const shots = only ? GALLERY_SHOTS.filter((s) => s.name === only) : GALLERY_SHOTS;
  if (only && shots.length === 0) { console.error(`no gallery shot named "${only}"`); process.exit(1); }

  let made = 0, skipped = 0, failed = 0;
  for (const shot of shots) {
    const gif = join(GALLERY, `${shot.name}.gif`);
    if (existsSync(gif) && !force) { console.log(`· skip ${shot.name} (exists)`); skipped++; continue; }
    const scenePath = join(SCENES, `${shot.scene}.ts`);
    if (!existsSync(scenePath)) { console.error(`✗ ${shot.name}: no scene ${shot.scene}.ts`); failed++; continue; }
    const mp4 = join(TMP, `${shot.name}.mp4`);
    console.log(`▶ rendering ${shot.scene} (${shot.secs ?? 6}s)…`);
    const rendered = run("pnpm", ["-s", "reframe", "render", scenePath, "--duration", String(shot.secs ?? 6), "--no-audio", "-o", mp4]);
    if (!rendered || !existsSync(mp4)) { console.error(`✗ ${shot.name}: render failed`); failed++; continue; }
    if (!toGif(mp4, gif, 14, shot.width ?? 640)) { console.error(`✗ ${shot.name}: gif failed`); failed++; continue; }
    console.log(`✓ ${shot.name}.gif`);
    made++;
  }
  console.log(`\ngallery: ${made} made, ${skipped} skipped, ${failed} failed → docs/assets/gallery/`);
  if (failed > 0) process.exit(1);
}

main();
