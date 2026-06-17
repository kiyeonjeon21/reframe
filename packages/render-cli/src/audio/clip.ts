/**
 * Extract a video clip's own audio track to a WAV for the mux. A clip with no
 * audio stream returns null (skipped). Path rules mirror videos.ts / images.ts.
 * Trim / tempo / delay / gain are applied in the mux filter graph, not here.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { ClipAudio } from "@reframe/core";

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("close", (code) => res({ code: code ?? 1, stdout, stderr }));
    proc.on("error", reject);
  });
}

/** Does the file have at least one audio stream? */
export async function hasAudioStream(file: string): Promise<boolean> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file,
  ]);
  return stdout.trim().length > 0;
}

function resolveSrc(src: string, sceneDir: string): string {
  const candidates = [isAbsolute(src) ? src : null, resolve(sceneDir, src)].filter(
    (c): c is string => c !== null,
  );
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error(`video "${src}" not found (tried: ${candidates.join(", ")})`);
  return found;
}

/**
 * Extract `entry.src`'s audio to a PCM WAV in `workDir`. Returns the path, or null
 * if the clip has no audio stream (silent — skipped from the mix).
 */
export async function resolveClipAudio(
  entry: ClipAudio,
  sceneDir: string,
  workDir: string,
): Promise<string | null> {
  const src = resolveSrc(entry.src, sceneDir);
  if (!(await hasAudioStream(src))) return null;
  const out = join(workDir, `clip-${entry.nodeId}.wav`);
  const { code, stderr } = await run("ffmpeg", [
    "-y", "-i", src, "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", out,
  ]);
  if (code !== 0) throw new Error(`clip audio extract failed for "${entry.src}":\n${stderr.slice(-1500)}`);
  return out;
}
