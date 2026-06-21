#!/usr/bin/env python3
# Kokoro-TTS sidecar for `reframe narrate`. Reads a JSON request on stdin:
#   { "outDir": "...", "lang": "a", "lines": [{ "stem", "text", "voice", "speed" }] }
# synthesizes each line at the given speed, writes <outDir>/<stem>.wav @24kHz,
# and prints { "durations": { "<stem>": <seconds> } } on stdout.
#
# Out-of-band by design: the .wav are external assets (not part of reframe's
# golden/determinism contract), like images. Requires `kokoro` + espeak-ng.
import sys, os, json, warnings

warnings.filterwarnings("ignore")


def main():
    req = json.load(sys.stdin)
    out_dir = req["outDir"]
    lang = req.get("lang", "a")
    os.makedirs(out_dir, exist_ok=True)

    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
    except Exception as e:  # pragma: no cover - environment dependent
        print(json.dumps({"error": f"kokoro import failed: {e}"}))
        sys.exit(3)

    pipe = KPipeline(lang_code=lang)
    durations = {}
    for line in req["lines"]:
        stem = line["stem"]
        text = line["text"]
        voice = line.get("voice", "af_heart")
        speed = float(line.get("speed", 1.0))
        chunks = [a for _, _, a in pipe(text, voice=voice, speed=speed)]
        audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
        path = os.path.join(out_dir, f"{stem}.wav")
        sf.write(path, audio, 24000)
        durations[stem] = round(len(audio) / 24000, 4)

    print(json.dumps({"durations": durations}))


if __name__ == "__main__":
    main()
