# Solar-system voiceover, Kokoro-82M (Apache-2.0). American voice (am_michael).
# Run: python3 examples/scenes/solar-system-vo/generate.py
import warnings; warnings.filterwarnings("ignore")
import os, numpy as np, soundfile as sf
from kokoro import KPipeline

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = "am_michael"  # American English male, documentary tone
LINES = {
    "intro":    "This is Earth. Everything you have ever known, on one pale blue dot.",
    "neighbors":"But Earth is just one of eight planets, circling a single star.",
    "planets":  "Mercury, Venus, Earth, and Mars. Then the giants. Jupiter, Saturn, Uranus, Neptune.",
    "sun":      "And at the center, the Sun. It holds ninety nine point eight percent of all the mass here.",
    "analogy":  "If the Sun were a basketball, Earth would be a peppercorn, twenty six meters away.",
    "size":     "You could pour more than one million Earths inside it.",
    "light":    "Its light takes eight minutes to reach you. The sunlight on your skin is already eight minutes old.",
    "finale":   "One star. Eight planets. And one pale blue dot, that you call home.",
}
pipe = KPipeline(lang_code="a")
for name, text in LINES.items():
    chunks = [a for _, _, a in pipe(text, voice=VOICE)]
    audio = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    sf.write(os.path.join(HERE, f"{name}.wav"), audio, 24000)
    print(f"{name}.wav  {len(audio)/24000:.2f}s")
