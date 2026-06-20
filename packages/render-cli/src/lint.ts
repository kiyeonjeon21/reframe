#!/usr/bin/env tsx
/**
 * `reframe lint <scene.ts|.json> [--json] [--strict]` — flag the surface that
 * ISN'T overlay-addressable (motion with no label can't be retimed by an edit
 * layer, and a base regeneration can silently drop it), plus an addressability
 * summary. `--strict` exits non-zero when there are findings (a CI gate).
 */
import { compileScene, lintScene, sceneManifest } from "@reframe/core";
import { loadScene } from "./loadScene.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const strict = args.includes("--strict");
const path = args.find((a) => !a.startsWith("-"));
if (!path) {
  console.error("usage: reframe lint <scene.ts|.json> [--json] [--strict]");
  process.exit(1);
}

async function main() {
  const compiled = compileScene(await loadScene(path!));
  const findings = lintScene(compiled);
  const s = sceneManifest(compiled).summary;

  if (json) {
    console.log(JSON.stringify({ findings, summary: s }, null, 2));
  } else {
    console.log(
      `# ${s.nodeCount} nodes · ${s.labeledSteps} labeled steps · motion addressable ${(s.motionAddressableRatio * 100).toFixed(0)}% (${s.unlabeledMotionSteps} unlabeled)`,
    );
    if (findings.length === 0) {
      console.log("✓ no addressability findings");
    } else {
      for (const f of findings) console.log(`  ${f.severity === "error" ? "✗" : "!"} [${f.rule}] ${f.message}`);
    }
  }
  if (strict && findings.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
