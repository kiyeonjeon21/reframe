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

/**
 * Names whose curated CC0 `<name>.wav` sample sounds better than the synth, so a
 * bare `sfx:` uses the sample by default (these are mostly one-shot "hero" sounds
 * where fidelity matters more than per-use variation). Opt back into the varying
 * synth per cue with `params: { synth: 1 }`. Every other sfx name always synthesizes.
 */
const SAMPLE_DEFAULT = new Set<string>(["whoosh", "rise", "shimmer", "thud", "pop", "tick"]);

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
  // These six names ship a curated CC0 sample that sounds better than the synth,
  // so a bare `sfx:` uses it by default (the sample is fixed — it doesn't pitch-
  // vary). Every OTHER name always synthesizes (so it auto-varies). To force the
  // varying synth for one of these, pass `params: { synth: 1 }`.
  const { name, params } = cue.source;
  if (SAMPLE_DEFAULT.has(name) && !params.synth) {
    const vendored = join(VENDORED, `${name}.wav`);
    if (existsSync(vendored)) return vendored;
  }
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
