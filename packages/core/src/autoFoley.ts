/**
 * autoFoley — the animation scores its own sound effects, deterministically.
 *
 * A pure analysis pass over the compiled motion: it samples each node's own
 * (camera-independent) x/y/scale/opacity over the timeline and emits sound cues
 * for the gestures it sees — a fast move → whoosh, a moving-then-stopping settle
 * → impact, a scale-in → pop — panned by screen position. Because it re-derives
 * cues from `sampleProp` (the same deterministic sampler `evaluate` uses), the
 * sound follows retiming and AI regeneration for free, and any manual `audio.cues`
 * still layer on top. The audio analogue of evaluate(scene, t); the motion
 * generalization of `textTypeCues`.
 *
 * MVP scope: translation / settle / scale-in + pan. Deferred: sustained scale
 * riser→impact, rotation→swish.
 */

import type { CompiledScene } from "./compile.js";
import type { AudioCueIR, AutoFoleyOptions, NodeIR, SfxName } from "./ir.js";
import { sampleProp } from "./evaluate.js";

// thresholds (px/s) at sensitivity 1, tuned for 1920-wide scenes
const V_MIN = 360; // a node counts as "moving" above this peak speed
const V_STOP = 60; // and "stopped" below this
const V_DECEL = 520; // a settle needs to have been moving at least this fast
const V_MAX = 2600; // speed mapped to full loudness
const MIN_DUR = 0.1; // shortest move that earns a whoosh (s)

const num = (c: CompiledScene, t: number, id: string, prop: string, fb: number): number => {
  const v = sampleProp(c, t, id, prop, fb);
  return typeof v === "number" ? v : fb;
};

/** Rough node footprint for thud-vs-knock + pop gating. */
function nodeSize(node: NodeIR): number {
  const p = node.props as unknown as Record<string, number | undefined>;
  return Math.max(p.width ?? 0, p.height ?? 0, (p.radius ?? 0) * 2, p.fontSize ?? 0, 0);
}

interface Candidate { t: number; sfx: SfxName; gain: number; pan: number; rank: number }

// collapse co-moving nodes (e.g. a panel + its label) into one sound: same
// gesture family within this window → keep only the loudest.
const FAMILY: Record<string, string> = { whoosh: "move", swish: "move", thud: "hit", knock: "hit", pop: "pop" };
const DEDUP_DT = 0.09;

export function autoFoley(compiled: CompiledScene, opts: AutoFoleyOptions = {}): AudioCueIR[] {
  const master = opts.gain ?? 0.5;
  const sens = opts.sensitivity ?? 1;
  const wantWhoosh = opts.whoosh !== false;
  const wantImpact = opts.impact !== false;
  const wantPop = opts.pop !== false;
  const wantPan = opts.pan !== false;
  const vMin = V_MIN / sens, vStop = V_STOP, vDecel = V_DECEL / sens;

  const fps = compiled.ir.fps ?? 30;
  const N = Math.max(1, Math.ceil(compiled.duration * fps));
  const W = compiled.ir.size.width || 1920;
  const ids = opts.nodes ?? [...compiled.nodeById.keys()];
  const cands: Candidate[] = [];

  const panOf = (x: number) => (wantPan ? Math.max(-1, Math.min(1, (x / W) * 2 - 1)) : 0);
  const loud = (v: number) => Math.max(0.2, Math.min(1, (v - vMin) / (V_MAX - vMin))); // 0.2..1

  for (const id of ids) {
    const node = compiled.nodeById.get(id);
    if (!node || node.type === "line") continue; // line has no x/y centre
    const size = nodeSize(node);

    // sample this node's own animated transform over the timeline
    const xs: number[] = [], ys: number[] = [], ss: number[] = [], os: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / fps;
      xs.push(num(compiled, t, id, "x", (node.props as { x?: number }).x ?? 0));
      ys.push(num(compiled, t, id, "y", (node.props as { y?: number }).y ?? 0));
      ss.push(num(compiled, t, id, "scale", (node.props as { scale?: number }).scale ?? 1));
      os.push(num(compiled, t, id, "opacity", (node.props as { opacity?: number }).opacity ?? 1));
    }
    const speed = (i: number) => (i <= 0 ? 0 : Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!) * fps);

    // ── translation gestures → whoosh + settle → impact ──
    let i = 1;
    while (i <= N) {
      if (speed(i) <= vMin) { i++; continue; }
      const a = i;
      let peak = i, peakV = speed(i);
      while (i <= N && speed(i) > vStop) { const s = speed(i); if (s > peakV) { peakV = s; peak = i; } i++; }
      const b = i - 1; // last moving frame
      const durS = (b - a + 1) / fps;
      const visible = os[peak]! > 0.1;
      if (peakV > vMin && durS >= MIN_DUR && visible) {
        if (wantWhoosh) {
          const quickFlick = durS < 0.25; // short = swish, sustained slide = whoosh
          cands.push({ t: peak / fps, sfx: quickFlick ? "swish" : "whoosh", gain: master * loud(peakV), pan: panOf(xs[peak]!), rank: peakV });
        }
        // settle: moving fast then halts on-screen (an off-screen exit doesn't "land")
        const stopped = (b >= N) || (speed(b + 1) < vStop && speed(Math.min(N, b + 2)) < vStop);
        const landsOnScreen = xs[b]! >= 0 && xs[b]! <= W && os[b]! > 0.1;
        if (wantImpact && peakV > vDecel && stopped && landsOnScreen && b < N) {
          cands.push({ t: (b + 1) / fps, sfx: size > 220 ? "thud" : "knock", gain: master * loud(peakV), pan: panOf(xs[b]!), rank: peakV * 1.1 });
        }
      }
    }

    // ── scale-in → pop: a node that grows from near-zero, at the ~0.5 crossing ──
    if (wantPop && ss[0]! < 0.25) {
      for (let k = 1; k <= N; k++) {
        if (ss[k - 1]! < 0.5 && ss[k]! >= 0.5 && os[k]! > 0.05) {
          cands.push({ t: k / fps, sfx: "pop", gain: master * 0.7, pan: panOf(xs[k]!), rank: 600 });
          break;
        }
      }
    }
  }

  // loudest first, then collapse co-located same-family cues (panel + its label
  // shouldn't double), then cap to prevent cacophony on dense scenes
  cands.sort((p, q) => q.rank - p.rank);
  const kept: Candidate[] = [];
  for (const c of cands) {
    const fam = FAMILY[c.sfx] ?? c.sfx;
    if (kept.some((k) => (FAMILY[k.sfx] ?? k.sfx) === fam && Math.abs(k.t - c.t) < DEDUP_DT)) continue;
    kept.push(c);
  }
  const max = opts.maxCues ?? 32;
  return kept.slice(0, max).map((c) => ({
    at: Number(c.t.toFixed(3)),
    sfx: c.sfx,
    gain: Number(c.gain.toFixed(3)),
    ...(c.pan !== 0 ? { pan: Number(c.pan.toFixed(3)) } : {}),
  }));
}
