/**
 * Aggregate runs/<id>/{run.json,judge.json} into RESULTS.md.
 *   tsx benchmark/harness/summarize.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BENCH = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = join(BENCH, "runs");

interface Run {
  runId: string;
  task: string;
  arm: "edsl" | "html";
  trial: number;
  attempts: { round: number; renderOk: boolean; static: boolean; error: string | null }[];
  objective?: { loc: number; codeChars: number };
  judge?: { fidelity: number; layout: number; motion: number; polish: number; overall: number; rationale: string };
}

const DIMS = ["fidelity", "layout", "motion", "polish", "overall"] as const;

async function loadRuns(): Promise<Run[]> {
  if (!existsSync(RUNS)) return [];
  const runs: Run[] = [];
  for (const dir of (await readdir(RUNS)).sort()) {
    const runJson = join(RUNS, dir, "run.json");
    if (!existsSync(runJson)) continue;
    const run = JSON.parse(await readFile(runJson, "utf8")) as Run;
    const judgeJson = join(RUNS, dir, "judge.json");
    if (existsSync(judgeJson)) run.judge = JSON.parse(await readFile(judgeJson, "utf8"));
    runs.push(run);
  }
  return runs;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x: number) => (Number.isNaN(x) ? "—" : x.toFixed(2));

function judgeTotal(r: Run): number | null {
  return r.judge ? DIMS.reduce((sum, d) => sum + r.judge![d], 0) : null;
}

async function main() {
  const runs = (await loadRuns()).filter((r) => !r.runId.includes("pilot"));
  const pilots = (await loadRuns()).filter((r) => r.runId.includes("pilot"));

  let md = `# Benchmark results: reframe eDSL vs HTML+GSAP

> **Framing**: ${runs.length} runs is a directional signal with qualitative
> failure analysis — NOT a statistically significant comparison. Read the
> rationales and failure modes, not just the means.

`;

  for (const arm of ["edsl", "html"] as const) {
    const armRuns = runs.filter((r) => r.arm === arm);
    if (armRuns.length === 0) continue;
    const firstTry = armRuns.filter((r) => r.attempts[0]?.renderOk).length;
    const eventually = armRuns.filter((r) => r.attempts.some((a) => a.renderOk)).length;
    const repairs = mean(armRuns.map((r) => r.attempts.length - 1));
    const judged = armRuns.map(judgeTotal).filter((x): x is number => x !== null);
    md += `## arm: ${arm}\n\n`;
    md += `- runs: ${armRuns.length}\n`;
    md += `- first-attempt render success: ${firstTry}/${armRuns.length}\n`;
    md += `- eventual render success (≤2 repairs): ${eventually}/${armRuns.length}\n`;
    md += `- mean repair rounds: ${fmt(repairs)}\n`;
    md += `- mean judge total (/25): ${fmt(mean(judged))} (n=${judged.length})\n`;
    for (const d of DIMS) {
      md += `  - ${d}: ${fmt(mean(armRuns.filter((r) => r.judge).map((r) => r.judge![d])))}\n`;
    }
    md += `- mean LOC: ${fmt(mean(armRuns.filter((r) => r.objective).map((r) => r.objective!.loc)))}\n\n`;
  }

  md += `## Per-run table\n\n| task | arm | trial | render | repairs | static | judge total | overall |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of runs.sort((a, b) => a.task.localeCompare(b.task) || a.arm.localeCompare(b.arm) || a.trial - b.trial)) {
    const ok = r.attempts.some((a) => a.renderOk);
    const isStatic = r.attempts.at(-1)?.static ?? false;
    md += `| ${r.task} | ${r.arm} | ${r.trial} | ${ok ? "ok" : "FAIL"} | ${r.attempts.length - 1} | ${isStatic ? "STATIC" : ""} | ${judgeTotal(r) ?? "—"} | ${r.judge?.overall ?? "—"} |\n`;
  }

  if (pilots.length > 0) {
    md += `\n_(${pilots.length} pilot runs excluded from aggregates.)_\n`;
  }

  await writeFile(join(BENCH, "RESULTS.md"), md);
  console.log(`RESULTS.md written (${runs.length} runs, ${pilots.length} pilots excluded)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
