#!/usr/bin/env tsx
/**
 * `reframe compose <scene.ts|.json> --overlay <ov.json>... [-o out.json] [--json]`
 * — compose OverlayDoc(s) onto a base scene and emit the composed **SceneIR**, no
 * render. This is the IR half of the core `composeScene` (`verify-overlay` is its
 * report half). Feed the result straight to `player`/`frame` for an instant overlay
 * preview, without rendering an mp4.
 *
 *   reframe compose scene.ts --overlay edits.json            # composed IR to stdout
 *   reframe compose scene.ts --overlay edits.json -o c.json  # to a file
 *   reframe compose scene.json --overlay a.json --overlay b.json   # base may be IR (.json)
 *
 * Composition is a pure IR→IR transform (deterministic): same base + overlays →
 * byte-identical IR. The composed IR is validated; an overlay address that doesn't
 * resolve is reported as an orphan on stderr — NON-gating (the partial IR is still
 * emitted; use `verify-overlay` to gate). stdout stays a bare SceneIR so it pipes
 * straight into `player`/`frame`. On a validation failure the error is structured
 * with --json.
 */
import { writeFile } from "node:fs/promises";
import { formatComposeReport, SceneValidationError } from "@reframe/core";
import { loadScene, SceneLoadError } from "./loadScene.js";
import { applyOverlays } from "./overlay.js";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string): string | undefined => {
  const i = args.indexOf(n);
  return i !== -1 ? args[i + 1] : undefined;
};
const jsonMode = flag("--json");

function allOpt(n: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === n && args[i + 1]) out.push(args[i + 1]!);
  return out;
}

async function main() {
  const out = opt("-o");
  const overlays = allOpt("--overlay");
  // positional base = a non-flag arg not consumed by -o/--overlay
  const input = args.find((a, i) => !a.startsWith("-") && !["-o", "--overlay"].includes(args[i - 1] ?? ""));
  if (!input) throw new SceneLoadError("eval", "compose needs a scene file (.ts or .json)");
  if (overlays.length === 0) throw new SceneLoadError("eval", "compose needs at least one --overlay <doc.json>");

  const base = await loadScene(input);
  const { ir, report } = await applyOverlays(base, overlays);

  // report → stderr (stdout stays a bare SceneIR, pipeable to player/frame)
  if (jsonMode) console.error(JSON.stringify(report));
  else console.error(formatComposeReport(report));

  const text = JSON.stringify(ir);
  if (out) await writeFile(out, `${text}\n`);
  else process.stdout.write(`${text}\n`);
}

main().catch((err: unknown) => {
  const kind = err instanceof SceneLoadError ? err.kind : err instanceof SceneValidationError ? "validation" : "eval";
  const issues =
    err instanceof SceneLoadError ? err.issues : err instanceof SceneValidationError ? err.issues : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (jsonMode) process.stdout.write(`${JSON.stringify({ ok: false, error: message, kind, ...(issues && { issues }) })}\n`);
  else console.error(`error: ${message}`);
  process.exit(1);
});
