// GitHub year flythrough probe: `tsx generate.mts <handle> [-o out.mp4]`.
// Scrapes the PUBLIC contributions calendar (no auth/token), reconstructs the
// week grid + metrics, then bakes the data into a scene and renders it with the
// reframe CLI. Fetch once → bake → deterministic render (same boundary as
// labs/gh-video). A repo-only probe — NOT shipped in the npm package.

import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GitHubYearData } from "./buildScene.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_UP = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: "inherit", cwd: ROOT });
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))));
  });
}

/** Scrape github.com/users/<handle>/contributions → per-day {date, count}. */
async function fetchContributions(handle: string): Promise<{ date: string; count: number }[]> {
  const url = `https://github.com/users/${encodeURIComponent(handle)}/contributions`;
  const r = await fetch(url, { headers: { "User-Agent": "reframe-gh-year-probe", Accept: "text/html" } });
  if (!r.ok) throw new Error(`GitHub returned ${r.status} ${r.statusText} for ${handle}`);
  const html = await r.text();

  // id → count, parsed from the tooltip text ("N contributions on …" / "No contributions on …")
  const countById = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="(contribution-day-component-[\d-]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const text = m[2]!.trim();
    const n = /^(\d[\d,]*)\s+contribution/.test(text) ? Number(text.match(/^([\d,]+)/)![1]!.replace(/,/g, "")) : 0;
    countById.set(m[1]!, n);
  }
  // each day cell carries data-date + id
  const days: { date: string; count: number }[] = [];
  for (const m of html.matchAll(/<td[^>]*class="[^"]*ContributionCalendar-day[^"]*"[^>]*>/g)) {
    const tag = m[0]!;
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const id = tag.match(/id="(contribution-day-component-[\d-]+)"/)?.[1];
    if (!date || !id) continue;
    days.push({ date, count: countById.get(id) ?? 0 });
  }
  if (days.length === 0) throw new Error(`no contribution cells found for ${handle} (private profile or markup changed?)`);
  days.sort((a, b) => a.date.localeCompare(b.date));
  return days;
}

/** Reconstruct the 7×N week grid + metrics from the day list (order-independent, by date). */
function toYearData(handle: string, days: { date: string; count: number }[]): GitHubYearData {
  const dayMs = 86400000;
  const first = new Date(days[0]!.date + "T00:00:00Z");
  // GitHub aligns the calendar to Sunday; back up to the Sunday on/before the first day
  const firstSunday = new Date(first.getTime() - first.getUTCDay() * dayMs);
  const weeks: number[][] = [];
  for (const { date, count } of days) {
    const d = new Date(date + "T00:00:00Z");
    const w = Math.floor((d.getTime() - firstSunday.getTime()) / (7 * dayMs));
    const wd = d.getUTCDay();
    (weeks[w] ??= [0, 0, 0, 0, 0, 0, 0])[wd] = count;
  }
  for (let w = 0; w < weeks.length; w++) weeks[w] ??= [0, 0, 0, 0, 0, 0, 0];

  // months: first week index each month appears
  const months: { label: string; week: number }[] = [];
  let lastKey = "";
  for (const { date } of days) {
    const d = new Date(date + "T00:00:00Z");
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    if (key !== lastKey) {
      const w = Math.floor((d.getTime() - firstSunday.getTime()) / (7 * dayMs));
      months.push({ label: `${MONTH_UP[d.getUTCMonth()]} ${d.getUTCFullYear()}`, week: w });
      lastKey = key;
    }
  }

  const total = days.reduce((s, x) => s + x.count, 0);
  let maxDay = 0, busiest = days[0]!.date;
  for (const x of days) if (x.count > maxDay) { maxDay = x.count; busiest = x.date; }
  const bd = new Date(busiest + "T00:00:00Z");
  const busiestLabel = `${MONTH_ABBR[bd.getUTCMonth()]} ${bd.getUTCDate()}`;
  // longest run of consecutive days with > 0 (days are sorted, one per date)
  let longestStreak = 0, cur = 0;
  for (const x of days) { cur = x.count > 0 ? cur + 1 : 0; if (cur > longestStreak) longestStreak = cur; }

  return { handle: handle.startsWith("@") ? handle : `@${handle}`, total, maxDay, longestStreak, busiest: busiestLabel, weeks, months };
}

async function main() {
  const args = process.argv.slice(2);
  const handle = args.find((a) => !a.startsWith("-"));
  if (!handle) {
    console.error("usage: tsx generate.mts <github-handle> [-o out.mp4]");
    process.exit(2);
  }
  const oIdx = args.indexOf("-o");
  const out = oIdx >= 0 ? args[oIdx + 1]! : join(ROOT, "out", `gh-year-${handle}.mp4`);

  console.log(`fetching @${handle}'s contributions…`);
  const days = await fetchContributions(handle);
  const data = toYearData(handle, days);
  console.log(`  ${data.total.toLocaleString()} contributions · busiest ${data.busiest} (${data.maxDay}) · ${data.longestStreak}-day streak · ${data.weeks.length} weeks`);

  const genPath = join(HERE, "_gen.ts");
  await writeFile(
    genPath,
    `import { buildGitHubYear } from "./buildScene.js";\nexport default buildGitHubYear(${JSON.stringify(data)});\n`,
  );
  await mkdir(dirname(out), { recursive: true });
  console.log(`rendering → ${out}`);
  await run("npx", ["tsx", join(ROOT, "packages", "render-cli", "src", "reframe.ts"), "render", genPath, "-o", out]);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
