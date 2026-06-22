import {
  scene, group, rect, text, seq, par, stagger, tween, wait,
  devicePreset, deviceScreen, deviceBounds, row,
  brand,
  type NodeIR, type DevicePresetName, type DeviceStyle,
} from "@reframe/core";

// A showcase for the redesigned devicePreset: premium-by-default (gradient body,
// ambient screen glow, soft contact shadow, glass glare) with a `style` knob
// (glass | neon) and per-instance variation auto-derived from each device's id.
//   · top row    — the SAME phone across four seeds (glass): subtly different
//                  bezel / corner / glare, all on-model.
//   · bottom row — one device per kind, glass vs neon, premium lighting.

const W = 1920, H = 1080;
const BG = brand.color.bg;
const FG = brand.color.fg;
const MUTED = brand.color.muted;

const tx = (id: string, x: number, y: number, s: string, size: number, weight: number, fill: string): NodeIR =>
  text({ id, x, y, anchor: "center", content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

// a tiny "now playing" mock authored in screen-local centre coords
const phoneApp = (id: string, accent: string): NodeIR[] => {
  const { width: w, height: h } = deviceScreen("phone");
  return [
    text({ id: `${id}-time`, x: -w / 2 + 26, y: -h / 2 + 34, anchor: "center-left", content: "9:41", fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: FG }),
    rect({ id: `${id}-art`, x: 0, y: -h * 0.16, anchor: "center", width: w * 0.62, height: w * 0.62, fill: accent, radius: 30 }),
    text({ id: `${id}-t`, x: 0, y: h * 0.14, anchor: "center", content: "Midnight Drive", fontFamily: "Inter", fontSize: 26, fontWeight: 800, fill: FG }),
    text({ id: `${id}-a`, x: 0, y: h * 0.19, anchor: "center", content: "The Echoes", fontFamily: "Inter", fontSize: 16, fill: MUTED }),
    rect({ id: `${id}-tr`, x: 0, y: h * 0.27, anchor: "center", width: w * 0.72, height: 5, fill: "#2A2D38", radius: 3 }),
    rect({ id: `${id}-fl`, x: -w * 0.36, y: h * 0.27, anchor: "center-left", width: w * 0.42, height: 5, fill: accent, radius: 3 }),
  ];
};

// a generic screen mock for non-phone devices
const miniApp = (id: string, name: DevicePresetName, accent: string): NodeIR[] => {
  const { width: w, height: h } = deviceScreen(name);
  const s = Math.min(w, h);
  return [
    rect({ id: `${id}-art`, x: 0, y: -h * 0.08, anchor: "center", width: s * 0.5, height: s * 0.5, fill: accent, radius: s * 0.06 }),
    rect({ id: `${id}-b1`, x: 0, y: h * 0.26, anchor: "center", width: w * 0.46, height: 10, fill: "#2A2D38", radius: 5 }),
    rect({ id: `${id}-b2`, x: -w * 0.08, y: h * 0.33, anchor: "center", width: w * 0.3, height: 8, fill: accent, radius: 4 }),
  ];
};

const ACC = [brand.color.accent, brand.color.accent2, brand.color.dataViz[1]!, "#3B82F6", "#F59E0B"];

// ── top row: four glass phones, identical opts but distinct ids → auto-varied ──
const TOP_Y = 360;
const topX = row(4, { span: 1240, center: W / 2 });
const topPhones: NodeIR[] = ["seed-a", "seed-b", "seed-c", "seed-d"].map((id, i) =>
  group({ id: `top-${i}`, x: 0, y: 0, opacity: 0, scale: 0.9 }, [
    devicePreset("phone", { id, x: topX[i]!, y: TOP_Y, scale: 0.42, screen: "#10131C", content: phoneApp(id, ACC[i]!) }),
  ]),
);

// ── bottom row: one of each kind, alternating glass / neon ──
interface Slot { name: DevicePresetName; style: DeviceStyle; accent: string }
const BOTTOM: Slot[] = [
  { name: "laptop", style: "glass", accent: ACC[2]! },
  { name: "browser", style: "glass", accent: ACC[1]! },
  { name: "watch", style: "neon", accent: ACC[0]! },
  { name: "tv", style: "neon", accent: ACC[3]! },
];
const BOT_Y = 820;
const botX = row(BOTTOM.length, { span: 1380, center: W / 2 });
const botDevices: NodeIR[] = BOTTOM.map((slot, i) => {
  const id = `bd-${slot.name}`;
  const b = deviceBounds(slot.name);
  const fit = Math.min(360 / b.width, 300 / b.height);
  return group({ id: `bot-${i}`, x: 0, y: 0, opacity: 0, scale: 0.9 }, [
    devicePreset(slot.name, { id, x: botX[i]!, y: BOT_Y, scale: fit, style: slot.style, screen: "#10131C", content: miniApp(id, slot.name, slot.accent) }),
    tx(`${id}-cap`, botX[i]!, BOT_Y + 220, `${slot.name} · ${slot.style}`, 19, 700, MUTED),
  ]);
});

export default scene({
  id: "device-gallery",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  nodes: [
    group({ id: "header", x: W / 2, y: 110, opacity: 0 }, [
      tx("title", 0, 0, "one preset, every screen", 46, 800, FG),
      tx("sub", 0, 46, "premium by default · glass + neon · auto-varied per device", 21, 400, MUTED),
    ]),
    tx("top-cap", W / 2, 540, "same phone, four seeds — varied, all on-model", 19, 700, MUTED),
    ...topPhones,
    ...botDevices,
    text({ id: "wm", x: 1844, y: 1046, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 18, fontWeight: 700, fill: "#2A3140" }),
  ],
  timeline: seq(
    beat0(),
  ),
});

// keep the timeline readable: a header fade, the top row staggers up, the bottom
// row staggers up, a beat to breathe.
function beat0() {
  return par(
    tween("header", { opacity: 1, y: 90 }, { duration: 0.7, ease: "easeOutCubic", label: "title" }),
    seq(
      wait(0.3),
      stagger(0.1, ...topPhones.map((p) => tween(p.id, { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack" }))),
    ),
    seq(
      wait(0.7),
      stagger(0.12, ...botDevices.map((d) => tween(d.id, { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack" }))),
    ),
    seq(wait(2.6), tween("wm", { opacity: 1 }, { duration: 0.4 })),
  );
}
