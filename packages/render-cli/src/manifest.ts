#!/usr/bin/env tsx
/**
 * `reframe manifest <scene.ts|.json> [--json]` — dump a scene's addressable /
 * editable surface: every node (+ its editable & animated props), state,
 * timeline label (+ patchable params), beat, and behavior, each with the overlay
 * address that reaches it. The map a human inspector or an AI editor reads to
 * patch a scene surgically instead of regenerating it. `--json` for machines.
 */
import { compileScene, sceneManifest } from "@reframe/core";
import { loadScene } from "./loadScene.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const path = args.find((a) => !a.startsWith("-"));
if (!path) {
  console.error("usage: reframe manifest <scene.ts|.json> [--json]");
  process.exit(1);
}

async function main() {
  const scene = await loadScene(path!);
  const m = sceneManifest(compileScene(scene));
  if (json) {
    console.log(JSON.stringify(m, null, 2));
    return;
  }
  const { summary: s } = m;
  console.log(`# ${m.scene.id} — ${m.scene.duration.toFixed(2)}s @ ${m.scene.fps}fps · ${m.scene.size.width}×${m.scene.size.height}`);
  console.log(
    `# ${s.nodeCount} nodes · ${s.labeledSteps} labeled steps · ${s.unlabeledMotionSteps} unlabeled motion · motion addressable ${(s.motionAddressableRatio * 100).toFixed(0)}%`,
  );

  console.log(`\nNODES (address: nodes.<id>)`);
  for (const n of m.nodes) {
    const indent = n.parent ? "  " : "";
    const anim = n.animatedProps.length ? `  ~animates: ${n.animatedProps.join(", ")}` : "";
    const st = n.inStates.length ? `  ~states: ${n.inStates.join(", ")}` : "";
    console.log(`${indent}${n.id}  [${n.type}]${n.parent ? ` ⊂ ${n.parent}` : ""}${anim}${st}`);
  }

  if (m.states.length) {
    console.log(`\nSTATES (address: states.<name>.<id>.<prop>)`);
    for (const st of m.states) console.log(`  ${st.name} → ${st.touches.map((t) => `${t.id}{${t.props.join(",")}}`).join(", ")}`);
  }

  if (m.timeline.length || m.beats.length) {
    console.log(`\nTIMELINE (address: timeline.<label>)`);
    for (const b of m.beats) console.log(`  ${b.t0.toFixed(2)}s–${b.t1.toFixed(2)}s  beat "${b.name}"${b.ownsNodes.length ? `  owns: ${b.ownsNodes.join(", ")}` : ""}  [patch: at,gap,scale,duration,order]`);
    for (const t of m.timeline) console.log(`  ${t.t0.toFixed(2)}s–${t.t1.toFixed(2)}s  ${t.kind} "${t.label}"${t.patchable.length ? `  [patch: ${t.patchable.join(",")}]` : ""}`);
  }

  if (m.behaviors.length) {
    console.log(`\nBEHAVIORS (address: behaviors.<target>.<prop>)`);
    for (const bh of m.behaviors) console.log(`  ${bh.target}.${bh.prop}  [${bh.kind}]`);
  }
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
