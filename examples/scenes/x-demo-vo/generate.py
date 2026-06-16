# Generates the x-demo voiceover with Kokoro-82M (Apache-2.0), voice af_heart.
# Run: python3 examples/scenes/x-demo-vo/generate.py   (re-run to regenerate)
import warnings; warnings.filterwarnings("ignore")
import os, numpy as np, soundfile as sf
from kokoro import KPipeline

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = "af_heart"
LINES = {
    "intro":   "This is reframe.",
    "claim":   "Ten device mockups. Ten motions. One function call each.",
    "edit":    "Tweak any of it in a live preview.",
    "survive": "Your edits survive when the A I regenerates the scene.",
    "outro":   "reframe. Open source.",
}
pipe = KPipeline(lang_code="a")
for name, text in LINES.items():
    chunks = [a for _, _, a in pipe(text, voice=VOICE)]
    audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    out = os.path.join(HERE, f"{name}.wav")
    sf.write(out, audio, 24000)
    print(f"{name}.wav  {len(audio)/24000:.2f}s")
