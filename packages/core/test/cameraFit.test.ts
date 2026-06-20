import { describe, expect, it } from "vitest";
import { cameraFit } from "../src/camera.js";

// The visible scene rect under a camera is `W/zoom × H/zoom` centred on (x,y).
// cameraFit must return props whose visible rect CONTAINS the box + margin.
const W = 1920, H = 1080;
const visible = (cam: { x: number; y: number; zoom: number }) => ({
  left: cam.x - W / (2 * cam.zoom),
  right: cam.x + W / (2 * cam.zoom),
  top: cam.y - H / (2 * cam.zoom),
  bottom: cam.y + H / (2 * cam.zoom),
});

describe("cameraFit", () => {
  it("frames a box centred, with the box + margin fully inside the visible rect", () => {
    const box = { x: 200, y: 760, width: 740, height: 360 };
    const m = 90;
    const cam = cameraFit(box, { margin: m });
    // centred on the box
    expect(cam.x).toBeCloseTo(box.x + box.width / 2, 6);
    expect(cam.y).toBeCloseTo(box.y + box.height / 2, 6);
    // box + margin fits inside the viewport (no clip), within fp tolerance
    const v = visible(cam);
    expect(v.left).toBeLessThanOrEqual(box.x - m + 1e-6);
    expect(v.right).toBeGreaterThanOrEqual(box.x + box.width + m - 1e-6);
    expect(v.top).toBeLessThanOrEqual(box.y - m + 1e-6);
    expect(v.bottom).toBeGreaterThanOrEqual(box.y + box.height + m - 1e-6);
  });

  it("zooms OUT (zoom < 1) to fit a box wider than the frame", () => {
    const cam = cameraFit({ x: 0, y: 0, width: 3000, height: 1600 }, { margin: 50 });
    expect(cam.zoom).toBeLessThan(1);
    const v = visible(cam);
    expect(v.right - v.left).toBeGreaterThanOrEqual(3000 + 100 - 1e-6);
  });

  it("clamps a tiny box by maxZoom instead of zooming absurdly close", () => {
    const cam = cameraFit({ x: 950, y: 530, width: 20, height: 20 }, { margin: 10, maxZoom: 2.4 });
    expect(cam.zoom).toBe(2.4);
  });

  it("is deterministic and respects a custom frame size", () => {
    const a = cameraFit({ x: 0, y: 0, width: 100, height: 100 }, { size: { width: 1080, height: 1920 }, margin: 40 });
    const b = cameraFit({ x: 0, y: 0, width: 100, height: 100 }, { size: { width: 1080, height: 1920 }, margin: 40 });
    expect(a).toEqual(b);
    // portrait frame: fit is bounded by width (1080/(100+80))
    expect(a.zoom).toBeCloseTo(Math.min(1080 / 180, 1920 / 180, 2.4), 6);
  });
});
