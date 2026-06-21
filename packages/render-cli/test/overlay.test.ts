import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rect, scene, type OverlayDoc } from "@reframe/core";
import { describe, expect, it } from "vitest";
import { applyOverlays } from "../src/overlay.js";

const base = () =>
  scene({
    id: "b",
    size: { width: 100, height: 100 },
    fps: 30,
    nodes: [rect({ id: "box", x: 0, y: 0, width: 10, height: 10, fill: "#000000" })],
  });

async function tmpOverlay(doc: OverlayDoc): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "reframe-ov-"));
  const p = join(dir, "ov.json");
  await writeFile(p, JSON.stringify(doc));
  return p;
}

const fillOf = (ir: ReturnType<typeof base>) =>
  (ir.nodes.find((n) => n.id === "box")!.props as { fill?: string }).fill;

describe("applyOverlays (the shared compose path for render/compose/frame/player)", () => {
  it("composes overlay file(s) onto the IR and patches props", async () => {
    const p = await tmpOverlay({ reframeOverlay: 1, target: "b", nodes: { box: { fill: "#FF0000" } } } as OverlayDoc);
    const { ir, report } = await applyOverlays(base(), [p]);
    expect(fillOf(ir)).toBe("#FF0000");
    expect(report.applied).toHaveLength(1);
    expect(report.orphans).toHaveLength(0);
  });

  it("reports an unknown address as an orphan (non-throwing) and still applies the rest", async () => {
    const p = await tmpOverlay({
      reframeOverlay: 1,
      target: "b",
      nodes: { nope: { fill: "#FF0000" }, box: { fill: "#00FF00" } },
    } as OverlayDoc);
    const { ir, report } = await applyOverlays(base(), [p]);
    expect(fillOf(ir)).toBe("#00FF00"); // the valid patch applied
    expect(report.orphans).toHaveLength(1);
    expect(report.orphans[0]!.address).toContain("nope");
  });

  it("no overlays → unchanged IR + empty report", async () => {
    const ir0 = base();
    const { ir, report } = await applyOverlays(ir0, []);
    expect(ir).toBe(ir0);
    expect(report.applied).toHaveLength(0);
    expect(report.orphans).toHaveLength(0);
  });
});
