# x-demo voiceover

`intro.wav`, `claim.wav`, `edit.wav`, `survive.wav`, `outro.wav` were generated
locally with **Kokoro-82M** (`hexgrad/Kokoro-82M`, **Apache-2.0**), voice
`af_heart`, 24 kHz mono, via `generate.py`. Regenerate any time:

```
python3 examples/scenes/x-demo-vo/generate.py
```

Requires the `kokoro` python package (0.9.x) and `espeak-ng`. The scene
references these as label-anchored `file` cues in `examples/scenes/x-demo.ts`,
so they follow the timeline if it is retimed.

The sound effects used by `x-demo.ts` (mechanical keypresses, Kenney UI clicks,
confirmation, music bed) are CC0 and credited in `assets/sfx/LICENSE.md`.
