/**
 * The determinism contract, end to end: rendering the same input twice must
 * produce byte-identical frames (same machine). Covers both capture modes.
 */

import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { composition, scene, rect, tween } from "@reframe/core";
import { captureHtml, captureIr } from "../src/frameLoop.js";
import { renderComposition } from "../src/composition.js";
import lowerThird from "../../../examples/scenes/lower-third.js";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "gsap-box.html");
const tempDirs: string[] = [];

async function frameHashes(framesDir: string): Promise<string[]> {
  const files = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
  return Promise.all(
    files.map(async (f) =>
      createHash("sha256").update(await readFile(join(framesDir, f))).digest("hex"),
    ),
  );
}

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reframe-test-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tempDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe("deterministic capture", () => {
  it("html mode: GSAP + setInterval + raw rAF render byte-identically twice", async () => {
    const opts = { fps: 10, duration: 1, width: 480, height: 270 };
    const a = await captureHtml(FIXTURE, { ...opts, framesDir: await tempDir() });
    const b = await captureHtml(FIXTURE, { ...opts, framesDir: await tempDir() });
    const hashesA = await frameHashes(a.framesDir);
    const hashesB = await frameHashes(b.framesDir);
    expect(hashesA.length).toBe(10);
    expect(hashesA).toEqual(hashesB);
    // and the animation actually moves — the shim must not freeze the page
    expect(new Set(hashesA).size).toBeGreaterThan(1);
  }, 60_000);

  it("ir mode: example scene renders byte-identically twice", async () => {
    const opts = { fps: 5, duration: 1 };
    const a = await captureIr(lowerThird, { ...opts, framesDir: await tempDir() });
    const b = await captureIr(lowerThird, { ...opts, framesDir: await tempDir() });
    const hashesA = await frameHashes(a.framesDir);
    expect(hashesA.length).toBe(5);
    expect(hashesA).toEqual(await frameHashes(b.framesDir));
    expect(new Set(hashesA).size).toBeGreaterThan(1);
  }, 60_000);

  // a fast horizontal move — the thing motion blur smears
  const moving = scene({
    id: "mb",
    size: { width: 256, height: 144 },
    fps: 10,
    background: "#000",
    nodes: [rect({ id: "b", x: 20, y: 52, width: 40, height: 40, fill: "#fff" })],
    timeline: tween("b", { x: 200 }, { duration: 1, ease: "linear" }),
  });

  it("motion blur: off (and N=1) take the single-render path → byte-identical", async () => {
    const opts = { fps: 10, duration: 1 };
    const off = await captureIr(moving, { ...opts, framesDir: await tempDir() });
    const one = await captureIr(moving, { ...opts, motionBlur: 1, framesDir: await tempDir() });
    expect(await frameHashes(off.framesDir)).toEqual(await frameHashes(one.framesDir));
  }, 60_000);

  it("motion blur: N>1 changes a moving scene and is itself reproducible", async () => {
    const opts = { fps: 10, duration: 1, motionBlur: 6 };
    const off = await captureIr(moving, { fps: 10, duration: 1, framesDir: await tempDir() });
    const a = await captureIr(moving, { ...opts, framesDir: await tempDir() });
    const b = await captureIr(moving, { ...opts, framesDir: await tempDir() });
    const offH = await frameHashes(off.framesDir);
    const aH = await frameHashes(a.framesDir);
    // reproducible (same machine, same input)
    expect(aH).toEqual(await frameHashes(b.framesDir));
    // and it actually altered the moving frames vs the sharp render
    expect(aH).not.toEqual(offH);
  }, 90_000);

  it("composition: a 2-scene cut composition renders byte-identically twice", async () => {
    const mk = (id: string, fill: string) =>
      scene({
        id,
        size: { width: 256, height: 144 },
        fps: 5,
        nodes: [rect({ id: "b", x: 0, y: 0, width: 40, height: 40, fill })],
        timeline: tween("b", { x: 80 }, { duration: 0.4 }),
      });
    const comp = composition({ id: "c", scenes: [{ scene: mk("s1", "#ff0000") }, { scene: mk("s2", "#00ff00") }] });
    const dir = await tempDir();
    const compositionPath = join(dir, "comp.ts"); // only its dirname is used (sceneDir)
    const outA = join(dir, "a.mp4");
    const outB = join(dir, "b.mp4");
    await renderComposition(comp, { compositionPath, out: outA, noAudio: true });
    await renderComposition(comp, { compositionPath, out: outB, noAudio: true });
    const hash = async (f: string) => createHash("sha256").update(await readFile(f)).digest("hex");
    expect(await hash(outA)).toBe(await hash(outB));
  }, 120_000);
});
