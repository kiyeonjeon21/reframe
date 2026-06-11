import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const inter = readFileSync("assets/fonts/inter-700.woff2").toString("base64");
const caps: [string, string][] = [
  ["cap-hook.png", "Motion graphics, declared as data — written by you <span style='color:#8a93a8'>or by your AI</span>"],
  ["cap-preview.png", "Turn knobs in the live preview — every edit writes an <span style='color:#7CE8C4'>overlay</span>, never your scene file"],
  ["cap-term.png", "Ask your AI to redesign the scene — your edits reapply by stable address; breaks are <span style='color:#FFB454'>loud</span>, never silent"],
  ["cap-audio1.png", "Sound design is anchored to <span style='color:#7CE8C4'>timeline labels</span> — here the shatter hits at 4.0s"],
  ["cap-audio2.png", "Retimed +1.8s with a one-line overlay — <span style='color:#7CE8C4'>every cue follows the motion</span>"],
  ["cap-batch.png", "One template × a data file = N personalized videos — row keys are overlay addresses"],
  ["cap-nl.png", "This teaser was built from <span style='color:#7CE8C4'>5 vague prompts</span> in Claude Code — no code edited by hand"],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 72 } });
for (const [file, html] of caps) {
  await page.setContent(`<style>
    @font-face { font-family: Inter; font-weight: 700; src: url(data:font/woff2;base64,${inter}) format("woff2"); }
    body { margin:0; width:1920px; height:72px; background:rgba(8,9,12,0.84); display:flex; align-items:center; justify-content:center; }
    div { font:700 30px Inter; color:#fff; letter-spacing:0.2px; }
  </style><body><div>${html}</div></body>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `/tmp/${file}` });
}
// dual strip for the survival hstack
await page.setContent(`<style>
  @font-face { font-family: Inter; font-weight: 700; src: url(data:font/woff2;base64,${inter}) format("woff2"); }
  body { margin:0; width:1920px; height:72px; background:rgba(8,9,12,0.84); display:flex; align-items:center; }
  div { font:700 27px Inter; color:#fff; width:960px; text-align:center; }
</style><body><div>1 — your hand edits, applied via overlay</div><div>2 — AI <span style='color:#FFB454'>regenerated</span> the scene → same overlay</div></body>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "/tmp/cap-survival.png" });
await browser.close();
console.log("captions done");
