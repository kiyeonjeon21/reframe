/**
 * Determinism guard — verify a scene is a PURE FUNCTION OF TIME (the contract the
 * whole determinism story rests on: same source → same IR → same render). Goldens
 * cover IR→render, but the source→IR step is otherwise unguarded: a scene that uses
 * `Math.random()`/`Date` compiles and renders fine yet yields a DIFFERENT IR each
 * compile, silently breaking reproducibility.
 *
 * Mechanism: bundle once, evaluate TWICE, deep-compare the two IRs. Any
 * nondeterminism makes them differ regardless of where it lives; a pure scene
 * yields identical IRs. False-positive-free (seeded wiggle/presets are stable).
 */
import { readFile } from "node:fs/promises";
import type { LintFinding } from "@reframe/core";
import { bundle, evalSceneOnce } from "./loadScene.js";

let busterN = 0;

/** First differing JSON path between two values (a `nodes.box.x` style address), or null if deep-equal. */
export function firstDiff(a: unknown, b: unknown, path = ""): { path: string; a: unknown; b: unknown } | null {
  if (Object.is(a, b)) return null;
  const oa = typeof a === "object" && a !== null;
  const ob = typeof b === "object" && b !== null;
  if (!oa || !ob || Array.isArray(a) !== Array.isArray(b)) return { path: path || "(root)", a, b };
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    const d = firstDiff(ao[k], bo[k], path ? `${path}.${k}` : k);
    if (d) return d;
  }
  return null;
}

const NONDET = /\bMath\.random\b|\bDate\.now\b|\bnew Date\b|\bperformance\.now\b|\bcrypto\.(?:getRandomValues|randomUUID)\b/;

/**
 * Check that a scene compiles to the SAME IR twice. `.json` inputs are the IR
 * itself (no eval) → trivially deterministic. Returns structured findings reusing
 * the `LintFinding` shape so they merge straight into `reframe lint`.
 */
export async function checkDeterminism(path: string): Promise<{ deterministic: boolean; findings: LintFinding[] }> {
  if (path.endsWith(".json")) return { deterministic: true, findings: [] };

  const code = await bundle({ path });
  // distinct busters defeat Node's data:-URL ESM cache so the module re-evaluates
  const a = await evalSceneOnce(code, `${busterN++}`);
  const b = await evalSceneOnce(code, `${busterN++}`);
  const diff = firstDiff(a, b);
  if (!diff) return { deterministic: true, findings: [] };

  // best-effort hint: name the likely culprit construct from the entry source
  let hint = "";
  try {
    const m = NONDET.exec(await readFile(path, "utf8"));
    if (m) hint = ` (source uses "${m[0]}")`;
  } catch {
    /* hint is optional */
  }

  return {
    deterministic: false,
    findings: [
      {
        rule: "non-deterministic-render",
        severity: "error",
        message:
          `scene is not a pure function of time — \`${diff.path}\` changed between compiles ` +
          `(${JSON.stringify(diff.a)} → ${JSON.stringify(diff.b)})${hint}. ` +
          `Avoid Math.random()/Date; use a seeded wiggle() or a scene knob.`,
        address: diff.path,
      },
    ],
  };
}
