import {
  scene, group, rect, text, seq, par, beat, tween, wait,
  devicePreset, deviceScreen, deviceScreenCenter, deviceBounds,
  DEVICE_PRESET_NAMES, type NodeIR, type DevicePresetName, type TimelineIR,
} from "@reframe/core";

// All ten device presets on one contact sheet, then an exploded "teardown":
// each chassis iso-tilts (skewX/skewY — the 2.5D tier) while its screen panel
// slides out of the frame. The tilt rides the outer `${id}` group; the eject
// rides `${id}-screen`, slid against deviceScreenCenter() so it works for any
// device regardless of where its panel sits. Pure tweens on stable ids — the
// preset itself is a static node generator.

const BG = "#070809";
const MUTED = "#6B7283";
const ACCENTS = ["#FF4D00", "#00C2A8", "#7C5CFF", "#F59E0B", "#3B82F6", "#EC4899", "#10B981", "#E0457B", "#22D3EE", "#A855F7"];

const COLS = 5;
const COL_X = [192, 576, 960, 1344, 1728];
const ROW_Y = [368, 772];
const BOX = 296; // device fits this square per cell

const cell = (i: number) => ({ x: COL_X[i % COLS]!, y: ROW_Y[Math.floor(i / COLS)]! });
const fitScale = (name: DevicePresetName) => {
  const b = deviceBounds(name);
  return Math.max(0.16, Math.min(0.4, Math.min(BOX / b.width, BOX / b.height)));
};

// A representative UI for each screen — sized to the device's own screen bounds,
// so it sits correctly inside the clip on every device.
const fakeUI = (name: DevicePresetName, accent: string): NodeIR[] => {
  const { width: w, height: h } = deviceScreen(name);
  const pad = Math.min(28, w * 0.08);
  const barH = Math.max(10, h * 0.06);
  const rowH = Math.max(8, h * 0.07);
  const id = `${name}-ui`;
  return [
    rect({ id: `${id}-bar`, x: 0, y: -h / 2 + pad + barH / 2, anchor: "center", width: w - pad * 2, height: barH, fill: accent, radius: barH / 2 }),
    ...[0, 1, 2].map((k) =>
      rect({ id: `${id}-r${k}`, x: 0, y: -h * 0.06 + k * rowH * 1.7, anchor: "center", width: (w - pad * 2) * 0.92, height: rowH, fill: "#191B22", radius: 6 }),
    ),
    rect({ id: `${id}-chip`, x: w / 2 - pad - Math.min(40, w * 0.12), y: h / 2 - pad - Math.min(40, w * 0.12), anchor: "center", width: Math.min(64, w * 0.18), height: Math.min(64, w * 0.18), fill: accent, radius: 12 }),
  ];
};

const devices: NodeIR[] = DEVICE_PRESET_NAMES.flatMap((name, i) => {
  const { x, y } = cell(i);
  const scale = fitScale(name);
  const accent = ACCENTS[i % ACCENTS.length]!;
  return [
    devicePreset(name, { id: name, x, y, scale, content: fakeUI(name, accent) }),
    text({ id: `${name}-cap`, x, y: y + BOX / 2 - 6, anchor: "center", content: name, fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: MUTED }),
  ];
});

// One device's teardown: tilt the chassis + eject the panel. Reversible — the
// rebuild beat tweens the same labels back to rest.
const explode = (name: DevicePresetName): TimelineIR => {
  const c = deviceScreenCenter(name);
  return par(
    tween(name, { skewX: -13, skewY: 5, scaleY: 0.95 }, { duration: 0.7, ease: "easeOutBack", label: `${name}-tilt` }),
    tween(`${name}-screen`, { x: c.x + 26, y: c.y + 150, scale: 1.08, skewX: 8 }, { duration: 0.7, ease: "easeOutCubic", label: `${name}-eject` }),
  );
};
const rebuild = (name: DevicePresetName): TimelineIR => {
  const c = deviceScreenCenter(name);
  return par(
    tween(name, { skewX: 0, skewY: 0, scaleY: 1 }, { duration: 0.55, ease: "easeInOutCubic", label: `${name}-untilt` }),
    tween(`${name}-screen`, { x: c.x, y: c.y, scale: 1, skewX: 0 }, { duration: 0.55, ease: "easeInOutCubic", label: `${name}-seat` }),
  );
};

// Stagger a per-device step into a diagonal wave across the grid.
const wave = (step: (n: DevicePresetName) => TimelineIR, dir: 1 | -1 = 1) =>
  par(
    ...DEVICE_PRESET_NAMES.map((name, i) => {
      const order = dir === 1 ? i : DEVICE_PRESET_NAMES.length - 1 - i;
      return seq(wait(order * 0.07), step(name));
    }),
  );

export default scene({
  id: "device-teardown",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    text({ id: "title", x: 96, y: 64, anchor: "center-left", content: "ten device presets, exploded", fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: "#FFFFFF" }),
    text({ id: "subtitle", x: 96, y: 104, anchor: "center-left", content: "one devicePreset() call each · frame + clipped screen slot", fontFamily: "Inter", fontSize: 20, fill: MUTED }),
    ...devices,
  ],
  timeline: seq(
    wait(0.5),
    beat("teardown", { nodes: [...DEVICE_PRESET_NAMES] }, [wave(explode, 1)]),
    wait(1.1),
    beat("rebuild", { nodes: [...DEVICE_PRESET_NAMES] }, [wave(rebuild, -1)]),
    wait(0.4),
  ),
});
