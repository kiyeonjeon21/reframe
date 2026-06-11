import { readFileSync, writeFileSync } from "node:fs";

function readWav(path) {
  const b = readFileSync(path);
  const idx = b.indexOf(Buffer.from("data"));
  const len = b.readUInt32LE(idx + 4);
  const pcm = new Int16Array(b.buffer, b.byteOffset + idx + 8, len / 2);
  return Float32Array.from(pcm, (v) => v / 32768);
}
const samples = ["001", "004", "007", "010", "014"].map((n) => readWav(`/tmp/kp/kp-${n}.wav`));
const { keys } = JSON.parse(readFileSync("/tmp/term-keys.json", "utf8"));
const LEAD = 0.1, SR = 44100, DUR = 11.92;
const out = new Float32Array(Math.ceil(DUR * SR));
const fract = (x) => x - Math.floor(x);
keys.forEach((t, i) => {
  const s = samples[i % 5];
  const gain = 0.30 + 0.22 * fract(Math.sin(i * 127.1) * 43758.5453);
  const off = Math.floor((LEAD + t) * SR);
  for (let j = 0; j < s.length && off + j < out.length; j++) out[off + j] += s[j] * gain;
});
const pcm = new Int16Array(out.length);
for (let i = 0; i < out.length; i++) pcm[i] = Math.max(-1, Math.min(1, out[i])) * 32767;
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length * 2, 4); hdr.write("WAVEfmt ", 8);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32);
hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length * 2, 40);
writeFileSync("/tmp/term-clicks.wav", Buffer.concat([hdr, Buffer.from(pcm.buffer)]));
console.log("clicks written", out.length / SR, "s");
