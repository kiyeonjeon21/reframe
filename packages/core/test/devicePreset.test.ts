import { describe, expect, it } from "vitest";
import { scene, group, rect, text } from "../src/dsl.js";
import { devicePreset, deviceScreen, DEVICE_PRESET_NAMES } from "../src/devicePreset.js";
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

  it("a long browser url is truncated (deterministic, no overflow)", () => {
    const long = "reframe.video/" + "x".repeat(200);
    const n = asGroup(devicePreset("browser", { id: "d", url: long }));
    const url = n.children.find((c) => c.id === "d-urltext") as Extract<import("../src/ir.js").NodeIR, { type: "text" }>;
    expect(String(url.props.content).length).toBeLessThanOrEqual(70);
    expect(String(url.props.content).endsWith("…")).toBe(true);
  });
});
