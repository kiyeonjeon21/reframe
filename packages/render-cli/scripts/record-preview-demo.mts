import { chromium } from "playwright";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: "/tmp/preview-rec", size: { width: 1600, height: 1000 } },
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5199/");
  await page.waitForSelector("#scene-select option", { state: "attached" });
  await page.selectOption("#scene-select", { label: "logo-reveal" });
  await page.waitForFunction(() => (window as any).__store?.compiled?.ir?.id === "logo-reveal");
  await sleep(600);

  // live overlay-draft HUD: the actual exportDraft() content, visualized
  // (string form: tsx's esbuild transform injects __name helpers that don't
  // exist in the page context)
  await page.evaluate(`(() => {
    const hud = document.createElement("pre");
    hud.id = "hud";
    hud.style.cssText =
      "position:fixed;left:16px;bottom:64px;max-width:560px;background:rgba(10,12,16,.92);color:#7CE8C4;font:12px/1.5 ui-monospace,monospace;padding:12px 16px;border-radius:8px;border:1px solid #2a3a3a;z-index:99;white-space:pre-wrap;";
    const title = document.createElement("div");
    title.textContent = "overlay draft (your edits — the scene file is untouched)";
    title.style.cssText = "color:#8a93a8;font:11px system-ui;margin-bottom:6px;";
    hud.appendChild(title);
    const body = document.createElement("div");
    hud.appendChild(body);
    document.body.appendChild(hud);
    const store = window.__store;
    const update = () => { body.textContent = JSON.stringify(store.exportDraft(), null, 1); };
    store.subscribe(update);
    update();
  })()`);

  await sleep(400);
  // play a moment
  await page.click("#play");
  await sleep(2000);
  await page.click("#play");
  await sleep(400);

  // select the disc and turn knobs
  await page.locator(".tree-item", { hasText: "disc" }).first().click();
  await page.waitForSelector("h3:has-text('Props: disc')");
  await sleep(700);
  const fillRow = page.locator(".prop-row", { has: page.locator("label", { hasText: /^fill/ }) });
  await fillRow.locator("input[type=color]").fill("#00C2A8");
  await sleep(1200);
  await fillRow.locator("input[type=color]").fill("#E11D48");
  await sleep(1200);

  // retime the labeled step
  const durRow = page.locator(".step-card", { hasText: "reveal" }).locator(".prop-row", { hasText: "duration" });
  await durRow.locator("input").fill("1.4");
  await durRow.locator("input").press("Enter");
  await sleep(1100);

  // scrub through the result
  const scrub = page.locator("#scrub");
  for (const v of [0.1, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8]) {
    await scrub.evaluate((el: HTMLInputElement, val) => {
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
    await sleep(180);
  }
  await sleep(1400);

  await ctx.close();
  await browser.close();
  console.log("recorded");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
