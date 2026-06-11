/**
 * Vendored fonts injected as data-URL @font-face rules so capture pages are
 * self-contained (no network, no system-font dependence) — part of the
 * same-machine determinism guarantee.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "assets", "fonts");

const WEIGHTS = [400, 700, 800] as const;

let cssCache: string | null = null;

export async function fontFaceCss(): Promise<string> {
  if (cssCache) return cssCache;
  const rules = await Promise.all(
    WEIGHTS.map(async (weight) => {
      const data = await readFile(join(FONTS_DIR, `inter-${weight}.woff2`));
      return `@font-face {
  font-family: "Inter";
  font-style: normal;
  font-weight: ${weight};
  src: url(data:font/woff2;base64,${data.toString("base64")}) format("woff2");
}`;
    }),
  );
  cssCache = rules.join("\n");
  return cssCache;
}
