/**
 * Node-side image asset resolution for the capture page. Mirrors the audio
 * file-cue rules (audio/sfx.ts): absolute path → scene-relative. Missing
 * files fail HERE, before the browser launches, with every tried path named.
 * Values are data URLs so the capture page stays fully self-contained
 * (zero network requests — same guarantee as the embedded fonts).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, isAbsolute, resolve } from "node:path";
import { collectImageSrcs, type SceneIR } from "@reframe/core";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/** Raw src → data URL for every image the scene can display. */
export async function buildImageAssets(
  ir: SceneIR,
  sceneDir: string,
): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  for (const src of collectImageSrcs(ir)) {
    const mime = MIME[extname(src).toLowerCase()];
    if (!mime) {
      throw new Error(
        `image "${src}": unsupported format "${extname(src)}" — supported: ${Object.keys(MIME).join(" ")}`,
      );
    }
    const candidates = [isAbsolute(src) ? src : null, resolve(sceneDir, src)].filter(
      (c): c is string => c !== null,
    );
    const found = candidates.find((c) => existsSync(c));
    if (!found) {
      throw new Error(`image "${src}" not found (tried: ${candidates.join(", ")})`);
    }
    const data = await readFile(found);
    assets[src] = `data:${mime};base64,${data.toString("base64")}`;
  }
  return assets;
}
