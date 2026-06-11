# reframe eDSL guide

You write a motion-graphics scene as **declarative data** using the reframe
TypeScript eDSL. Your output is a single `.ts` file that default-exports a
`scene({...})` call. Everything imports from `@reframe/core`.

```ts
import { scene, group, rect, ellipse, line, text,
         seq, par, stagger, to, tween, wait,
         oscillate, wiggle } from "@reframe/core";

export default scene({
  id: "my-scene",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [/* ... */],
  states: {/* ... */},
  initial: "hidden",
  timeline: seq(/* ... */),
  behaviors: [/* optional */],
});
```

## Nodes

Factories return plain data. Every node needs a unique `id`.

- `rect({ id, x, y, width, height, fill?, stroke?, strokeWidth?, radius?, opacity?, rotation?, scale?, anchor? })`
- `ellipse({ id, x, y, width, height, fill?, stroke?, strokeWidth?, ... })`
- `line({ id, x1, y1, x2, y2, stroke, strokeWidth?, opacity?, progress? })` —
  `progress` 0..1 draws the line on (1 = full line).
- `text({ id, x, y, content, fontFamily, fontSize, fontWeight?, fill?, letterSpacing?, ... })` —
  `content` may be a number; numeric content interpolates (count-up) and renders rounded.
- `group({ id, x, y, opacity?, rotation?, scale?, anchor? }, children)` — children's
  coordinates are relative to the group; group opacity/transform multiply down.

`anchor` controls placement and scale/rotation origin:
`"top-left"` (default) | `"top-center"` | `"top-right"` | `"center-left"` |
`"center"` | `"center-right"` | `"bottom-left"` | `"bottom-center"` | `"bottom-right"`.
Example: a bar that grows upward = `anchor: "bottom-left"` + animate `height`.
Font: use `fontFamily: "Inter"` (weights 400/700/800 are available).

## States: declare looks, not motion

Base props on nodes describe the **finished design**. A state is a sparse
override — only the props that differ:

```ts
states: {
  hidden: { title: { opacity: 0, y: 560 }, bar: { height: 0 } },
  shown:  { title: { opacity: 1, y: 540 }, bar: { height: 300 } },
},
initial: "hidden",
```

`to("shown", { duration, ease, stagger?, filter? })` synthesizes a transition
from each node's *current* value to the state's value. `stagger: 0.1` offsets
the affected nodes 0.1s apart in declaration order. `filter: ["a", "b"]`
restricts the transition to those nodes. States are plain objects — generate
them with normal TS (`Object.fromEntries`, `.map`) for data-driven scenes.

## Timeline: compose time

- `seq(...steps)` — one after another.
- `par(...steps)` — all start together; ends when the longest ends.
- `stagger(interval, ...steps)` — like `par` but each child starts `interval` later.
- `to(stateName, opts)` — transition into a named state (see above).
- `tween(nodeId, { prop: value, ... }, { duration, ease })` — low-level escape hatch
  for one node. Colors (`"#rrggbb"`) interpolate; numbers interpolate.
- `wait(seconds)` — hold.

Eases: `linear`, `easeIn/Out/InOutQuad`, `easeIn/Out/InOutCubic`,
`easeIn/Out/InOutQuart`, `easeIn/Out/InOutExpo`, or `{ cubicBezier: [x1,y1,x2,y2] }`.
Decelerating entrances = `easeOut*`, accelerating exits = `easeIn*`.
Scene duration is inferred from the timeline.

## Behaviors: continuous motion during holds

Composed additively on top of the timeline, for the whole scene duration:

- `oscillate(nodeId, prop, { amplitude, frequency, phase? })` — sine.
- `wiggle(nodeId, prop, { amplitude, frequency, seed })` — smooth seeded noise.

## Rules

- Everything must be a pure function of time: no `Math.random()` (use `wiggle`
  with a seed), no `Date`, no async.
- Node ids must be unique; states/tweens may only reference existing ids and
  real props of that node type.
- Overshoot pops are two steps: tween scale past 1 (`1.15`), then settle to 1.

## Worked example A — countdown (3, 2, 1, GO!)

```ts
import { scene, ellipse, text, seq, par, tween, wait } from "@reframe/core";

const numbers = ["3", "2", "1"];

export default scene({
  id: "countdown",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#101014",
  nodes: [
    ellipse({ id: "ring", x: 960, y: 540, width: 360, height: 360,
      anchor: "center", stroke: "#3B82F6", strokeWidth: 10, opacity: 0 }),
    ...numbers.map((n, i) =>
      text({ id: `num-${i}`, x: 960, y: 540, anchor: "center", content: n,
        fontFamily: "Inter", fontSize: 220, fontWeight: 800, fill: "#FFFFFF",
        opacity: 0, scale: 0.5 })),
    text({ id: "go", x: 960, y: 540, anchor: "center", content: "GO!",
      fontFamily: "Inter", fontSize: 320, fontWeight: 800, fill: "#FF4D00",
      opacity: 0, scale: 0.5 }),
  ],
  timeline: seq(
    tween("ring", { opacity: 1 }, { duration: 0.3, ease: "easeOutCubic" }),
    ...numbers.map((_, i) =>
      seq(
        par(
          tween(`num-${i}`, { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
          tween(`num-${i}`, { scale: 1.1 }, { duration: 0.2, ease: "easeOutCubic" }),
        ),
        tween(`num-${i}`, { scale: 1 }, { duration: 0.1, ease: "easeInOutQuad" }),
        wait(0.45),
        tween(`num-${i}`, { opacity: 0, scale: 0.7 }, { duration: 0.1, ease: "easeInQuad" }),
      )),
    par(
      tween("go", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("go", { scale: 1.15 }, { duration: 0.25, ease: "easeOutCubic" }),
      tween("ring", { scale: 1.6, opacity: 0 }, { duration: 0.4, ease: "easeOutCubic" }),
    ),
    tween("go", { scale: 1 }, { duration: 0.15, ease: "easeInOutQuad" }),
    wait(0.6),
  ),
});
```

## Worked example B — badge pop (overshoot + wiggle + drop)

```ts
import { scene, group, rect, text, seq, par, tween, wait, oscillate } from "@reframe/core";

export default scene({
  id: "badge-pop",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#15151A",
  nodes: [
    group({ id: "badge", x: 960, y: 540, scale: 0, opacity: 0 }, [
      rect({ id: "plate", x: 0, y: 0, width: 420, height: 160,
        anchor: "center", fill: "#E11D48", radius: 28 }),
      text({ id: "label", x: 0, y: 6, anchor: "center", content: "NEW",
        fontFamily: "Inter", fontSize: 88, fontWeight: 800, fill: "#FFFFFF",
        letterSpacing: 6 }),
    ]),
  ],
  timeline: seq(
    wait(0.2),
    par(
      tween("badge", { opacity: 1 }, { duration: 0.15, ease: "easeOutQuad" }),
      tween("badge", { scale: 1.18 }, { duration: 0.28, ease: "easeOutCubic" }),
    ),
    tween("badge", { scale: 1 }, { duration: 0.18, ease: "easeInOutQuad" }),
    wait(1.6),
    par(
      tween("badge", { y: 720 }, { duration: 0.35, ease: "easeInCubic" }),
      tween("badge", { opacity: 0 }, { duration: 0.35, ease: "easeInQuad" }),
    ),
    wait(0.2),
  ),
  behaviors: [oscillate("badge", "rotation", { amplitude: 2.5, frequency: 0.8 })],
});
```
