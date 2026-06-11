// Offline narration via Kokoro-82M (free, Apache-2.0 weights).
// One-time: npm i kokoro-js (in a scratch dir is fine), then:
//   node tts-narration.mjs lines.json
// lines.json: [{ "file": "/tmp/narr-1.wav", "text": "...", "voice": "af_heart" }]
import { KokoroTTS } from "kokoro-js";

const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
  dtype: "q8", device: "cpu",
});
const lines = JSON.parse(process.argv[2] ? await (await import("node:fs/promises")).readFile(process.argv[2], "utf8") : "[]");
for (const { file, text, voice } of lines) {
  const audio = await tts.generate(text, { voice: voice ?? "af_heart" });
  await audio.save(file);
  console.log("wrote", file);
}
