/**
 * Shared overlay composition for the CLI: read OverlayDoc JSON files and compose
 * them onto a base SceneIR via the core `composeScene`. One code path behind
 * `render` / `compose` / `frame --overlay` / `player --overlay`, so they all apply
 * overlays and report applied/orphans identically.
 */
import { readFile } from "node:fs/promises";
import { composeScene, type ComposeReport, type OverlayDoc, type SceneIR } from "@reframe/core";

/**
 * Compose `overlayPaths` (JSON OverlayDocs) onto `ir`. Returns the composed IR and
 * the report (applied/orphans/warnings). With no overlays, returns `ir` unchanged
 * and an empty report. The composed IR is validated by `composeScene`.
 */
export async function applyOverlays(
  ir: SceneIR,
  overlayPaths: string[],
): Promise<{ ir: SceneIR; report: ComposeReport }> {
  if (overlayPaths.length === 0) return { ir, report: { applied: [], orphans: [], warnings: [] } };
  const docs = await Promise.all(
    overlayPaths.map(async (p) => JSON.parse(await readFile(p, "utf8")) as OverlayDoc),
  );
  return composeScene(ir, ...docs);
}
