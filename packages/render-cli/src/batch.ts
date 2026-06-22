/**
 * Batch data rendering: scene = template, each data row = an overlay,
 * composeScene = substitution, one mp4 per row.
 *
 * Row keys are overlay addresses (flat dot-paths), matching compose
 * semantics 1:1 — no new schema:
 *   nodes.<id>.<prop> | states.<state>.<id>.<prop> | timeline.<label>.<key> | scene.<key>
 * `_name` names the output file; other `_`-prefixed keys are ignored metadata.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  compileScene,
  composeScene,
  resolveAudioPlan,
  type ComposeReport,
  type Ease,
  type OverlayDoc,
  type PropValue,
  type SceneIR,
} from "@reframe/core";
import { buildAudioTrack } from "./audio/index.js";
import { encodeMp4 } from "./encode.js";
import { captureIr } from "./frameLoop.js";

export type FlatRow = Record<string, string | number | boolean | null>;

export function overlayFromFlat(row: FlatRow, name: string): OverlayDoc {
  const doc: OverlayDoc = { reframeOverlay: 1, name };
  for (const [key, raw] of Object.entries(row)) {
    if (key.startsWith("_")) continue;
    if (raw === null || raw === undefined || raw === "") continue;
    const value = raw as PropValue;
    const parts = key.split(".");
    const [head] = parts;
    if (head === "nodes" && parts.length === 3) {
      ((doc.nodes ??= {})[parts[1]!] ??= {})[parts[2]!] = value;
    } else if (head === "states" && parts.length === 4) {
      (((doc.states ??= {})[parts[1]!] ??= {})[parts[2]!] ??= {})[parts[3]!] = value;
    } else if (head === "timeline" && parts.length === 3) {
      const patchKey = parts[2]!;
      if (!["duration", "ease", "stagger"].includes(patchKey)) {
        throw new Error(
          `row key "${key}": timeline patches support duration/ease/stagger, got "${patchKey}"`,
        );
      }
      ((doc.timeline ??= {})[parts[1]!] ??= {})[patchKey as "duration" | "ease" | "stagger"] =
        value as number & Ease;
    } else if (head === "scene" && parts.length === 2) {
      const sceneKey = parts[1]!;
      if (!["background", "duration", "fps"].includes(sceneKey)) {
        throw new Error(
          `row key "${key}": scene patches support background/duration/fps, got "${sceneKey}"`,
        );
      }
      (doc.scene ??= {})[sceneKey as "background" | "duration" | "fps"] = value as never;
    } else if (head === "design" && parts.length >= 2) {
      // a design-token re-skin column, e.g. "design.color.accent" -> one mp4 per brand
      (doc.design ??= {})[parts.slice(1).join(".")] = value;
    } else {
      throw new Error(
        `row key "${key}" is not a valid overlay address — expected nodes.<id>.<prop>, states.<state>.<id>.<prop>, timeline.<label>.<duration|ease|stagger>, scene.<background|duration|fps>, or design.<token.path>`,
      );
    }
  }
  return doc;
}

/** Minimal CSV: header row of dot-paths; numeric-looking values are coerced. */
export function parseCsv(text: string): FlatRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]!).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: FlatRow = {};
    headers.forEach((h, i) => {
      const cell = (cells[i] ?? "").trim();
      const asNumber = Number(cell);
      row[h] = cell !== "" && !Number.isNaN(asNumber) ? asNumber : cell;
    });
    return row;
  });
}

export async function loadRows(path: string): Promise<FlatRow[]> {
  const text = await readFile(path, "utf8");
  if (path.endsWith(".csv")) return parseCsv(text);
  const parsed = JSON.parse(text) as FlatRow[];
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array of row objects`);
  return parsed;
}

export interface BatchRowResult {
  name: string;
  output: string | null;
  applied: number;
  orphans: ComposeReport["orphans"];
  error: string | null;
}

export interface BatchOptions {
  outDir: string;
  baseOverlays: OverlayDoc[];
  concurrency: number;
  fps?: number;
  /** For scene-relative audio file cues. */
  scenePath?: string;
  noAudio?: boolean;
  onRow?: (result: BatchRowResult) => void;
}

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);

export async function runBatch(
  scene: SceneIR,
  rows: FlatRow[],
  opts: BatchOptions,
): Promise<BatchRowResult[]> {
  await mkdir(opts.outDir, { recursive: true });
  const results: BatchRowResult[] = new Array(rows.length);

  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= rows.length) return;
      const row = rows[index]!;
      const name = sanitize(String(row._name ?? `row-${index}`));
      let result: BatchRowResult;
      try {
        const rowOverlay = overlayFromFlat(row, name);
        const { ir, report } = composeScene(scene, ...opts.baseOverlays, rowOverlay);
        const framesDir = await mkdtemp(join(tmpdir(), `reframe-batch-${index}-`));
        const output = join(opts.outDir, `${name}.mp4`);
        const plan = opts.noAudio ? null : resolveAudioPlan(compileScene(ir));
        try {
          const captured = await captureIr(ir, {
            framesDir,
            ...(opts.scenePath !== undefined && { sceneDir: dirname(opts.scenePath) }),
            ...(opts.fps !== undefined && { fps: opts.fps }),
          });
          if (plan) {
            const videoTmp = `${output}.video.mp4`;
            await encodeMp4(captured.framesDir, captured.fps, videoTmp);
            await buildAudioTrack(plan, opts.scenePath ?? output, videoTmp, output);
            await rm(videoTmp, { force: true });
          } else {
            await encodeMp4(captured.framesDir, captured.fps, output);
          }
        } finally {
          await rm(framesDir, { recursive: true, force: true });
        }
        result = {
          name,
          output,
          applied: report.applied.length,
          orphans: report.orphans,
          error: null,
        };
      } catch (err) {
        result = {
          name,
          output: null,
          applied: 0,
          orphans: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
      results[index] = result;
      opts.onRow?.(result);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  await writeFile(
    join(opts.outDir, "batch-report.json"),
    JSON.stringify({ rows: results }, null, 2),
  );
  return results;
}
