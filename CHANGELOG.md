# Changelog

All notable changes to `reframe-video` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Note that
before 1.0 the IR and overlay schema carry no compatibility promise; minor
versions may change them.

## [Unreleased]

## [0.1.3] - 2026-06-16

### Added

- `reframe logo <logo.svg | brand-slug> [--motion <preset>] [--energy n] [--seed n]`
  CLI command: animate any SVG (a local file, or a simple-icons brand) into a
  logo sting with no clone needed, e.g.
  `npx reframe-video logo react --motion spin-forge`.

## [0.1.2] - 2026-06-16

### Added

- **Motion vocabulary**: `motionPreset(name, opts)` with six seeded presets
  (`draw-bloom`, `punch-in`, `rise-settle`, `slide-bank`, `reveal-orbit`,
  `spin-forge`). Same `(name, knobs, seed)` is reproducible; a different `seed`
  varies the motion within the same family.
- **`path` node**: vector SVG shapes with a `progress` draw-on and `originX/Y`
  pivot, crisp at any zoom.
- **`motionPath`**: drive a node's x/y along a Catmull-Rom curve, with tangent
  `autoRotate`.
- **Expressive eases**: `easeIn/Out/InOutBack`, `*Elastic`, `*Bounce`.
- Overlay can patch a `motionPath` step's `points`; the preview exposes
  draggable waypoint handles that survive a knob-driven regeneration.
- `examples/logo-sting/` one-command animated logo sting generator (local SVG
  or a simple-icons brand slug).

### Changed

- README: Motion vocabulary section, card layout for the showcase table.

## [0.1.1] - 2026-06-11

### Fixed

- Packaging fixes for the initial npm release.

## [0.1.0] - 2026-06-11

### Added

- Initial public release: eDSL, plain-data IR, deterministic mp4 render,
  non-destructive overlays that survive AI regeneration, preview editor, batch
  rendering, label-anchored audio, and the Claude Code skill/plugin.

[Unreleased]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/kiyeonjeon21/reframe/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/kiyeonjeon21/reframe/releases/tag/v0.1.0
