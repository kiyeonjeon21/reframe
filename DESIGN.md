---
# reframe house style, as design tokens. Machine-readable front matter +
# human rationale below. These are the de-facto values already used across the
# example scenes, made canonical so new scenes (AI-generated or hand-written)
# converge instead of each re-inventing a palette. Tokens reference each other
# with {path.to.token}.
colors:
  bg: "#0A0C14"          # canonical scene background (dark navy)
  surface: "#161922"     # raised card / panel
  surface2: "#1E222D"    # second-level surface
  fg: "#FFFFFF"          # primary text on dark
  muted: "#8B93A7"       # secondary / label text
  mutedNeutral: "#8E8E93" # neutral grey for device / OS-UI scenes
  accent: "#FF4D00"      # PRIMARY brand mark, active / featured, lower-third bar
  accent2: "#00C2A8"     # secondary, positive / user / confirm
  dataViz:               # chart / KPI series (use in order)
    - "#54D6C0"          # teal
    - "#7C5CFF"          # violet
    - "#FF6FA5"          # pink
    - "#FFC861"          # gold
typography:
  family: Inter          # the only bundled family (400 / 700 / 800)
  weights: [400, 700, 800]
  scale:
    display:  { fontSize: 92, fontWeight: 800 }   # 88-96 range
    headline: { fontSize: 48, fontWeight: 700 }
    body:     { fontSize: 24, fontWeight: 400 }   # 22-26, up to 600
    label:    { fontSize: 18, fontWeight: 600, letterSpacing: 2 }
motion:
  ease:
    base: easeOutCubic   # default for most tweens / state changes
    enter: easeOutBack   # entrances, slight settle overshoot
    exit: easeInOutQuad  # exits / fades
    playful: springBouncy # premium / playful accents
  energy: 0.5            # 0..1 house default (clean settle to springy)
  speed: 1              # duration multiplier (>1 = faster / more urgent)
  duration:
    micro: 0.3           # taps, ticks, micro-feedback
    base: 0.5            # default tween / state transition
    slow: 1.0            # logo reveals, curved moves, holds
audio:
  bgm: [ambient-pad, lofi, pulse, tension, uplift]
  sfx: [whoosh, thud, pop, click, confirm, shimmer, swoosh, keypress, footstep]
layout:
  size: { width: 1920, height: 1080 }
  fps: 30
  margin: 96             # safe inset from frame edges
  radius: { bar: 6, card: 24, panel: 56 }
---

# reframe house style

This is the shared brand layer for reframe motion pieces. It names the values that
the example scenes already use so that anything new, whether a human writes it or an
AI generates it, looks like it belongs to the same system instead of re-deciding the
palette, type, and timing every time.

When a scene's brief does not specify colors, fonts, or tone, use the tokens above as
the default. When the brief does specify them, that brief wins; this file is the
fallback and the reference, not a hard constraint.

These tokens also exist in code. `@reframe/core` (and the `reframe-video` package) export a
`brand` object with the same values, so a scene can reference a token instead of restating a
literal:

```ts
import { scene, text, rect, brand, theme } from "reframe-video";

text({ id: "title", ...brand.type.headline, content: "Q4", fill: brand.color.fg });
rect({ id: "bar", fill: brand.color.accent });

// a different brand kit, reusable across scenes: overrides deep-merge onto the house brand
const myBrand = theme({ color: { accent: "#1E90FF" } });
```

`packages/core/src/theme.ts` is the source of truth for the values; this document mirrors and
explains them. (`brand` is pure data, so referencing a token renders byte-identical to writing
the literal.)

For a scene you want to RE-SKIN later, use `token("color.accent")` on a color prop instead of a
literal. It is a deferred reference the compiler resolves against the scene's `design` (or the
house brand), so the same scene renders in any brand:

```ts
import { rect, token } from "reframe-video";
rect({ id: "bar", fill: token("color.accent") });
```

Then re-skin with no edit to the scene: `reframe frame scene.ts --theme brand.json` (a brand kit
is a nested partial theme), or a `batch` data file with a `design.<token.path>` column (one mp4
per brand). An overlay can patch `design.color.accent` directly, and the re-skin survives an AI
regen of the base (the address is the token name). Tokens resolve on color props, the scene
background, and gradient stops; numeric and type tokens are a later phase.

## Brand

Dark, premium, motion-led. Pieces sit on a near-black navy field, carry one warm accent
that does the pointing, and move with a clean settle rather than bounce or flash. The feel
is closer to a product keynote than a meme: confident, legible, a little cinematic.

