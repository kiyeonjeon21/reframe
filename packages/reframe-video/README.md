# reframe

**Declarative motion graphics that AI can write, humans can tweak — and the
human's edits survive an AI regeneration.**

A scene is a single self-contained `.ts` file (plain-data IR, no React, no
project scaffold). Renders are deterministic: same input, byte-identical
frames. Human edits live in a non-destructive overlay JSON addressed by stable
node ids / state names / timeline labels — regenerate the scene with an AI and
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
| `reframe render <scene.ts> [--overlay edits.json] [-o out.mp4]` | deterministic mp4 |
| `reframe batch <scene.ts> <data.json\|csv>` | one mp4 per data row (row keys are overlay addresses) |
| `reframe preview` | scrub/play/edit UI for scenes in the current directory; edits export as overlay JSON |
| `reframe new <name>` | scaffold a documented starter scene |
| `reframe motion <mp4>` | calibrated motion profile of a rendered clip |
| `reframe guide [--regen]` | the scene-authoring guide / regeneration contract — **feed this to your AI** |

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

The renderer resolves `@reframe/core` itself — a scene file needs no
package.json next to it. For editor IntelliSense, `npm i -D reframe-video`
and import from `"reframe-video"` (same API, both specifiers work).

Audio is label-anchored (`audio: { cues: [{ at: "enter", sfx: "whoosh" }] }`)
so sound design follows retiming and regeneration. Full syntax:
`npx reframe-video guide`.

## Why this instead of generating Remotion/HTML?

One-shot generation quality is a wash (we measured it). The difference is the
second turn: reframe's output is an addressable document, so "tweak just the
timing", "redesign it but keep my edits", and "render 50 personalized
versions" are operations, not re-prompt-and-hope. Receipts, benchmarks, and
the full story: https://github.com/kiyeonjeon21/reframe

## Requirements

Node ≥ 20, ffmpeg on PATH, Playwright chromium (one-time
`npx playwright install chromium`). macOS/Linux.
