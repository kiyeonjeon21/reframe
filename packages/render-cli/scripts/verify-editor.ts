/**
 * Drive the preview editor with Playwright and assert the core scenarios:
 * scope-expanded rows, keyed merge on repeated edits, export shape, timeline
 * patch re-inferring duration, loud orphans on a mismatched import, revert.
 *
 *   npx tsx packages/preview/scripts/verify-editor.ts [port]
 */

import { chromium } from "playwright";

const PORT = process.argv[2] ?? "5199";
const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, ...(detail !== undefined && { detail }) });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("dialog", (d) => void d.accept());
  await page.goto(`http://localhost:${PORT}/`);

  // load logo-reveal (states + timeline labels + behaviors)
  await page.selectOption("#scene-select", { label: "logo-reveal" });
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".tree-item")].some((n) => n.textContent?.includes("disc")),
  );

  // 1. select disc, edit fill via color input
  await page.locator(".tree-item", { hasText: "disc" }).click();
  await page.waitForSelector("h3:has-text('Props: disc')");
  const fillRow = page.locator(".prop-row", { has: page.locator("label", { hasText: /^fill/ }) });
  await fillRow.locator("input[type=color]").fill("#3b82f6");
  let draft = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { __store: { draft: unknown } }).__store?.draft ?? null)));
  check("color edit writes nodes.disc.fill", (draft as { nodes?: { disc?: { fill?: string } } })?.nodes?.disc?.fill === "#3b82f6", JSON.stringify(draft));

  // 2. scope expansion: tagline y(base) disabled + state rows
  await page.locator(".tree-item", { hasText: "tagline" }).click();
  await page.waitForSelector("h3:has-text('Props: tagline')");
  const deadRow = page.locator(".prop-row.dead").filter({
    has: page.locator("label", { hasText: /^y \(base\)/ }),
  });
  check("y (base) row disabled with hint", (await deadRow.count()) === 1 && (await page.locator(".hint", { hasText: "overridden by initial" }).count()) >= 1);
  const revealedY = page.locator(".prop-row", { has: page.locator(".scope", { hasText: "@revealed" }) }).filter({ hasText: /^y/ });
  check("y @revealed row exists", (await revealedY.count()) === 1);

  // 3. repeated edits keep one key (keyed merge)
  const yInput = revealedY.locator("input");
  for (const v of ["220", "225", "230"]) await yInput.fill(v);
  draft = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { __store: { draft: { states?: Record<string, Record<string, Record<string, number>>> } } }).__store.draft)));
  const states = (draft as { states?: Record<string, Record<string, Record<string, number>>> }).states;
  check("3 edits -> single key, last value", states?.revealed?.tagline?.y === 230, JSON.stringify(states));

  // 4. timeline patch re-infers duration
  const before = await page.locator("#time").textContent();
  const durRow = page.locator(".step-card", { hasText: "reveal" }).locator(".prop-row", { hasText: "duration" });
  await durRow.locator("input").fill("1.4");
  const after = await page.locator("#time").textContent();
  // base 3.760 (1.06 staggered reveal + 2.2 hold + 0.5 exit) -> 4.460 with reveal at 1.4
  check("reveal duration 0.7->1.4 re-infers scene length", before!.includes("3.760") && after!.includes("4.460"), `${before} -> ${after}`);

  // 5. export shape
  const exported = await page.evaluate(() =>
    JSON.parse(JSON.stringify((window as never as { __store: { exportDraft(): unknown } }).__store.exportDraft())),
  ) as Record<string, unknown>;
  check(
    "export has name/target and all three sections",
    exported.reframeOverlay === 1 &&
      exported.target === "logo-reveal" &&
      Boolean(exported.nodes) && Boolean(exported.states) && Boolean(exported.timeline),
    JSON.stringify(exported).slice(0, 200),
  );

  // 6. revert removes the key and prunes
  await page.locator(".tree-item", { hasText: "disc" }).first().click();
  await page.waitForSelector("h3:has-text('Props: disc')");
  await page.locator(".prop-row.edited", { hasText: /^fill/ }).locator(".revert").click();
  draft = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { __store: { draft: { nodes?: object } } }).__store.draft)));
  check("revert prunes nodes section", !("disc" in ((draft as { nodes?: Record<string, unknown> }).nodes ?? {})), JSON.stringify(draft));

  // 7. import a mismatched overlay -> loud orphans (use brand-edits against kinetic-typo)
  await page.evaluate(async () => {
    const res = await fetch("/__overlay-fixture");
    void res;
  }).catch(() => {});
  // import via store API with a fabricated mismatched doc (simpler than file chooser)
  const orphanInfo = await page.evaluate(() => {
    const w = window as never as { __store: { importDraft(d: unknown): void; report: { orphans: unknown[]; warnings: unknown[] } } };
    w.__store.importDraft({
      reframeOverlay: 1,
      name: "mismatch",
      target: "some-other-scene",
      nodes: { ghost: { opacity: 0.5 }, disc: { fill: "#ff0000" } },
    });
    return {
      orphans: w.__store.report.orphans.length,
      warnings: w.__store.report.warnings.length,
    };
  });
  check("mismatched import -> 1 orphan + 1 warning", orphanInfo.orphans === 1 && orphanInfo.warnings === 1, JSON.stringify(orphanInfo));
  const orphanVisible = await page.locator("#report .orphan").count();
  const warningVisible = await page.locator("#report .warning").count();
  check("orphans/warnings visibly rendered in panel", orphanVisible === 1 && warningVisible === 1);

  // 8. invalid duration -> error shown, last-good kept, recovers
  const recovered = await page.evaluate(() => {
    const w = window as never as {
      __store: {
        setSceneProp(k: string, v: number): void;
        unsetSceneProp(k: string): void;
        composeError: string | null;
        compiled: { duration: number };
      };
    };
    w.__store.setSceneProp("duration", -1);
    const errored = w.__store.composeError !== null;
    const lastGood = w.__store.compiled.duration > 0;
    w.__store.unsetSceneProp("duration");
    const cleared = w.__store.composeError === null;
    return { errored, lastGood, cleared };
  });
  check("invalid duration -> error + last-good + recovery", recovered.errored && recovered.lastGood && recovered.cleared, JSON.stringify(recovered));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
