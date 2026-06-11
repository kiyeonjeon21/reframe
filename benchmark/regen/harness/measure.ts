/**
 * Measure a regeneration run against the contract.
 *   tsx benchmark/regen/harness/measure.ts <runDir>
 *
 * Metric A (set-based): node id / state name / timeline label recall vs base.
 * Metric B (probe): compose a probe overlay touching every base address
 * against the regen and classify the orphan report. A and B overlap on
 * purpose — disagreement means a measurement bug.
 * Metric C (quality gate): validate + render + static-clip check.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  composeScene,
  type ComposeReport,
  type NodeIR,
  type SceneIR,
  type TimelineIR,
} from "@reframe/core";
import { buildProbeOverlay } from "./probe.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CLI = join(ROOT, "packages", "render-cli", "src", "cli.ts");

interface Meta {
  runId: string;
  taskId: string;
  baseScene: string;
  difficulty: string;
  expectedRemoved: string[];
  trial: number;
}

function collectNodes(ir: SceneIR): Map<string, NodeIR["type"]> {
  const map = new Map<string, NodeIR["type"]>();
  const walk = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      map.set(node.id, node.type);
      if (node.type === "group") walk(node.children);
    }
  };
  walk(ir.nodes);
  return map;
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

function classifyOrphans(report: ComposeReport, expectedRemoved: string[]) {
  const kinds = {
    renamedNode: 0,
    removedNode: 0,
    renamedState: 0,
    stateNodeLost: 0,
    typeChange: 0,
    lostLabel: 0,
    labelKindChange: 0,
    other: 0,
  };
  for (const o of report.orphans) {
    const nodeMatch = /unknown node "([^"]+)"/.exec(o.reason);
    if (o.address.startsWith("nodes.") && nodeMatch) {
      if (expectedRemoved.includes(nodeMatch[1]!)) kinds.removedNode++;
      else kinds.renamedNode++;
    } else if (o.address.startsWith("states.") && /unknown state/.test(o.reason)) {
      kinds.renamedState++;
    } else if (o.address.startsWith("states.") && nodeMatch) {
      kinds.stateNodeLost++;
    } else if (/is not a prop of/.test(o.reason)) {
      kinds.typeChange++;
    } else if (/unknown timeline label/.test(o.reason)) {
      kinds.lostLabel++;
    } else if (/not patchable/.test(o.reason)) {
      kinds.labelKindChange++;
    } else {
      kinds.other++;
    }
  }
  return kinds;
}

/** Every probed address group must surface in the report exactly as applied or orphaned. */
function checkIntegrity(report: ComposeReport, probeGroups: string[]): boolean {
  return probeGroups.every(
    (prefix) =>
      report.applied.some((a) => a.address === prefix || a.address.startsWith(`${prefix}.`)) ||
      report.orphans.some((o) => o.address === prefix || o.address.startsWith(`${prefix}.`)),
  );
}

function exec(cmd: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((res) => {
    const proc = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => (output += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (output += d.toString()));
    proc.on("close", (code) => res({ code: code ?? 1, output }));
  });
}

