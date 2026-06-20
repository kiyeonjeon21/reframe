#!/usr/bin/env tsx
/**
 * `reframe verify-overlay <base.ts|.json> <overlay.json>... [--json]` — compose
 * an overlay onto a base and report what applied vs orphaned, NO render. The
 * regen-survival check: run it against the original base (expect all applied),
 * then against the AI-regenerated base — any orphan is a broken stable address
 * (a human edit that silently stopped applying). Exits non-zero on orphans, so
 * it gates CI. No ffmpeg / chromium.
 */
import { readFile } from "node:fs/promises";
import { composeScene, formatComposeReport, type OverlayDoc } from "@reframe/core";
import { loadScene } from "./loadScene.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const files = args.filter((a) => !a.startsWith("-"));
const [basePath, ...overlayPaths] = files;
if (!basePath || overlayPaths.length === 0) {
  console.error("usage: reframe verify-overlay <base.ts|.json> <overlay.json>... [--json]");
  process.exit(1);
}

async function main() {
  const base = await loadScene(basePath!);
  const overlays = await Promise.all(overlayPaths.map(async (p) => JSON.parse(await readFile(p, "utf8")) as OverlayDoc));
  const { report } = composeScene(base, ...overlays);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatComposeReport(report));
  }
  if (report.orphans.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
