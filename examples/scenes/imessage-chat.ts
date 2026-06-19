import {
  scene, group, rect, ellipse, text, path, seq, par, tween, wait, motionPath, oscillate,
  devicePreset, deviceScreen, linearGradient, type NodeIR, type BehaviorIR,
} from "@reframe/core";

// A hero iPhone floats in and a text conversation plays out, iMessage-style:
//   기 · wake      — the phone arcs in (motionPath) into a gentle hero tilt, the
//                    Messages screen lights up (header + input bar).
//   승 · the chat  — bubbles arrive one by one. Incoming gets a typing indicator
//                    (three bouncing dots) then pops in grey on the left; outgoing
//                    swooshes up blue on the right. The thread scrolls as it fills.
//   전 · the turn  — the exchange lands a punchline ("even this convo? code").
//   결 · tagline   — the phone eases back, a caption resolves: it's all code.
// devicePreset("phone") + clipped screen content; pop/scroll via tween; the dots
// + the float are oscillate behaviors. Deterministic (no Date/random).

const W = 1920, H = 1080, CX = 960, CY = 540;
const BG = "#070A12";
const SCREEN = "#0B0B0D";
const FG = "#F2F2F7";
const MUTED = "#8E8E93";
const BLUE = "#0A84FF";
const HERO = 0.98;

// screen-local geometry (origin 0,0 = screen centre)
const { width: SW, height: SH } = deviceScreen("phone"); // 352 x 736
const TOP = -SH / 2;
const LEFT = -150;            // incoming bubble left edge
const RIGHT = 150;            // outgoing bubble right edge
const BOTTOM_SLOT = 170;      // where the newest bubble always lands
const GAP = 62;               // vertical pitch between bubbles
const BUBBLE_H = 46;
const FS = 25;                // bubble text size

const ri = (id: string, x: number, y: number, w: number, h: number, fill: string, radius = 0, extra: Record<string, unknown> = {}): NodeIR =>
  rect({ id, x, y, anchor: "center", width: w, height: h, fill, radius, ...extra });