## Colors

| Role | Token | Value | Use |
|---|---|---|---|
| Background | `bg` | `#0A0C14` | Default scene background. Canonical member of a dark-navy family (`#0A0B10`, `#070A12`, `#05060C` are acceptable near-variants). |
| Surface | `surface` / `surface2` | `#161922` / `#1E222D` | Cards, panels, raised UI. |
| Foreground | `fg` | `#FFFFFF` | Primary text and marks on dark. |
| Muted | `muted` | `#8B93A7` | Secondary text, labels, captions. |
| Muted (neutral) | `mutedNeutral` | `#8E8E93` | Grey for device frames and OS-style UI content. |
| Primary accent | `accent` | `#FF4D00` | The brand mark color. Active, featured, the lower-third bar, the one thing the eye should land on. This is the de-facto brand accent already baked as the `lowerThird` default. |
| Secondary accent | `accent2` | `#00C2A8` | Positive, user-side, confirm, the second voice in a two-color story. |
| Data series | `dataViz` | teal / violet / pink / gold | Charts and KPIs, used in list order. |

Rule of thumb: one accent leads per shot. `#FF4D00` is the brand; reach for `#00C2A8` only
when you genuinely need a second category (us vs them, before vs after, positive vs neutral).

## Typography

Inter only, in the three bundled weights (400, 700, 800). Other families silently fall back,
so do not specify them.

| Step | Size | Weight | Use |
|---|---|---|---|
| Display | 88-96 | 800 | Hero headlines, count-up KPIs, title cards. |
| Headline | 48 | 700 | Section titles, lower-third names. |
| Body | 22-26 | 400-600 | Supporting copy, captions. |
| Label | 18-20 | 600 | All-caps tags and axis labels, with `letterSpacing: 2`. |

Use the numeric count-up `prefix`/`suffix` for values like `$2.4M` or `+32%` so the figure
reads from one node.

## Motion

The house tone is Balanced: a clean settle with a touch of life on entrances, not bouncy and
not flat.

- Default ease: `easeOutCubic`.
- Entrances: `easeOutBack` (small overshoot, then settle).
- Exits and fades: `easeInOutQuad`.
- Playful accents: `spring` / `springBouncy`.
- `energy`: `0.5` by default. The motion presets map energy to ease automatically (below ~0.34
  reads as a clean `easeOutCubic`, below ~0.67 as `easeOutBack`, above that as `easeOutElastic`),
  so raising energy is how a piece gets springier.
- Duration scale: `0.3` micro, `0.5` base, `1.0` slow. State changes and most tweens default to
  `0.5`; curved moves and logo reveals to `1.0`.

Tone overrides by job: corporate or data-heavy, drop to `easeOutQuad` and `energy ~0.3`; promo or
teaser, push `speed > 1` for urgency; premium or playful, raise `energy` toward `0.7` and use a
spring.

## Audio

Audio is part of the brand. Cues anchor to timeline labels so the sound design survives retiming
and regeneration.

- Music beds (`bgm`): `ambient-pad`, `lofi`, `pulse`, `tension`, `uplift`. `uplift` for promos,
  `ambient-pad` or `lofi` for calm explainers, `tension` for a build.
- Effects (`sfx`): `whoosh`, `thud`, `pop`, `click`, `confirm`, `shimmer`, `swoosh`, `keypress`,
  `footstep`. Score entrances with `whoosh`/`pop`, impacts with `thud`, UI with `click`/`confirm`.

## Layout and surface

- Canvas: `1920x1080` at `30fps` by default.
- Keep important content inside a `~96px` safe margin. Use the `row` / `column` / `grid` helpers
  for even spacing rather than hand-placing coordinates.
- Corner radius scale: `6` for thin bars, `24` for cards, `56` for large glass panels.
- Surfaces lean on the dark-glass look: translucent fills, a soft rim, and the live `backdrop`
  (liquid glass) for panels that sit over busy content. Tint and rim need gradients, since a solid
  color string loses its alpha.

## Do's and don'ts

- Do reference these tokens. Do not invent a new grey or a slightly different orange per scene.
- Do let one accent lead. Do not paint two accents at equal weight in the same shot.
- Do keep entrances on `easeOutBack` and the rest on `easeOutCubic` unless the brief asks for a
  different tone.
- Do label-anchor audio cues. Do not hang sound off raw seconds.
- Do stay on Inter. Do not specify another font family.