async function main() {
  const runDir = resolve(process.argv[2] ?? "");
  const meta = JSON.parse(await readFile(join(runDir, "meta.json"), "utf8")) as Meta;

  const basePath = join(ROOT, "examples", "scenes", `${meta.baseScene}.ts`);
  const base = ((await import(pathToFileURL(basePath).href)) as { default: SceneIR }).default;

  const run: Record<string, unknown> = { ...meta };

  let regen: SceneIR | null = null;
  let validateError: string | null = null;
  try {
    const regenPath = join(runDir, "attempt-0", "scene.ts");
    regen = ((await import(pathToFileURL(regenPath).href)) as { default: SceneIR }).default;
    if (!regen) throw new Error("scene.ts has no default export");
  } catch (err) {
    validateError = err instanceof Error ? err.message : String(err);
  }

  if (regen) {
    // --- Metric A: set-based recall ---
    const baseNodes = collectNodes(base);
    const regenNodes = collectNodes(regen);
    const surviving = [...baseNodes.keys()].filter((id) => !meta.expectedRemoved.includes(id));
    const lost = surviving.filter((id) => !regenNodes.has(id));
    const added = [...regenNodes.keys()].filter((id) => !baseNodes.has(id));
    const typeChanged = surviving
      .filter((id) => regenNodes.has(id) && regenNodes.get(id) !== baseNodes.get(id))
      .map((id) => ({ id, from: baseNodes.get(id), to: regenNodes.get(id) }));

    const baseStates = Object.keys(base.states ?? {});
    const regenStates = new Set(Object.keys(regen.states ?? {}));
    const lostStates = baseStates.filter((s) => !regenStates.has(s));

    const baseLabels = [...collectLabels(base)];
    const regenLabels = collectLabels(regen);
    const lostLabels = baseLabels.filter((l) => !regenLabels.has(l));

    run.idMetrics = {
      nodeIdRecall: surviving.length ? (surviving.length - lost.length) / surviving.length : 1,
      stateNameRecall: baseStates.length
        ? (baseStates.length - lostStates.length) / baseStates.length
        : 1,
      labelRecall: baseLabels.length
        ? (baseLabels.length - lostLabels.length) / baseLabels.length
        : 1,
      lost,
      lostExpected: meta.expectedRemoved.filter((id) => !regenNodes.has(id)),
      added,
      typeChanged,
      lostStates,
      lostLabels,
    };

    // --- Metric B: probe overlay ---
    const probe = buildProbeOverlay(base);
    await writeFile(join(runDir, "probe-overlay.json"), JSON.stringify(probe, null, 2));
    let report: ComposeReport | null = null;
    let composeThrew: string | null = null;
    try {
      report = composeScene(regen, probe).report;
    } catch (err) {
      composeThrew = err instanceof Error ? err.message : String(err);
    }
    if (report) {
      const probeGroups = [
        ...Object.keys(probe.nodes ?? {}).map((id) => `nodes.${id}`),
        ...Object.keys(probe.states ?? {}).map((s) => `states.${s}`),
        ...Object.keys(probe.timeline ?? {}).map((l) => `timeline.${l}`),
      ];
      run.probe = {
        applied: report.applied.length,
        orphaned: report.orphans.length,
        orphanKinds: classifyOrphans(report, meta.expectedRemoved),
        sceneIdWarning: report.warnings.length > 0,
        integrityOk: checkIntegrity(report, probeGroups),
        composeThrew: null,
      };
    } else {
      run.probe = { composeThrew, integrityOk: false };
    }

    // --- Metric C: render gate ---
    const framesDir = join(runDir, "frames");
    await rm(framesDir, { recursive: true, force: true });
    const mp4 = join(runDir, "out.mp4");
    const { code, output } = await exec("npx", [
      "tsx",
      CLI,
      "ir",
      join(runDir, "attempt-0", "scene.ts"),
      "-o",
      mp4,
      "--frames-dir",
      framesDir,
    ]);
    let isStatic = false;
    if (code === 0) {
      const hashes = new Set<string>();
      for (const f of (await readdir(framesDir)).filter((f) => f.endsWith(".png"))) {
        hashes.add(createHash("sha256").update(await readFile(join(framesDir, f))).digest("hex"));
      }
      isStatic = hashes.size <= 1;
    }
    await rm(framesDir, { recursive: true, force: true });
    run.generation = {
      validateOk: true,
      renderOk: code === 0,
      static: isStatic,
      ...(code !== 0 && { renderError: output.slice(-1500) }),
    };
  } else {
    run.generation = { validateOk: false, validateError, renderOk: false, static: false };
  }

  await writeFile(join(runDir, "run.json"), JSON.stringify(run, null, 2));
  const gen = run.generation as { validateOk: boolean; renderOk: boolean };
  const metrics = run.idMetrics as { nodeIdRecall?: number } | undefined;
  console.log(
    `${meta.runId}: validate=${gen.validateOk} render=${gen.renderOk} nodeIdRecall=${metrics?.nodeIdRecall?.toFixed(2) ?? "n/a"} integrity=${(run.probe as { integrityOk?: boolean } | undefined)?.integrityOk ?? "n/a"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
