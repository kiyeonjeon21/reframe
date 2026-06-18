import { mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composite, dataUrl } from "../src/diff.js";

// a tiny 4x4 red PNG as the "reference"
const PNG_4PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR42mP8z8BQz0AEYBxVSF8AGdMD/4Cq2HwAAAAASUVORK5CYII=",
  "base64",
);
const isPng = (b: Buffer) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

describe("reframe diff — composite", () => {
  it("grid mode overlays a grid on the reference alone (no scene)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reframe-diff-"));
    const out = join(dir, "grid.png");
    await composite(dataUrl(PNG_4PX, ".png"), null, "grid", out);
    const buf = await readFile(out);
    expect(isPng(buf)).toBe(true);
    expect((await stat(out)).size).toBeGreaterThan(0);
  }, 30_000);

  it("diff mode composites reference and render", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reframe-diff-"));
    const refPath = join(dir, "ref.png");
    await writeFile(refPath, PNG_4PX);
    const out = join(dir, "diff.png");
    await composite(dataUrl(PNG_4PX, ".png"), dataUrl(PNG_4PX, ".png"), "diff", out);
    expect(isPng(await readFile(out))).toBe(true);
  }, 30_000);
});