const tx = (id: string, x: number, y: number, s: string, size: number, weight: number, fill: string, anchor: "center" | "center-left" | "center-right" = "center"): NodeIR =>
  text({ id, x, y, anchor, content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

const OUTGOING = linearGradient(["#2BA4FF", "#0A78FF"], { angle: 90 });

// ── the conversation ─────────────────────────────────────────────────────────
interface Msg { side: "in" | "out"; text: string }
const MSGS: Msg[] = [
  { side: "in",  text: "that intro is unreal" },
  { side: "out", text: "haha thanks" },
  { side: "in",  text: "after effects??" },
  { side: "out", text: "nope. all code" },
  { side: "in",  text: "wait what" },
  { side: "out", text: "even this convo? code" },
  { side: "in",  text: "no way" },
];

const bubbleW = (s: string): number => Math.min(290, Math.max(76, s.length * 12.6 + 40));
const slotY = (i: number): number => i * GAP;           // bubble's final y inside the thread
const threadY = (i: number): number => BOTTOM_SLOT - i * GAP; // scroll so msg i sits at BOTTOM_SLOT

// each bubble is a group whose origin sits at the bubble centre, so it pops about
// its own middle; it starts hidden + a touch low (rises into place)
const bubbleNodes: NodeIR[] = MSGS.map((m, i) => {
  const w = bubbleW(m.text);
  const cx = m.side === "in" ? LEFT + w / 2 : RIGHT - w / 2;
  const rise = m.side === "out" ? 26 : 12;
  return group({ id: `bubble-${i}`, x: cx, y: slotY(i) + rise, scale: 0.7, opacity: 0 }, [
    rect({ id: `bubble-${i}-bg`, x: 0, y: 0, anchor: "center", width: w, height: BUBBLE_H, radius: BUBBLE_H / 2, fill: m.side === "out" ? OUTGOING : "#262629" }),
    tx(`bubble-${i}-t`, 0, 1, m.text, FS, 400, FG),
  ]);
});

const thread: NodeIR = group({ id: "thread", x: 0, y: BOTTOM_SLOT }, bubbleNodes);

// the reused typing indicator (grey pill + three dots), parked at the bottom slot
const typing: NodeIR = group({ id: "typing", x: LEFT + 34, y: BOTTOM_SLOT, scale: 0.7, opacity: 0 }, [
  ri("typing-bg", 0, 0, 68, 40, "#262629", 20),
  ...[0, 1, 2].map((d) => ellipse({ id: `tdot${d}`, x: -14 + d * 14, y: 0, anchor: "center", width: 9, height: 9, fill: "#8A8A8E" })),
]);

// header (drawn over the thread with an opaque bg so scrolled bubbles tuck under it)
const header: NodeIR = group({ id: "header", x: 0, y: 0 }, [
  ri("hdr-bg", 0, TOP + 60, SW, 120, SCREEN),
  tx("hdr-time", LEFT, TOP + 23, "9:41", 17, 700, FG, "center-left"),
  rect({ id: "hdr-batt", x: RIGHT, y: TOP + 23, anchor: "center-right", width: 24, height: 12, fill: "none", stroke: MUTED, strokeWidth: 1.5, radius: 3 }),
  ri("hdr-battfill", RIGHT - 4, TOP + 23, 15, 7, FG, 1.5, { anchor: "center-right" }),
  tx("hdr-back", LEFT + 2, TOP + 70, "‹", 36, 400, BLUE),
  ellipse({ id: "hdr-avatar", x: 0, y: TOP + 56, anchor: "center", width: 42, height: 42, fill: linearGradient(["#34C7FF", "#0A78FF"], { angle: 135 }) }),
  tx("hdr-initial", 0, TOP + 57, "A", 20, 700, FG),
  tx("hdr-name", 0, TOP + 92, "Alex", 19, 700, FG),
  ri("hdr-sep", 0, TOP + 120, SW, 1, "#1C1C1F"),
]);

// input bar (opaque footer)
const sendArrow = "M 0 -7 L 7 1 L 2.5 1 L 2.5 8 L -2.5 8 L -2.5 1 L -7 1 Z";
const inputBar: NodeIR = group({ id: "inputbar", x: 0, y: 0 }, [
  ri("in-bg", 0, SH / 2 - 60, SW, 120, SCREEN),
  ellipse({ id: "in-plus", x: LEFT, y: SH / 2 - 72, anchor: "center", width: 30, height: 30, fill: "#1C1C1F" }),
  tx("in-plustxt", LEFT, SH / 2 - 74, "+", 24, 400, MUTED),
  rect({ id: "in-field", x: 18, y: SH / 2 - 72, anchor: "center", width: 252, height: 40, fill: "none", stroke: "#2A2A2E", strokeWidth: 1.5, radius: 20 }),
  tx("in-ph", LEFT + 50, SH / 2 - 73, "iMessage", 17, 400, "#6A6A70", "center-left"),
  ellipse({ id: "in-send", x: RIGHT, y: SH / 2 - 72, anchor: "center", width: 36, height: 36, fill: OUTGOING }),
  path({ id: "in-sendarrow", x: RIGHT, y: SH / 2 - 72, d: sendArrow, fill: FG }),
]);

const screenUI: NodeIR = group({ id: "screen-ui", x: 0, y: 0, opacity: 0 }, [thread, typing, header, inputBar]);

const phone = devicePreset("phone", { id: "phone", x: 0, y: 0, scale: 1, screen: SCREEN, content: [screenUI] });

const behaviors: BehaviorIR[] = [
  // the phone breathes; the typing dots bounce
  oscillate("phone-cam", "y", { amplitude: 8, frequency: 0.16, phase: 0 }),
  oscillate("phone-cam", "skewX", { amplitude: 0.8, frequency: 0.13, phase: 1 }),
  oscillate("phone-cam", "rotation", { amplitude: 0.4, frequency: 0.1, phase: 2 }),
  ...[0, 1, 2].map((d) => oscillate(`tdot${d}`, "y", { amplitude: 4, frequency: 3, phase: d * 0.9 })),
];

// per-message timeline: scroll the thread so the next slot reaches BOTTOM_SLOT,
// (incoming) show + bounce the typing indicator, then pop the bubble.
const sendMsg = (i: number, m: Msg): ReturnType<typeof seq> => {
  const scroll = tween("thread", { y: threadY(i) }, { duration: 0.34, ease: "easeOutCubic" });
  const pop = tween(`bubble-${i}`, { opacity: 1, scale: 1, y: slotY(i) }, { duration: 0.42, ease: "easeOutBack", label: `msg${i}` });
  if (m.side === "in") {
    return seq(
      scroll,
      tween("typing", { opacity: 1, scale: 1 }, { duration: 0.24, ease: "easeOutBack", label: `type${i}` }),
      wait(0.9),
      par(
        tween("typing", { opacity: 0, scale: 0.8 }, { duration: 0.16, ease: "easeInQuad" }),
        pop,
      ),
      wait(0.5),
    );
  }
  return seq(scroll, wait(0.08), pop, wait(0.55));
};

export default scene({
  id: "imessage-chat",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  behaviors,
  nodes: [
    // atmospheric backdrop: faint concentric layers fake a smooth navy glow, plus
    // a cool wash so the frame reads as depth rather than a flat void
    group({ id: "backdrop", x: 0, y: 0 }, [
      ...Array.from({ length: 14 }, (_, i) => {
        const t = i / 13;
        return ellipse({ id: `glow${i}`, x: CX, y: CY - 10, anchor: "center", width: (1360 - t * 1080) * 2, height: (1360 - t * 1080) * 2, fill: "#16294C", opacity: 0.045 });
      }),
      ...Array.from({ length: 8 }, (_, i) => {
        const t = i / 7;
        return ellipse({ id: `cool${i}`, x: CX, y: CY - 60, anchor: "center", width: (520 - t * 360) * 2, height: (520 - t * 360) * 2, fill: "#1E63B8", opacity: 0.03 });
      }),
    ]),
    group({ id: "stage", x: CX, y: CY, scale: 1 }, [
      ellipse({ id: "shadow", x: 0, y: 470, anchor: "center", width: 300, height: 70, fill: "#000000", opacity: 0, scaleX: 0.6 }),
      group({ id: "phone-cam", x: 0, y: 0, scale: 0.3, rotation: -16, skewX: -10, opacity: 0 }, [phone]),
    ]),
    group({ id: "caption", x: CX, y: 996, opacity: 0 }, [
      tx("cap-t", 0, 0, "every message here is code", 34, 800, FG),
      tx("cap-s", 0, 42, "written, edited, and rendered deterministically", 18, 400, MUTED),
    ]),
    text({ id: "wm", x: 1844, y: 1046, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 18, fontWeight: 700, fill: "#2A3140" }),
  ],
  timeline: seq(
    // ── 기 · wake (a curved entrance, the screen lights up) ──
    beatlessEntrance(),
    // ── 승 · 전 · the conversation ──
    ...MSGS.map((m, i) => sendMsg(i, m)),
    // ── 결 · tagline (ease back, caption resolves) ──
    seq(
      wait(0.6),
      par(
        tween("stage", { scale: 0.82, y: CY - 72 }, { duration: 1.2, ease: "easeInOutCubic", label: "pullback" }),
        tween("caption", { opacity: 1, y: 972 }, { duration: 0.9, ease: "easeOutCubic" }),
      ),
      wait(1.9),
    ),
  ),
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.16, fadeIn: 1.2, fadeOut: 2, duck: { depth: 0.35 } },
    cues: [
      { at: "drop", offset: 0.2, file: "maximize_009.ogg", gain: 0.4 },
      { at: "land", file: "bong_001.ogg", gain: 0.5 },
      { at: "wake", file: "maximize_001.ogg", gain: 0.3 },
      // typing indicators tick softly in
      ...MSGS.flatMap((m, i) => m.side === "in" ? [{ at: `type${i}`, file: "tick.wav", gain: 0.22 }] : []),
      // each bubble: outgoing swooshes (panned right), incoming plucks (panned left)
      ...MSGS.map((m, i) => m.side === "out"
        ? { at: `msg${i}`, file: "whoosh.wav", gain: 0.3, pan: 0.25 }
        : { at: `msg${i}`, file: "pluck_001.ogg", gain: 0.4, pan: -0.25 }),
      { at: "pullback", offset: 0.3, file: "glass_001.ogg", gain: 0.3 },
    ],
  },
});

// the phone arcs in, scales up into its hero tilt, the shadow grounds it, the
// screen wakes. Kept as a function so the timeline reads top-to-bottom.
function beatlessEntrance() {
  return seq(
    par(
      motionPath("phone-cam", [[-160, -460], [60, -130], [0, 0]], { duration: 1.3, ease: "easeOutBack", label: "drop" }),
      tween("phone-cam", { scale: HERO, rotation: -3, skewX: -4, opacity: 1 }, { duration: 1.3, ease: "easeOutBack" }),
      seq(wait(0.7), tween("shadow", { opacity: 0.45, scaleX: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "land" })),
    ),
    tween("screen-ui", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "wake" }),
    wait(0.3),
  );
}
