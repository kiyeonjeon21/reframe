import { describe, expect, it } from "vitest";
import { scene, group, rect, text } from "../src/dsl.js";
import { devicePreset, deviceScreen, deviceScreenCenter, deviceBounds, DEVICE_PRESET_NAMES } from "../src/devicePreset.js";
import { validateScene } from "../src/validate.js";

type Grp = Extract<import("../src/ir.js").NodeIR, { type: "group" }>;
const asGroup = (n: import("../src/ir.js").NodeIR) => n as Grp;

describe("devicePreset", () => {
  it("every device → a group with the id prefix, a clipped screen + a content handle", () => {
    for (const name of DEVICE_PRESET_NAMES) {
      const n = asGroup(devicePreset(name, { id: "d" }));
      expect(n.type).toBe("group");
      expect(n.id).toBe("d");
      const screen = asGroup(n.children.find((c) => c.id === "d-screen")!);
      expect(screen.props.clip).toBeDefined();
      expect(screen.props.clip!.width).toBeGreaterThan(0);
      expect(screen.props.clip!.height).toBeGreaterThan(0);
      expect(screen.children.some((c) => c.id === "d-content")).toBe(true);
    }
  });

  it("content is nested inside the clipped screen", () => {
    const probe = rect({ id: "probe", x: 0, y: 0, width: 10, height: 10, fill: "#fff" });
    const n = asGroup(devicePreset("phone", { id: "d", content: [probe] }));
    const content = asGroup(asGroup(n.children.find((c) => c.id === "d-screen")!).children.find((c) => c.id === "d-content")!);
    expect(content.children).toContainEqual(probe);
  });

  it("deviceScreen bounds are positive; landscape transposes phone/tablet", () => {
    for (const name of DEVICE_PRESET_NAMES) {
      const b = deviceScreen(name);
      expect(b.width).toBeGreaterThan(0);
      expect(b.height).toBeGreaterThan(0);
    }
    const p = deviceScreen("phone");
    const l = deviceScreen("phone", { orientation: "landscape" });
    expect(l.width).toBe(p.height);
    expect(l.height).toBe(p.width);
    // a non-orientable device ignores the knob
    expect(deviceScreen("laptop", { orientation: "landscape" })).toEqual(deviceScreen("laptop"));
  });

  it("is reproducible — same (name, opts) → identical JSON", () => {
    for (const name of DEVICE_PRESET_NAMES) {
      const a = JSON.stringify(devicePreset(name, { id: "d", x: 100, scale: 0.8, color: "light", url: "reframe.video" }));
      const b = JSON.stringify(devicePreset(name, { id: "d", x: 100, scale: 0.8, color: "light", url: "reframe.video" }));
      expect(a).toBe(b);
    }
  });

  it("a scene built from a device passes validateScene (unique ids, valid clip)", () => {
    const card = group({ id: "card", x: 0, y: 0 }, [text({ id: "t", x: 0, y: 0, content: "hi", fontFamily: "Inter", fontSize: 20 })]);
    const s = scene({ id: "s", size: { width: 1920, height: 1080 }, nodes: [devicePreset("phone", { id: "hero", x: 960, y: 540, content: [card] })] });
    expect(() => validateScene(s)).not.toThrow();
  });

  it("two same-prefix instances collide (each instance needs a distinct id)", () => {
    expect(() =>
      scene({ id: "s", size: { width: 100, height: 100 }, nodes: [devicePreset("phone"), devicePreset("browser")] }),
    ).toThrow(/duplicate node id/);
  });

  it("ships ten devices; every one builds a valid clipped scene", () => {
    expect(DEVICE_PRESET_NAMES).toHaveLength(10);
    for (const name of DEVICE_PRESET_NAMES) {
      const s = scene({ id: "s", size: { width: 1920, height: 1080 }, nodes: [devicePreset(name, { id: "d" })] });
      expect(() => validateScene(s)).not.toThrow();
    }
  });

  it("deviceBounds + deviceScreenCenter are finite; bounds enclose the screen", () => {
    for (const name of DEVICE_PRESET_NAMES) {
      const b = deviceBounds(name);
      const s = deviceScreen(name);
      const c = deviceScreenCenter(name);
      expect(b.width).toBeGreaterThanOrEqual(s.width);
      expect(b.height).toBeGreaterThan(0);
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    }
    // a chassis that offsets its panel reports a non-zero centre
    expect(deviceScreenCenter("laptop").y).toBeLessThan(0);
    expect(deviceScreenCenter("browser").y).toBeGreaterThan(0);
    expect(deviceScreenCenter("phone")).toEqual({ x: 0, y: 0 });
  });

  it("a long browser url is truncated (deterministic, no overflow)", () => {
    const long = "reframe.video/" + "x".repeat(200);
    const n = asGroup(devicePreset("browser", { id: "d", url: long }));
    const url = n.children.find((c) => c.id === "d-urltext") as Extract<import("../src/ir.js").NodeIR, { type: "text" }>;
    expect(String(url.props.content).length).toBeLessThanOrEqual(70);
    expect(String(url.props.content).endsWith("…")).toBe(true);
  });

  // ── redesign: material / style / seeded variation ──

  const bodyOf = (n: ReturnType<typeof asGroup>, id: string) =>
    n.children.find((c) => c.id === `${id}-body`) as Extract<import("../src/ir.js").NodeIR, { type: "rect" }>;

  it("is premium by default — the phone body has a gradient fill + a contact shadow", () => {
    const n = asGroup(devicePreset("phone", { id: "d" }));
    const body = bodyOf(n, "d");
    expect(typeof body.props.fill).toBe("object"); // a Gradient, not a string
    expect(body.props.shadowColor).toBeDefined();
  });

  it("material:'flat' opts out — solid string fill, no shadow (golden-style)", () => {
    const n = asGroup(devicePreset("phone", { id: "d", material: "flat" }));
    const body = bodyOf(n, "d");
    expect(typeof body.props.fill).toBe("string");
    expect(body.props.shadowColor).toBeUndefined();
    expect(body.props.blur).toBeUndefined();
  });

  it("flat and premium both keep the stable ${id}-screen (clip) + ${id}-content", () => {
    for (const material of ["flat", "premium"] as const) {
      for (const style of ["glass", "neon"] as const) {
        const n = asGroup(devicePreset("phone", { id: "d", material, style }));
        const screen = asGroup(n.children.find((c) => c.id === "d-screen")!);
        expect(screen.props.clip).toBeDefined();
        expect(screen.children.some((c) => c.id === "d-content")).toBe(true);
      }
    }
  });

  it("style:'neon' validates and gives the body an additive glow", () => {
    const n = asGroup(devicePreset("phone", { id: "d", style: "neon" }));
    const body = bodyOf(n, "d");
    expect(body.props.shadowColor).toBeDefined();
    // neon body fill stays a solid (the accent rides the stroke + glow, not a gradient)
    expect(typeof body.props.fill).toBe("string");
    const s = scene({ id: "s", size: { width: 1920, height: 1080 }, nodes: [devicePreset("phone", { id: "d", style: "neon" })] });
    expect(() => validateScene(s)).not.toThrow();
  });

  it("auto-varies from id: a fixed seed is identical across ids; default differs by id", () => {
    // explicit seed pins the variation regardless of id
    const a = JSON.stringify(asGroup(devicePreset("phone", { id: "x", seed: 7 })).children).replace(/"x-/g, '"@-');
    const b = JSON.stringify(asGroup(devicePreset("phone", { id: "y", seed: 7 })).children).replace(/"y-/g, '"@-');
    expect(a).toBe(b);
    // without a seed, two different ids land on different variations (cosmetic, bounded)
    const p = JSON.stringify(asGroup(devicePreset("phone", { id: "alpha" })).children).replace(/"alpha-/g, '"@-');
    const q = JSON.stringify(asGroup(devicePreset("phone", { id: "bravo" })).children).replace(/"bravo-/g, '"@-');
    expect(p).not.toBe(q);
  });

  it("seed changes the output within the same family (different seed → different bytes)", () => {
    const s1 = JSON.stringify(devicePreset("phone", { id: "d", seed: 1 }));
    const s2 = JSON.stringify(devicePreset("phone", { id: "d", seed: 2 }));
    expect(s1).not.toBe(s2);
    // but a seed is reproducible
    expect(JSON.stringify(devicePreset("phone", { id: "d", seed: 1 }))).toBe(s1);
  });

  it("notch styles all keep the ${id}-notch address; 'none' omits it", () => {
    for (const notch of ["island", "notch", "punch"] as const) {
      const n = asGroup(devicePreset("phone", { id: "d", notch }));
      expect(n.children.some((c) => c.id === "d-notch")).toBe(true);
    }
    const none = asGroup(devicePreset("phone", { id: "d", notch: "none" }));
    expect(none.children.some((c) => c.id === "d-notch")).toBe(false);
  });

  it("screen dims are unchanged by the redesign (content-authoring contract)", () => {
    expect(deviceScreen("phone")).toEqual({ x: 0, y: 0, width: 352, height: 736, radius: 38 });
    expect(deviceScreenCenter("browser")).toEqual({ x: 0, y: 24 });
    // dims do not depend on material/style/seed
    expect(deviceScreen("phone", { material: "flat", seed: 99 })).toEqual(deviceScreen("phone"));
  });
});
