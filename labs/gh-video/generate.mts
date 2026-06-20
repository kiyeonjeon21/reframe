#!/usr/bin/env tsx
/**
 * GitHub → video: one command, your stats as a share-worthy clip.
 *
 *   npx tsx labs/gh-video/generate.mts <github-username>
 *
 * Fetches public GitHub data (no auth), circle-crops the avatar, codegens a
 * scene from the data + template, and renders it. Output: out/gh-<user>.mp4.
 * Orchestrator only — no @reframe/core import (the render step resolves it).
 */

import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

// GitHub linguist colors for the common languages (fallback gray).
const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178C6", JavaScript: "#F1E05A", Python: "#3572A5", Java: "#B07219",
  Go: "#00ADD8", Rust: "#DEA584", C: "#555555", "C++": "#F34B7D", "C#": "#178600",
  Ruby: "#701516", PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF", Scala: "#C22D40",
  Shell: "#89E051", HTML: "#E34C26", CSS: "#563D7C", Vue: "#41B883", Dart: "#00B4AB",
  "Jupyter Notebook": "#DA5B0B", Elixir: "#6E4A7E", Haskell: "#5E5086", Lua: "#000080",
  R: "#198CE7", Julia: "#A270BA", Solidity: "#AA6746",
};

function exec(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "inherit", "pipe"] });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}: ${err.slice(-400)}`))));
  });
}

async function gh(path: string): Promise<unknown> {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "reframe-gh-video" },
  });
  if (!r.ok) throw new Error(`GitHub API ${path}: ${r.status} ${r.statusText}`);
  return r.json();
}

async function main() {
  const user = process.argv[2];
  if (!user) {
    console.error("usage: npx tsx labs/gh-video/generate.mts <github-username>");
    process.exit(2);
  }
  console.log(`fetching github.com/${user} …`);
  const profile = (await gh(`/users/${user}`)) as Record<string, unknown>;
  const repos = (await gh(`/users/${user}/repos?per_page=100&sort=updated`)) as Record<string, unknown>[];

  const stars = repos.reduce((a, r) => a + (r.stargazers_count as number), 0);
  const langCounts = new Map<string, number>();
  for (const r of repos) {
    const l = r.language as string | null;
    if (l) langCounts.set(l, (langCounts.get(l) ?? 0) + 1);
  }
  const languages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => ({ name: name === "Jupyter Notebook" ? "Jupyter" : name, n, color: LANG_COLOR[name] ?? "#8B949E" }));
  const top = [...repos].sort((a, b) => (b.stargazers_count as number) - (a.stargazers_count as number))[0];
  const topRepo = top
    ? { name: top.name as string, stars: top.stargazers_count as number, language: (top.language as string) ?? "code" }
    : null;

  // avatar → circle-cropped PNG, scene-relative
  const avatarFile = `assets/avatar-${user}.png`;
  const raw = join(HERE, `_avatar-${user}-raw.png`);
  const buf = Buffer.from(await (await fetch(profile.avatar_url as string)).arrayBuffer());
  await writeFile(raw, buf);
  await exec("ffmpeg", [
    "-y", "-loglevel", "error", "-i", raw,
    "-vf", "scale=400:400,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(sqrt((X-200)*(X-200)+(Y-200)*(Y-200)),200),255,0)'",
    join(HERE, avatarFile),
  ]);
  await rm(raw, { force: true });

  const data = {
    name: (profile.name as string) || (profile.login as string),
    login: profile.login as string,
    bio: (profile.bio as string) ?? "",
    avatarSrc: avatarFile,
    repos: profile.public_repos as number,
    stars,
    followers: profile.followers as number,
    languages,
    topRepo,
    url: `github.com/${profile.login}`,
  };

  // codegen a scene that feeds the data to the template, then render
  const genPath = join(HERE, "_gen.ts");
  await writeFile(
    genPath,
    `import { buildGhScene } from "./template.js";\nexport default buildGhScene(${JSON.stringify(data)});\n`,
  );
  const out = join(ROOT, "out", `gh-${user}.mp4`);
  console.log(`rendering → out/gh-${user}.mp4`);
  await exec("npx", ["tsx", join(ROOT, "packages", "render-cli", "src", "reframe.ts"), "render", genPath, "-o", out, "--no-audio"]);
  console.log(`\n✓ out/gh-${user}.mp4 — post it, tag @reframe`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
