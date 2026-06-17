import { describe, expect, it } from "vitest";
import { compileScene } from "../src/compile.js";
import { image, scene } from "../src/dsl.js";
import { evaluate } from "../src/evaluate.js";
import { photoMontage, videoMontage } from "../src/montage.js";
import { SceneValidationError } from "../src/validate.js";
import type { NodeIR } from "../src/ir.js";

const size = { width: 1920, height: 1080 };
const imgs = ["a.jpg", "b.jpg", "c.jpg"];
const props = (n: NodeIR) => n.props as unknown as Record<string, unknown>;

describe("photoMontage", () => {
  it("emits one image layer per slide + two grade overlays, with stable ids", () => {
    const m = photoMontage(imgs, { seed: 1 });
    expect(m.nodes.map((n) => n.id)).toEqual(["shot-0", "shot-1", "shot-2", "shot-vignette", "shot-scrim"]);
    expect(m.nodes.filter((n) => n.type === "image")).toHaveLength(3);
  });

  it("grade:false drops the overlays; a custom id prefixes every address", () => {
    const m = photoMontage(imgs, { grade: false, id: "pic" });
    expect(m.nodes.map((n) => n.id)).toEqual(["pic-0", "pic-1", "pic-2"]);
  });

  it("slide 0 starts visible, the rest hidden (crossfade-driven)", () => {
    const m = photoMontage(imgs);
    expect(props(m.nodes[0]!).opacity).toBe(1);
    expect(props(m.nodes[1]!).opacity).toBe(0);
    expect(props(m.nodes[2]!).opacity).toBe(0);
  });

  it("carries stable shot-/cross- timeline labels", () => {
    const json = JSON.stringify(photoMontage(imgs).timeline);
    for (const l of ["shot-0", "shot-1", "shot-2", "cross-1", "cross-2"]) expect(json).toContain(l);
    expect(json).not.toContain("cross-0"); // slide 0 has no incoming crossfade
  });

  it("is deterministic — same (images, opts) → identical IR", () => {
    const a = JSON.stringify(photoMontage(imgs, { seed: 5 }));
    const b = JSON.stringify(photoMontage(imgs, { seed: 5 }));
    expect(a).toBe(b);
  });

  it("a different seed re-frames the montage", () => {
    const a = JSON.stringify(photoMontage(imgs, { seed: 1 }).timeline);
    const b = JSON.stringify(photoMontage(imgs, { seed: 2 }).timeline);
    expect(a).not.toBe(b);
  });

  it("renders to a finite, edge-covering transform across the whole timeline", () => {
    const m = photoMontage(imgs, { seed: 3, zoom: 1.2 });
    const s = scene({ id: "t", size, nodes: m.nodes, timeline: m.timeline });
    const c = compileScene(s);
    for (let f = 0; f <= 10; f++) {
      const t = (c.duration * f) / 10;
      for (const op of evaluate(c, t)) {
        for (const v of op.transform) expect(Number.isFinite(v)).toBe(true);
        // every image layer stays scaled >= 1 (the a/d matrix terms) so it always covers the frame
        if (op.id.startsWith("shot-") && op.id !== "shot-vignette" && op.id !== "shot-scrim") {
          const sx = Math.hypot(op.transform[0], op.transform[1]);
          expect(sx).toBeGreaterThanOrEqual(0.999);
        }
      }
    }
  });

  it("sets fit:cover on every image layer (no pre-crop needed)", () => {
    const m = photoMontage(imgs);
    for (const n of m.nodes.filter((x) => x.type === "image")) {
      expect(props(n).fit).toBe("cover");
    }
  });

  it("respects per-slide hold + ken overrides", () => {
    const m = photoMontage([{ src: "a.jpg", hold: 1, ken: "pan" }, "b.jpg"], { hold: 5 });
    const s = scene({ id: "t", size, nodes: m.nodes, timeline: m.timeline });
    // slide 0 held 1s, slide 1 held 5s → ~6s total
    expect(compileScene(s).duration).toBeGreaterThan(5.5);
    expect(compileScene(s).duration).toBeLessThan(6.5);
  });
});

describe("videoMontage (mixed media)", () => {
  it("is the same generator as photoMontage", () => {
    expect(videoMontage).toBe(photoMontage);
  });

  it("emits video layers for video srcs and image layers for stills", () => {
    const m = videoMontage(["a.jpg", "b.mp4", "c.png", "d.webm"], { grade: false, hold: 2 });
    expect(m.nodes.map((n) => n.type)).toEqual(["image", "video", "image", "video"]);
    // video layers keep fit:cover
    expect(props(m.nodes[1]!).fit).toBe("cover");
  });

  it("a clip's start = cumulative hold; muted by default; per-shot volume honored", () => {
    const m = videoMontage([{ src: "a.mp4", hold: 2 }, { src: "b.mp4", hold: 3, volume: 1 }], { grade: false });
    expect(props(m.nodes[0]!).start).toBe(0);
    expect(props(m.nodes[0]!).volume).toBe(0); // muted by default in a montage
    expect(props(m.nodes[1]!).start).toBe(2); // begins after the first shot's hold
    expect(props(m.nodes[1]!).volume).toBe(1);
  });

  it("is deterministic with mixed media", () => {
    const j = () => JSON.stringify(videoMontage(["a.mp4", "b.jpg", "c.mov"], { seed: 4 }));
    expect(j()).toBe(j());
  });
});

describe("image fit", () => {
  const at = (s: ReturnType<typeof scene>, id = "im") =>
    evaluate(compileScene(s), 0).find((o) => o.id === id) as unknown as Record<string, unknown>;

  it("an authored fit:cover lands on the image op", () => {
    const s = scene({ id: "a", size, nodes: [image({ id: "im", src: "x.jpg", x: 0, y: 0, width: 100, height: 100, fit: "cover" })] });
    expect(at(s).fit).toBe("cover");
  });

  it('absent / "fill" adds no fit field (byte-identity guard)', () => {
    const none = scene({ id: "a", size, nodes: [image({ id: "im", src: "x.jpg", x: 0, y: 0, width: 100, height: 100 })] });
    const fill = scene({ id: "b", size, nodes: [image({ id: "im", src: "x.jpg", x: 0, y: 0, width: 100, height: 100, fit: "fill" })] });
    expect(at(none).fit).toBeUndefined();
    expect(at(fill).fit).toBeUndefined();
  });

  it("validation rejects an unknown fit", () => {
    expect(() =>
      scene({ id: "a", size, nodes: [image({ id: "im", src: "x.jpg", x: 0, y: 0, width: 100, height: 100, fit: "stretch" as never })] }),
    ).toThrow(SceneValidationError);
  });
});
