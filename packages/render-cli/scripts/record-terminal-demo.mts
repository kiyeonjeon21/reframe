import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// real outputs from `pnpm reframe demo` (brand-edits overlay), lightly trimmed
type Line = [cls: string, text: string];
const SCRIPT: { cmd?: string; lines: Line[]; pause: number }[] = [
  {
    cmd: "npx reframe-video render scene.ts --overlay my-edits.json",
    lines: [
      ["dim", "compose: 5 applied, 0 orphaned, 0 warnings"],
      ["ok", "  ✓ [my-edits] nodes.disc.fill (set)"],
      ["ok", "  ✓ [my-edits] nodes.tagline.content (set)"],
      ["ok", "  ✓ [my-edits] timeline.reveal.duration (set)"],
      ["ok", "  ✓ [my-edits] addNodes.watermark (add-node)"],
      ["out", "out/scene.mp4 (134 frames @ 30fps)"],
    ],
    pause: 1100,
  },
  {
    lines: [
      ["comment", ""],
      ["comment", '# you ask your AI: "redesign it — bolder, horizontal lockup"'],
      ["comment", "# it rewrites scene.ts completely (regen contract: ids/labels survive)"],
      ["comment", ""],
    ],
    pause: 1300,
  },
  {
    cmd: "npx reframe-video render scene.ts --overlay my-edits.json",
    lines: [
      ["dim", "compose: 4 applied, 1 orphaned, 0 warnings"],
      ["ok", "  ✓ [my-edits] nodes.disc.fill (set)"],
      ["ok", "  ✓ [my-edits] timeline.reveal.duration (set)"],
      ["ok", "  ✓ [my-edits] addNodes.watermark (add-node)"],
      ["bad", '  ✗ [my-edits] nodes.tagline: unknown node "tagline" — did the base regeneration rename it?'],
      ["out", "out/scene.mp4 (138 frames @ 30fps)"],
    ],
    pause: 2200,
  },
];

const keyLog: number[] = [];
let t0 = 0;
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: "/tmp/term-rec", size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  await page.setContent(`<style>
    body { margin:0; background:#0B0D12; height:100vh; display:flex; align-items:center; justify-content:center; }
    #term { width: 1560px; height: 820px; background:#11141B; border-radius:14px; border:1px solid #232838;
            box-shadow: 0 24px 80px rgba(0,0,0,.6); padding: 22px 30px; box-sizing:border-box;
            font: 24px/1.62 ui-monospace, "SF Mono", Menlo, monospace; color:#D7DCE8; overflow:hidden; }
    #bar { display:flex; gap:9px; margin-bottom:18px; }
    #bar i { width:14px; height:14px; border-radius:50%; display:block; }
    .prompt { color:#7D9AFF; } .ok { color:#5BD6A2; } .bad { color:#FFB454; }
    .dim { color:#8A93A8; } .comment { color:#5A6275; font-style:italic; } .out { color:#fff; }
    .cursor { display:inline-block; width:12px; height:26px; background:#D7DCE8; vertical-align:-4px;
              animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style><body><div id="term"><div id="bar"><i style="background:#FF5F57"></i><i style="background:#FEBC2E"></i><i style="background:#28C840"></i></div><div id="lines"></div><span id="cur" class="cursor"></span></div></body>`);

  await sleep(700);
  t0 = Date.now();
  for (const block of SCRIPT) {
    if (block.cmd) {
      // type the command char by char into a new prompt line
      await page.evaluate(`(() => {
        const d = document.createElement("div");
        d.id = "active";
        d.innerHTML = '<span class="prompt">$ </span><span id="typed"></span>';
        document.getElementById("lines").appendChild(d);
      })()`);
      for (const ch of block.cmd) {
        await page.evaluate(
          `document.getElementById("typed").textContent += ${JSON.stringify(ch)}`,
        );
        keyLog.push((Date.now() - t0) / 1000);
        await sleep(ch === " " ? 30 : 17);
      }
      await page.evaluate(
        `(() => { document.getElementById("typed").id = ""; document.getElementById("active").id = ""; })()`,
      );
      await sleep(650);
    }
    for (const [cls, text] of block.lines) {
      await page.evaluate(`(() => {
        const d = document.createElement("div");
        d.className = ${JSON.stringify(cls)};
        d.textContent = ${JSON.stringify(text)} || "\\u00a0";
        document.getElementById("lines").appendChild(d);
      })()`);
      await sleep(135);
    }
    await sleep(block.pause);
  }
  await sleep(800);
  writeFileSync("/tmp/term-keys.json", JSON.stringify({ t0Offset: 0.7, keys: keyLog }));
  await ctx.close();
  await browser.close();
  console.log("recorded");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
