/**
 * Aggregate regen runs into REGEN-RESULTS.md.
 *   tsx benchmark/regen/harness/summarize.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REGEN = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Run {
  runId: string;
  taskId: string;
  baseScene: string;
  difficulty: string;
  expectedRemoved: string[];
  generation: { validateOk: boolean; renderOk: boolean; static: boolean };
  idMetrics?: {
    nodeIdRecall: number;
    stateNameRecall: number;
    labelRecall: number;
    lost: string[];
    added: string[];
    typeChanged: { id: string; from: string; to: string }[];
    lostStates: string[];
    lostLabels: string[];
  };
  probe?: {
    applied: number;
    orphaned: number;
    orphanKinds: Record<string, number>;
    integrityOk: boolean;
    sceneIdWarning: boolean;
  };
}

const pct = (x: number | undefined) => (x === undefined ? "—" : `${Math.round(x * 100)}%`);

async function main() {
  const runsDir = join(REGEN, "runs");
  const runs: Run[] = [];
  for (const dir of (await readdir(runsDir)).sort()) {
    const p = join(runsDir, dir, "run.json");
    if (!existsSync(p) || dir === "calibration") continue;
    runs.push(JSON.parse(await readFile(p, "utf8")) as Run);
  }

  const measured = runs.filter((r) => r.idMetrics);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

  let md = `# Regeneration-contract compliance results

> ${runs.length} real AI regenerations, contract text verbatim, no measurement
> hints. Directional (n=${runs.length}); see REGEN-ANALYSIS.md for the reading.

## Aggregates

- validate+render pass: ${runs.filter((r) => r.generation.validateOk && r.generation.renderOk).length}/${runs.length}
- integrityOk (runtime contract): ${runs.filter((r) => r.probe?.integrityOk).length}/${runs.filter((r) => r.probe).length}
- mean node id recall: ${pct(mean(measured.map((r) => r.idMetrics!.nodeIdRecall)))}
- mean state name recall: ${pct(mean(measured.map((r) => r.idMetrics!.stateNameRecall)))}
- mean timeline label recall: ${pct(mean(measured.map((r) => r.idMetrics!.labelRecall)))}

## Per-run table

| run | difficulty | validate | render | node recall | state recall | label recall | lost (unexpected) | typeChanged | probe orphans |
|---|---|---|---|---|---|---|---|---|---|
`;
  for (const r of runs) {
    const m = r.idMetrics;
    const kinds = r.probe
      ? Object.entries(r.probe.orphanKinds)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}:${v}`)
          .join(" ") || "none"
      : "—";
    md += `| ${r.taskId} | ${r.difficulty} | ${r.generation.validateOk ? "ok" : "FAIL"} | ${r.generation.renderOk ? "ok" : "FAIL"} | ${pct(m?.nodeIdRecall)} | ${pct(m?.stateNameRecall)} | ${pct(m?.labelRecall)} | ${m?.lost.join(", ") || "—"} | ${m?.typeChanged.map((t) => `${t.id}(${t.from}→${t.to})`).join(", ") || "—"} | ${kinds} |\n`;
  }

  await writeFile(join(REGEN, "REGEN-RESULTS.md"), md);
  console.log(`REGEN-RESULTS.md written (${runs.length} runs)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
