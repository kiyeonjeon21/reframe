/**
 * Cue source resolution: vendored CC0 samples in assets/sfx/ win over the
 * synthesizer for matching names; file cues resolve absolute → scene-relative
 * → assets/sfx/. Synthesized WAVs land in a content-addressed temp cache
 * (atomic rename — safe under batch concurrency).
 */

import { mkdir, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedCue } from "@reframe/core";
import { synthBgm, synthSfx } from "./synth.js";
import type { BgmSynth } from "@reframe/core";
import { encodeWavMono16 } from "./wav.js";

// packaged: dist/cli.js → <pkg>/assets/sfx; repo: src/audio → <root>/assets/sfx
const ROOT =
  process.env.REFRAME_PACKAGED === "1"
    ? resolve(dirname(fileURLToPath(import.meta.url)), "..")
    : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const VENDORED = join(ROOT, "assets", "sfx");
const CACHE = join(tmpdir(), "reframe-sfx-cache");

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function writeCached(key: string, make: () => Float32Array): Promise<string> {
  const path = join(CACHE, `${key}.wav`);
  if (existsSync(path)) return path;
  await mkdir(CACHE, { recursive: true });
  const temp = `${path}.${process.pid}.${fnv1a(String(performance.now()))}.tmp`;
  await writeFile(temp, encodeWavMono16(make()));
  await rename(temp, path); // atomic — concurrent batch workers can race safely
  return path;
}

/** Returns a playable file path for a resolved cue. */
export async function resolveCueFile(cue: ResolvedCue, sceneDir: string): Promise<string> {
  if (cue.source.kind === "file") {
    const p = cue.source.path;
    for (const candidate of [
      isAbsolute(p) ? p : null,
      resolve(sceneDir, p),
      join(VENDORED, p),
    ]) {
      if (candidate && existsSync(candidate)) return candidate;
    }
    throw new Error(
      `audio cue file "${p}" not found (tried absolute, scene-relative, assets/sfx/)`,
    );
  }
  // `sfx:` always synthesizes — so the pitch/auto-variation applies. (A real
  // sample is still available by name via an explicit `file: "whoosh.wav"` cue.)
  const { name, params } = cue.source;
  return writeCached(`${name}-${fnv1a(JSON.stringify(params))}`, () => synthSfx(name, params));
}

export async function resolveBgmFile(
  source: { kind: "file"; path: string } | { kind: "synth"; name: BgmSynth },
  duration: number,
  sceneDir: string,
): Promise<string> {
  if (source.kind === "file") {
    const p = source.path;
    for (const candidate of [isAbsolute(p) ? p : null, resolve(sceneDir, p), join(VENDORED, p)]) {
      if (candidate && existsSync(candidate)) return candidate;
    }
    throw new Error(`bgm file "${p}" not found`);
  }
  return writeCached(`${source.name}-${duration.toFixed(2)}`, () => synthBgm(source.name, duration));
}
