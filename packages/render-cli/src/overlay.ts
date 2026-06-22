/**
 * Shared overlay composition for the CLI: read OverlayDoc JSON files and compose
 * them onto a base SceneIR via the core `composeScene`. One code path behind
 * `render` / `compose` / `frame --overlay` / `player --overlay`, so they all apply
 * overlays and report applied/orphans identically.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { composeScene, type ComposeReport, type OverlayDoc, type PropValue, type SceneIR } from "@reframe/core";

/** Flatten a nested theme object to dotted scalar leaves (skipping arrays): `{color:{accent}}` -> `{"color.accent":…}`. */
export function flattenTokens(obj: unknown, prefix = ""): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || typeof v === "number") out[path] = v;
    else if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flattenTokens(v, path));
  }
  return out;
}

/**
 * Load a brand-kit JSON (a NESTED partial theme, e.g. `{ "color": { "accent": "#1E90FF" } }`)
 * as a `design` OverlayDoc — the `--theme` path. Flattens its scalar leaves to the dotted
 * `design.<path>` address form `composeScene` applies.
 */
export async function loadThemeDoc(themePath: string): Promise<OverlayDoc> {
  const parsed = JSON.parse(await readFile(themePath, "utf8")) as unknown;
  return { reframeOverlay: 1, name: basename(themePath), design: flattenTokens(parsed) };
}

/**
 * Compose `overlayPaths` (JSON OverlayDocs) onto `ir`, optionally prefixed by a `--theme`
 * brand kit (`themePath`). The theme is composed FIRST so a `--overlay` can still override it.
 * Returns the composed IR and the report. With nothing to apply, returns `ir` unchanged.
 */
export async function applyOverlays(
  ir: SceneIR,
  overlayPaths: string[],
  themePath?: string,
): Promise<{ ir: SceneIR; report: ComposeReport }> {
  if (overlayPaths.length === 0 && !themePath) {
    return { ir, report: { applied: [], orphans: [], warnings: [] } };
  }
  const docs: OverlayDoc[] = [];
  if (themePath) docs.push(await loadThemeDoc(themePath));
  for (const p of overlayPaths) docs.push(JSON.parse(await readFile(p, "utf8")) as OverlayDoc);
  return composeScene(ir, ...docs);
}
