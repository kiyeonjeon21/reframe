/**
 * Edit-survival demo: human edits live in an overlay; the AI regenerates the
 * base scene; the overlay re-applies and the edits survive — with a loud
 * orphan report for the one node the regeneration renamed.
 *
 *   pnpm demo:overlay
 */

import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { composeScene, formatComposeReport, type OverlayDoc, type SceneIR } from "@reframe/core";
import { captureIr, encodeMp4 } from "@reframe/render-cli";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function render(ir: SceneIR, outFile: string) {
  const framesDir = await mkdtemp(join(tmpdir(), "reframe-demo-"));
  try {
    const result = await captureIr(ir, { framesDir });
    await encodeMp4(result.framesDir, result.fps, outFile);
    console.log(`  → ${outFile} (${result.frameCount} frames)`);
  } finally {
    await rm(framesDir, { recursive: true, force: true });
  }
}

async function main() {
  const base = (await import("../scenes/logo-reveal.js")).default;
  const regen = (await import("../scenes/logo-reveal-regen.js")).default;
  const overlay = JSON.parse(
    await readFile(join(ROOT, "examples", "overlays", "brand-edits.json"), "utf8"),
  ) as OverlayDoc;
  await mkdir(join(ROOT, "out"), { recursive: true });

  console.log("\n[1/3] base scene, no edits");
  await render(base, join(ROOT, "out", "demo-1-base.mp4"));

  console.log("\n[2/3] base + human overlay (brand color, tagline, float, watermark)");
  const edited = composeScene(base, overlay);
  console.log(formatComposeReport(edited.report));
  await render(edited.ir, join(ROOT, "out", "demo-2-edited.mp4"));

  console.log("\n[3/3] AI-REGENERATED base + the SAME overlay — edits survive the regeneration");
  const regenEdited = composeScene(regen, overlay);
  console.log(formatComposeReport(regenEdited.report));
  await render(regenEdited.ir, join(ROOT, "out", "demo-3-regen-edited.mp4"));

  const survived = regenEdited.report.applied.length;
  const lost = regenEdited.report.orphans.length;
  console.log(
    `\nresult: ${survived} edits survived a full base regeneration, ${lost} orphaned (renamed node) — and the orphan was reported, not silently dropped.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
