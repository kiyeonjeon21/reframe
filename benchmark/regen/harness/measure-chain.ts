/**
 * Multi-turn drift measurement.
 *   tsx benchmark/regen/harness/measure-chain.ts <chainDir>
 *
 * For a chain of sequential edits (turn-1.ts .. turn-N.ts evolved from a base
 * scene), measures per-turn stepwise id recall AND the headline metric: does
 * a probe overlay authored against turn 0 still apply at the final turn,
 * with orphans exactly matching the removals the briefs asked for?
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { composeScene, type NodeIR, type SceneIR, type TimelineIR } from "@reframe/core";
import { buildProbeOverlay } from "./probe.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function collectIds(ir: SceneIR): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.type === "group") walk(node.children);
    }
  };
  walk(ir.nodes);
  return ids;
}

function collectLabels(ir: SceneIR): Set<string> {
  const labels = new Set<string>();
  const walk = (tl: TimelineIR) => {
    if ("label" in tl && tl.label !== undefined) labels.add(tl.label);
    if ("children" in tl) tl.children.forEach(walk);
  };
  if (ir.timeline) walk(ir.timeline);
  return labels;
}

async function loadScene(path: string): Promise<SceneIR> {
  return ((await import(pathToFileURL(path).href)) as { default: SceneIR }).default;
}

async function main() {
  const chainDir = resolve(process.argv[2] ?? "");
  const meta = JSON.parse(await readFile(join(chainDir, "chain.json"), "utf8")) as {
    chain: string;
    baseScene: string;
    turns: number;
    expectedRemovedByTurn: Record<string, string[]>;
  };

  const scenes: SceneIR[] = [await loadScene(join(ROOT, "examples", "scenes", `${meta.baseScene}.ts`))];
  for (let t = 1; t <= meta.turns; t++) {
    const p = join(chainDir, `turn-${t}.ts`);
    if (!existsSync(p)) break;
    scenes.push(await loadScene(p));
  }

  const allExpectedRemoved = new Set(Object.values(meta.expectedRemovedByTurn).flat());

  // --- stepwise recall (turn t vs turn t-1) ---
  const stepwise: { turn: number; recall: number; lost: string[]; added: string[]; labelsLost: string[] }[] = [];
  for (let t = 1; t < scenes.length; t++) {
    const prevIds = collectIds(scenes[t - 1]!);
    const curIds = collectIds(scenes[t]!);
    const removedThisTurn = new Set(meta.expectedRemovedByTurn[String(t)] ?? []);
    const surviving = [...prevIds].filter((id) => !removedThisTurn.has(id));
    const lost = surviving.filter((id) => !curIds.has(id));
    const prevLabels = collectLabels(scenes[t - 1]!);
    const curLabels = collectLabels(scenes[t]!);
    stepwise.push({
      turn: t,
      recall: surviving.length ? (surviving.length - lost.length) / surviving.length : 1,
      lost,
      added: [...curIds].filter((id) => !prevIds.has(id)),
      labelsLost: [...prevLabels].filter((l) => !curLabels.has(l)),
    });
  }

  // --- headline: turn-0 probe against the final turn ---
  const probe = buildProbeOverlay(scenes[0]!);
  const final = scenes[scenes.length - 1]!;
  const { report } = composeScene(final, probe);
  const orphanedAddresses = report.orphans.map((o) => o.address);
  // an orphan is EXPECTED iff its address contains a briefed-removed id
  const unexpectedOrphans = report.orphans.filter(
    (o) => ![...allExpectedRemoved].some((id) => o.address.includes(`.${id}`) || o.address.endsWith(id)),
  );

  const result = {
    chain: meta.chain,
    baseScene: meta.baseScene,
    turnsMeasured: scenes.length - 1,
    stepwise,
    day1OverlayAtFinalTurn: {
      applied: report.applied.length,
      orphaned: report.orphans.length,
      orphanedAddresses,
      expectedRemovedIds: [...allExpectedRemoved],
      unexpectedOrphans: unexpectedOrphans.map((o) => ({ address: o.address, reason: o.reason })),
    },
  };

  await writeFile(join(chainDir, "chain-result.json"), JSON.stringify(result, null, 2));
  const meanRecall = stepwise.reduce((a, s) => a + s.recall, 0) / Math.max(1, stepwise.length);
  console.log(
    `${meta.chain}: ${scenes.length - 1} turns, stepwise recall mean=${(meanRecall * 100).toFixed(1)}%, ` +
      `day-1 probe at final turn: ${report.applied.length} applied / ${report.orphans.length} orphaned ` +
      `(${unexpectedOrphans.length} UNEXPECTED)`,
  );
  for (const s of stepwise.filter((s) => s.lost.length > 0 || s.labelsLost.length > 0)) {
    console.log(`  turn ${s.turn}: lost ids [${s.lost}] labels [${s.labelsLost}]`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
