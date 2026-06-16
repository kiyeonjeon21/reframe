import { scene, group, seq, par, beat, tween, wait, DEVICE_PRESET_NAMES, type NodeIR, type DevicePresetName, type TimelineIR } from "@reframe/core";
import { BG, FG, MUTED, SUB, TAGLINE, tx, deviceHero, signature } from "../lib/deviceKit.js";

// A hero carousel where every device performs its OWN signature move — the
// motion is chosen to match what the device is for. One device at a time,
// large; each crossfades to the next. Content + motion live in ../lib/deviceKit.
//
//   phone flip + album pulse · tablet icon wave · laptop code cascade ·
//   browser parallax load · watch ring draw · monitor bars grow ·
//   tv tile cascade · foldable unfold · terminal type-out · car route draw

const STAGE_X = 960;
const STAGE_Y = 524;

const stages: NodeIR[] = DEVICE_PRESET_NAMES.map((name, i) =>
  group({ id: `stage-${name}`, x: STAGE_X, y: STAGE_Y + 30, opacity: 0 }, [
    deviceHero(name, SUB[i % SUB.length]!),
    tx(`${name}-cap`, 0, 392, name, 30, 800, FG, "center"),
    tx(`${name}-tag`, 0, 430, TAGLINE[name], 18, 400, MUTED, "center"),
  ]),
);

const HOLD = 0.6;
const heroBeat = (name: DevicePresetName): TimelineIR =>
  beat(name, { nodes: [name, `${name}-ui`] }, [
    seq(
      tween(`stage-${name}`, { opacity: 1, y: STAGE_Y }, { duration: 0.45, ease: "easeOutCubic", label: `${name}-in` }),
      signature(name),
      wait(HOLD),
      tween(`stage-${name}`, { opacity: 0, y: STAGE_Y - 20 }, { duration: 0.45, ease: "easeInCubic", label: `${name}-out` }),
    ),
  ]);

const DWELL = 2.6;

export default scene({
  id: "device-teardown",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    tx("title", 96, 70, "ten devices, ten motions", 40, 800, FG),
    tx("subtitle", 96, 110, "each devicePreset() animated in its own signature move", 20, 400, MUTED),
    ...stages,
  ],
  timeline: par(...DEVICE_PRESET_NAMES.map((name, i) => seq(wait(i * DWELL), heroBeat(name)))),
});
