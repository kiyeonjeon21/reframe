# labs

Experiments and product probes — not user-facing examples (those are in
[`examples/`](../examples)). Each is a self-contained generator that bakes live
data into a deterministic reframe scene, then renders it.

| probe | what |
|---|---|
| [`gh-year-probe/`](gh-year-probe) | a GitHub handle → a "year in code" recap video (contribution graph as a 3D relief landscape). `pnpm exec tsx labs/gh-year-probe/generate.mts <handle> -o out/<handle>.mp4` |
| [`gh-video/`](gh-video) | an earlier GitHub-profile → video probe (avatar + stats baked into a sting). |
| [`logo-sting/`](logo-sting) | an SVG → animated logo sting generator (`generate.mts <logo.svg\|brand-slug>`). The reference example behind the published `reframe logo` command. |

These follow the same boundary as the rest of the repo: fetch/probe live data,
**bake it into a plain scene**, then render deterministically. They live here
(not `examples/`) so `examples/` stays purely demonstrative scenes.

## scenes/

Overflow scenes pulled out of `examples/scenes` to keep that set curated — extra
variants of a capability already shown by a kept example (a second device mockup,
more character poses, a logo orbit) plus the `motion-lab` scratchpad. Still valid,
still render the same way (`pnpm reframe render labs/scenes/<name>.ts`); just not
part of the featured example set.
