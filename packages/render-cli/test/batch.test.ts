import { describe, expect, it } from "vitest";
import { overlayFromFlat, parseCsv } from "../src/batch.js";

describe("overlayFromFlat", () => {
  it("expands all four address prefixes", () => {
    const doc = overlayFromFlat(
      {
        "nodes.name.content": "Alice",
        "nodes.bar.fill": "#00C2A8",
        "states.shown.name.y": 12,
        "timeline.enter.duration": 0.9,
        "scene.background": "#000000",
      },
      "alice",
    );
    expect(doc).toEqual({
      reframeOverlay: 1,
      name: "alice",
      nodes: { name: { content: "Alice" }, bar: { fill: "#00C2A8" } },
      states: { shown: { name: { y: 12 } } },
      timeline: { enter: { duration: 0.9 } },
      scene: { background: "#000000" },
    });
  });

  it("ignores _name and other underscore-prefixed metadata, and empty values", () => {
    const doc = overlayFromFlat(
      { _name: "x", _segment: "vip", "nodes.a.fill": "#fff", "nodes.a.stroke": "" },
      "x",
    );
    expect(doc.nodes).toEqual({ a: { fill: "#fff" } });
  });

  it("rejects unknown prefixes and bad shapes with actionable errors", () => {
    expect(() => overlayFromFlat({ "node.a.fill": "#fff" }, "x")).toThrowError(
      /not a valid overlay address/,
    );
    expect(() => overlayFromFlat({ "nodes.a": 1 }, "x")).toThrowError(/not a valid overlay/);
    expect(() => overlayFromFlat({ "timeline.enter.filter": 1 }, "x")).toThrowError(
      /duration\/ease\/stagger/,
    );
    expect(() => overlayFromFlat({ "scene.id": "hack" }, "x")).toThrowError(
      /background\/duration\/fps/,
    );
  });
});

describe("parseCsv", () => {
  it("parses headers as dot-paths and coerces numeric values", () => {
    const rows = parseCsv(
      `_name,nodes.title.content,states.shown.bar.height,nodes.bar.fill\nalice,"Hello, World",320,#FF0000\nbob,Plain,18.5,#00FF00\n`,
    );
    expect(rows).toEqual([
      {
        _name: "alice",
        "nodes.title.content": "Hello, World",
        "states.shown.bar.height": 320,
        "nodes.bar.fill": "#FF0000",
      },
      {
        _name: "bob",
        "nodes.title.content": "Plain",
        "states.shown.bar.height": 18.5,
        "nodes.bar.fill": "#00FF00",
      },
    ]);
  });

  it("handles escaped quotes and empty input", () => {
    expect(parseCsv(`a,b\n"say ""hi""",2\n`)).toEqual([{ a: 'say "hi"', b: 2 }]);
    expect(parseCsv("a,b\n")).toEqual([]);
  });
});
