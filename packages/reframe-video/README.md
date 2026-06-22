# reframe

**Declarative motion graphics that AI can write, humans can tweak, and the
human's edits survive an AI regeneration.**

A scene is a single self-contained `.ts` file (plain-data IR, no React, no
project scaffold). Renders are deterministic: same input, byte-identical
frames. Human edits live in a non-destructive overlay JSON addressed by stable
node ids, state names, and timeline labels. Regenerate the scene with an AI and
the overlay reapplies; anything broken is reported loudly, never silently lost.

```bash
brew install ffmpeg                  # system dep (or apt install ffmpeg)
npx playwright install chromium      # one-time browser download
npx reframe-video new hello          # scaffold hello.ts in this directory
npx reframe-video render hello.ts    # → out/hello.mp4
```

## Commands

| command | what it does |
|---|---|
| `reframe render <scene.ts> [--overlay edits.json] [--theme brand.json] [-o out.mp4]` | deterministic mp4; `--theme` re-skins `token()` colors |
| `reframe batch <scene.ts> <data.json\|csv>` | one mp4 per data row (row keys are overlay addresses; a `design.<token.path>` column = one mp4 per brand) |
| `reframe compile <scene.ts> [-o out.json] [--json]` | bundle + validate a scene to SceneIR JSON, no render (fast; no ffmpeg/chromium) |
| `reframe frame <scene.ts> [--t <sec>] [-o out.png]` | render one frame at time `t` to a PNG (chromium only, no mux) |
| `reframe compose <scene.ts> --overlay f... [-o out.json]` | compose overlay(s) onto a scene and emit composed SceneIR, no render |
| `reframe manifest <scene.ts> [--json]` | dump the addressable surface (nodes, states, labels, beats) with overlay addresses |
| `reframe lint <scene.ts> [--strict]` | flag un-addressable motion + verify the scene is a pure function of time |
| `reframe player <scene.ts> [--overlay f]... [--edit] [-o out.html]` | bundle into one self-contained HTML player |
| `reframe preview` | scrub/play/edit UI for scenes in the current directory; edits export as overlay JSON |
| `reframe new <name>` | scaffold a documented starter scene |
| `reframe guide [--directing\|--regen\|--html]` | print a guide (default: eDSL syntax; `--regen`: stable-address contract; etc.). Feed this to your AI |
| `reframe skill [--path]` | print the authoring skill for an agent; `--path` prints the plugin dir to load |

(Installed as both `reframe` and `reframe-video`; with npx use `npx reframe-video <cmd>`.)

## Writing a scene

```ts
import { scene, text, seq, to, wait } from "@reframe/core"; // or "reframe-video"

export default scene({
  id: "hello",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    text({ id: "title", x: 960, y: 540, anchor: "center",
      content: "Hello", fontFamily: "Inter", fontSize: 120, fontWeight: 800, fill: "#FFF" }),
  ],
  states: {
    hidden: { title: { opacity: 0, y: 580 } },
    shown:  { title: { opacity: 1, y: 540 } },
  },
  initial: "hidden",
  timeline: seq(
    to("shown", { duration: 0.6, ease: "easeOutCubic", label: "enter" }),
    wait(2, "hold"),
  ),
});
```

The renderer resolves `@reframe/core` itself, so a scene file needs no
`package.json` next to it. For editor IntelliSense, `npm i -D reframe-video`
and import from `"reframe-video"` (same API, both specifiers work).

Audio is label-anchored (`audio: { cues: [{ at: "enter", sfx: "whoosh" }] }`)
so sound design follows retiming and regeneration. Full syntax:
`npx reframe-video guide`.

## Backdrop (live "liquid glass")

`backdrop: { blur, saturate, brightness }` on a rect or ellipse makes the shape
sample what is already drawn behind it and redraw it blurred and graded inside
its outline. The node's translucent fill is the glass tint; the stroke is the
rim. Works in both `render` (to mp4) and `player` (live in any browser). Use a
gradient for the tint and rim (a solid color string loses its alpha):

```ts
rect({ id: "panel", x: 960, y: 540, width: 480, height: 320, anchor: "center",
  fill: linearGradient(["#FFFFFF24", "#FFFFFF0A"], { angle: 90 }),   // translucent tint
  stroke: linearGradient(["#FFFFFFE6", "#FFFFFF33"], { angle: 125 }), strokeWidth: 1.5,
  backdrop: { blur: 24, saturate: 1.4 },
})
```

Animate the node's position or size and the frosted area re-samples each frame.
See `examples/scenes/liquid-glass.ts` and `liquid-glass-nav.ts`.

## Rendering to a canvas (live preview)

The same renderer that produces the mp4 is exported as a subpath for drawing
frames to a 2D canvas in the browser, so an editor or preview can render a
scene live and match the export. Compile once, draw any time `t`:

```ts
import { compileScene, evaluate } from "reframe-video";
import { renderFrame, drawDisplayList } from "reframe-video/renderer";

const compiled = compileScene(myScene);          // myScene: SceneIR
const ctx = canvas.getContext("2d")!;

renderFrame(ctx, compiled, t);                    // clears + paints the frame at time t
// or drive the DisplayList yourself (you own the clear/background):
drawDisplayList(ctx, evaluate(compiled, t));
```

Camera, clips, track mattes, group effects, gradients, and text are handled
exactly like the mp4 path. Images and video need registries: pass `images`
(`{ get(src) }`) and `videos` (`{ frame(src, i) }`) returning decoded
`CanvasImageSource`s.

## Compiling source to IR in-process (server)

For a backend that has an LLM author eDSL source and needs the **SceneIR** back
(to preview, diff, or self-correct) without rendering, the loader is exported as
a Node-only subpath:

```ts
import { loadSceneFromCode, loadScene, SceneLoadError } from "reframe-video/compile";

const ir = await loadSceneFromCode(generatedSource);   // bundle + validate, no ffmpeg/chromium
// errors are classified and sanitized (no base64 bundle dump):
try { await loadSceneFromCode(badSource); }
catch (e) { if (e instanceof SceneLoadError) console.log(e.kind, e.message); } // "eval" | "bundle" | "validation"
```

The same thing on the CLI is `reframe compile … --json`.

## Why this instead of generating HTML/React?

One-shot generation quality is roughly equal (we measured it). The difference
is the second turn: reframe's output is an addressable document, so "tweak just
the timing", "redesign it but keep my edits", and "render 50 personalized
versions" are operations, not re-prompt-and-hope. Receipts, benchmarks, and the
full story: https://github.com/kiyeonjeon21/reframe

## Requirements

Node >= 20, ffmpeg on PATH, Playwright chromium (one-time
`npx playwright install chromium`). macOS/Linux.
