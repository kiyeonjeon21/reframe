import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { image, scene } from "@reframe/core";
import { buildImageAssets } from "../src/images.js";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const sceneWith = (src: string) =>
  scene({
    id: "t",
    size: { width: 10, height: 10 },
    nodes: [image({ id: "a", src, x: 0, y: 0, width: 10, height: 10 })],
  });

describe("buildImageAssets", () => {
  it("resolves scene-relative srcs into data URLs keyed by raw src", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reframe-img-"));
    await writeFile(join(dir, "p.png"), PNG_1PX);
    const assets = await buildImageAssets(sceneWith("p.png"), dir);
    expect(Object.keys(assets)).toEqual(["p.png"]);
    expect(assets["p.png"]).toMatch(/^data:image\/png;base64,/);
  });

  it("fails loudly with every tried path when the file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reframe-img-"));
    await expect(buildImageAssets(sceneWith("plates/nope.png"), dir)).rejects.toThrow(
      `image "plates/nope.png" not found (tried: ${resolve(dir, "plates/nope.png")})`,
    );
  });

  it("rejects unsupported formats naming the supported ones", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reframe-img-"));
    await expect(buildImageAssets(sceneWith("vector.svg"), dir)).rejects.toThrow(
      /unsupported format ".svg" — supported: .png .jpg .jpeg .webp/,
    );
  });
});
