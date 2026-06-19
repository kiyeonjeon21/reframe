/**
 * `reframe frame` core: renderFrameAt renders ONE frame at time t to PNG bytes
 * (same renderer as the mp4 path, no ffmpeg muxing).
 */
import { describe, expect, it } from "vitest";
import { renderFrameAt } from "../src/frameLoop.js";
import lowerThird from "../../../examples/scenes/lower-third.js";

describe("renderFrameAt (the `frame` command core)", () => {
  it("renders a single frame at time t to a PNG buffer", async () => {
    const buf = await renderFrameAt(lowerThird, 0.5);
    // PNG magic number: 89 50 4E 47
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(buf.length).toBeGreaterThan(1000);
  }, 60_000);

  it("renders different content at different times (the frame reflects t)", async () => {
    const [a, b] = await Promise.all([renderFrameAt(lowerThird, 0), renderFrameAt(lowerThird, 0.5)]);
    expect(a.equals(b)).toBe(false);
  }, 60_000);
});
