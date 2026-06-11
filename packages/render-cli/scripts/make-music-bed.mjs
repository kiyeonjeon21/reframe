import { writeFileSync } from "node:fs";
const SR = 44100, DUR = 70, N = SR * DUR;
const out = new Float32Array(N);
// Am – F – C – G, 4s per chord, soft pad (detuned triangles) + sub + slow pump
const chords = [
  [220.0, 261.63, 329.63],   // A3 C4 E4
  [174.61, 220.0, 261.63],   // F3 A3 C4
  [196.0, 261.63, 329.63],   // (C/G voicing) G3 C4 E4
  [196.0, 246.94, 293.66],   // G3 B3 D4
];
const subs = [55.0, 43.65, 65.41, 49.0]; // A1 F1 C2 G1
const tri = (ph) => 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1;
const CHORD_LEN = 4;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const ci = Math.floor(t / CHORD_LEN) % 4;
  const ct = (t % CHORD_LEN) / CHORD_LEN;            // position in chord
  const env = Math.min(1, ct / 0.18) * Math.min(1, (1 - ct) / 0.10 + 0.35); // soft x-fade
  const pump = 0.82 + 0.18 * Math.pow(Math.sin(Math.PI * ((t * 2) % 1)), 2); // gentle 120bpm swell
  let v = 0;
  for (const f of chords[ci]) {
    v += tri(t * f) * 0.16 + tri(t * f * 1.003) * 0.12 + tri(t * f * 0.997) * 0.12;
    v += Math.sin(2 * Math.PI * f * 2 * t) * 0.025; // airy octave sine
  }
  v += Math.sin(2 * Math.PI * subs[ci] * t) * 0.30;  // sub
  out[i] = v * env * pump * 0.22;
}
// simple one-pole lowpass to tame the triangles
let lp = 0; const a = 1 - Math.exp(-2 * Math.PI * 1500 / SR);
for (let i = 0; i < N; i++) { lp += a * (out[i] - lp); out[i] = lp; }
// fade in/out
for (let i = 0; i < SR * 1.5; i++) out[i] *= i / (SR * 1.5);
for (let i = 0; i < SR * 3; i++) out[N - 1 - i] *= i / (SR * 3);
const pcm = new Int16Array(N);
for (let i = 0; i < N; i++) pcm[i] = Math.max(-1, Math.min(1, out[i])) * 32767;
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length * 2, 4); hdr.write("WAVEfmt ", 8);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32);
hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length * 2, 40);
writeFileSync("/tmp/bed.wav", Buffer.concat([hdr, Buffer.from(pcm.buffer)]));
console.log("bed written");
