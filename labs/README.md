# labs

Experiments and product probes — not user-facing examples (those are in
[`examples/`](../examples)). Each is a self-contained generator that bakes live
data into a deterministic reframe scene, then renders it.

| probe | what |
|---|---|
| [`gh-year-probe/`](gh-year-probe) | a GitHub handle → a "year in code" recap video (contribution graph as a 3D relief landscape). `pnpm exec tsx labs/gh-year-probe/generate.mts <handle> -o out/<handle>.mp4` |
| [`gh-video/`](gh-video) | an earlier GitHub-profile → video probe (avatar + stats baked into a sting). |

These follow the same boundary as the rest of the repo: fetch/probe live data,
**bake it into a plain scene**, then render deterministically. They live here
(not `examples/`) so `examples/` stays purely demonstrative scenes.
