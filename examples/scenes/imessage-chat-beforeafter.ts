import {
  scene, group, rect, ellipse, text, path, seq, par, tween, wait, oscillate,
  devicePreset, deviceScreen, linearGradient, type NodeIR, type BehaviorIR,
} from "@reframe/core";

// BEFORE / AFTER, side by side in ONE scene: two identical iPhones text the same
// conversation in perfect lockstep (one shared, deterministic timeline). The two
// timelines are byte-identical through the punchline; the only difference is that
// the RIGHT phone carries an additive edit — a love tapback on the punchline and a
// confetti burst on "no way". Nothing on the left moves differently; the edit just
// slots extra pieces on top. That is the whole point: edits survive, in sync.
//
// Built by parametrising the single-phone scene by an id prefix ("l" / "r"), so
// both phones share the exact same builders + timing.

const W = 1920, H = 1080, CY = 540;
const BG = "#070A12";
const SCREEN = "#0B0B0D";
const FG = "#F2F2F7";
const MUTED = "#8E8E93";
const BLUE = "#0A84FF";

const { width: SW, height: SH } = deviceScreen("phone"); // 352 x 736
const TOP = -SH / 2;
const LEFT = -150, RIGHT = 150;
const BOTTOM_SLOT = 170, GAP = 62, BUBBLE_H = 46, FS = 25;

const S = 0.74;            // per-phone scale
const XL = 560, XR = 1360; // phone centres

const OUTGOING = linearGradient(["#2BA4FF", "#0A78FF"], { angle: 90 });

const ri = (id: string, x: number, y: number, w: number, h: number, fill: string, radius = 0, extra: Record<string, unknown> = {}): NodeIR =>
  rect({ id, x, y, anchor: "center", width: w, height: h, fill, radius, ...extra });
const tx = (id: string, x: number, y: number, s: string, size: number, weight: number, fill: string, anchor: "center" | "center-left" | "center-right" = "center"): NodeIR =>
  text({ id, x, y, anchor, content: s, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

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
const PUNCH = 5; // the bubble the tapback lands on

const bubbleW = (s: string): number => Math.min(290, Math.max(76, s.length * 12.6 + 40));
const slotY = (i: number): number => i * GAP;
const threadY = (i: number): number => BOTTOM_SLOT - i * GAP;

// ── confetti (seeded, deterministic — a fractional-sine hash, no random) ──
const CONF_COLORS = ["#FF4D6D", "#FFC24B", "#3AA0FF", "#46E5A0", "#7C5CFF", "#FF8A3A"];
const fracHash = (i: number, s: number): number => { const v = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const CONF_N = 28;
interface Conf { id: string; x0: number; rot0: number; col: string; w: number; h: number; delay: number; dur: number; xEnd: number; rotEnd: number }
const CONF: Conf[] = Array.from({ length: CONF_N }, (_, i) => {
  const x0 = (fracHash(i, 1) - 0.5) * (SW - 24);
  const drift = (fracHash(i, 7) - 0.5) * 70;
  const dir = fracHash(i, 8) > 0.5 ? 1 : -1;
  const rot0 = fracHash(i, 4) * 360;
  return {
    id: `conf-${i}`, x0, rot0, col: CONF_COLORS[i % CONF_COLORS.length]!,
    w: 8 + fracHash(i, 2) * 6, h: 12 + fracHash(i, 3) * 7,
    delay: fracHash(i, 5) * 0.5, dur: 1.5 + fracHash(i, 6) * 0.9,
    xEnd: x0 + drift, rotEnd: rot0 + dir * (200 + fracHash(i, 9) * 420),
  };
});

const HEART = "M 0 5 C -2 1 -8 -1 -8 -6 C -8 -9 -5 -11 -2.5 -9.5 C -1 -8.6 0 -7.2 0 -7.2 C 0 -7.2 1 -8.6 2.5 -9.5 C 5 -11 8 -9 8 -6 C 8 -1 2 1 0 5 Z";
const sendArrow = "M 0 -7 L 7 1 L 2.5 1 L 2.5 8 L -2.5 8 L -2.5 1 L -7 1 Z";

// ── one phone's screen content, all ids prefixed by P ──
function screenUI(P: string, edit: boolean): NodeIR {
  const bubbles: NodeIR[] = MSGS.map((m, i) => {
    const w = bubbleW(m.text);
    const cx = m.side === "in" ? LEFT + w / 2 : RIGHT - w / 2;
    const rise = m.side === "out" ? 26 : 12;
    return group({ id: `${P}-bubble-${i}`, x: cx, y: slotY(i) + rise, scale: 0.7, opacity: 0 }, [
      rect({ id: `${P}-bubble-${i}-bg`, x: 0, y: 0, anchor: "center", width: w, height: BUBBLE_H, radius: BUBBLE_H / 2, fill: m.side === "out" ? OUTGOING : "#262629" }),
      tx(`${P}-bubble-${i}-t`, 0, 1, m.text, FS, 400, FG),
      ...(edit && i === PUNCH ? [group({ id: `${P}-tapback`, x: -w / 2 + 10, y: -BUBBLE_H / 2 - 12, scale: 0, opacity: 0 }, [
        ellipse({ id: `${P}-tb-dot2`, x: 10, y: 20, anchor: "center", width: 7, height: 7, fill: "#262629" }),
        ellipse({ id: `${P}-tb-dot1`, x: 4, y: 13, anchor: "center", width: 11, height: 11, fill: "#262629" }),
        ellipse({ id: `${P}-tb-bg`, x: 0, y: 0, anchor: "center", width: 38, height: 38, fill: "#262629" }),
        path({ id: `${P}-tb-heart`, x: 0, y: 1, d: HEART, fill: "#FF4D6D" }),
      ])] : []),
    ]);
  });
  const thread = group({ id: `${P}-thread`, x: 0, y: BOTTOM_SLOT }, bubbles);

  const typing = group({ id: `${P}-typing`, x: LEFT + 34, y: BOTTOM_SLOT, scale: 0.7, opacity: 0 }, [
    ri(`${P}-typing-bg`, 0, 0, 68, 40, "#262629", 20),
    ...[0, 1, 2].map((d) => ellipse({ id: `${P}-tdot${d}`, x: -14 + d * 14, y: 0, anchor: "center", width: 9, height: 9, fill: "#8A8A8E" })),
  ]);

  const confetti = group({ id: `${P}-confetti`, x: 0, y: 0 }, CONF.map((c) =>
    rect({ id: `${P}-${c.id}`, x: c.x0, y: TOP - 30, anchor: "center", width: c.w, height: c.h, fill: c.col, radius: 2, rotation: c.rot0, opacity: 0 })));

  const header = group({ id: `${P}-header`, x: 0, y: 0 }, [
    ri(`${P}-hdr-bg`, 0, TOP + 60, SW, 120, SCREEN),
    tx(`${P}-hdr-time`, LEFT, TOP + 23, "9:41", 17, 700, FG, "center-left"),
    rect({ id: `${P}-hdr-batt`, x: RIGHT, y: TOP + 23, anchor: "center-right", width: 24, height: 12, fill: "none", stroke: MUTED, strokeWidth: 1.5, radius: 3 }),
    ri(`${P}-hdr-battfill`, RIGHT - 4, TOP + 23, 15, 7, FG, 1.5, { anchor: "center-right" }),
    tx(`${P}-hdr-back`, LEFT + 2, TOP + 70, "‹", 36, 400, BLUE),
    ellipse({ id: `${P}-hdr-avatar`, x: 0, y: TOP + 56, anchor: "center", width: 42, height: 42, fill: linearGradient(["#34C7FF", "#0A78FF"], { angle: 135 }) }),
    tx(`${P}-hdr-initial`, 0, TOP + 57, "A", 20, 700, FG),
    tx(`${P}-hdr-name`, 0, TOP + 92, "Alex", 19, 700, FG),
    ri(`${P}-hdr-sep`, 0, TOP + 120, SW, 1, "#1C1C1F"),
  ]);

  const inputBar = group({ id: `${P}-inputbar`, x: 0, y: 0 }, [
    ri(`${P}-in-bg`, 0, SH / 2 - 60, SW, 120, SCREEN),
    ellipse({ id: `${P}-in-plus`, x: LEFT, y: SH / 2 - 72, anchor: "center", width: 30, height: 30, fill: "#1C1C1F" }),
    tx(`${P}-in-plustxt`, LEFT, SH / 2 - 74, "+", 24, 400, MUTED),
    rect({ id: `${P}-in-field`, x: 18, y: SH / 2 - 72, anchor: "center", width: 252, height: 40, fill: "none", stroke: "#2A2A2E", strokeWidth: 1.5, radius: 20 }),
    tx(`${P}-in-ph`, LEFT + 50, SH / 2 - 73, "iMessage", 17, 400, "#6A6A70", "center-left"),
    ellipse({ id: `${P}-in-send`, x: RIGHT, y: SH / 2 - 72, anchor: "center", width: 36, height: 36, fill: OUTGOING }),
    path({ id: `${P}-in-sendarrow`, x: RIGHT, y: SH / 2 - 72, d: sendArrow, fill: FG }),
  ]);

  const kids = edit ? [thread, typing, confetti, header, inputBar] : [thread, typing, header, inputBar];
  return group({ id: `${P}-ui`, x: 0, y: 0, opacity: 0 }, kids);
}

function phoneStage(P: string, cx: number, edit: boolean): NodeIR {
  const phone = devicePreset("phone", { id: `${P}-phone`, x: 0, y: 0, scale: 1, screen: SCREEN, content: [screenUI(P, edit)] });
  return group({ id: `${P}-stage`, x: cx, y: CY, scale: S }, [
    ellipse({ id: `${P}-shadow`, x: 0, y: 470, anchor: "center", width: 300, height: 70, fill: "#000000", opacity: 0.4, scaleX: 0.6 }),
    group({ id: `${P}-cam`, x: 0, y: 0, scale: 0.9, opacity: 0 }, [phone]),
  ]);
}

function phoneBehaviors(P: string): BehaviorIR[] {
  return [
    oscillate(`${P}-cam`, "y", { amplitude: 8, frequency: 0.16, phase: 0 }),
    oscillate(`${P}-cam`, "skewX", { amplitude: 0.8, frequency: 0.13, phase: 1 }),
    ...[0, 1, 2].map((d) => oscillate(`${P}-tdot${d}`, "y", { amplitude: 4, frequency: 3, phase: d * 0.9 })),
  ];
}

// one message for phone P. `audio` true emits the labels we anchor sfx to (only
// the right phone, so cues don't double). Identical duration for both phones.
function sendMsg(P: string, i: number, m: Msg, audio: boolean): ReturnType<typeof seq> {
  const scroll = tween(`${P}-thread`, { y: threadY(i) }, { duration: 0.34, ease: "easeOutCubic" });
  const pop = tween(`${P}-bubble-${i}`, { opacity: 1, scale: 1, y: slotY(i) }, { duration: 0.42, ease: "easeOutBack", ...(audio ? { label: `msg${i}` } : {}) });
  if (m.side === "in") {
    return seq(
      scroll,
      tween(`${P}-typing`, { opacity: 1, scale: 1 }, { duration: 0.24, ease: "easeOutBack", ...(audio ? { label: `type${i}` } : {}) }),
      wait(0.9),
      par(tween(`${P}-typing`, { opacity: 0, scale: 0.8 }, { duration: 0.16, ease: "easeInQuad" }), pop),
      wait(0.5),
    );
  }
  return seq(scroll, wait(0.08), pop, wait(0.55));
}

// the tapback pops during msg5's trailing wait (no added duration → phones stay in sync)
function tapbackPop(P: string): ReturnType<typeof seq> {
  return seq(
    wait(0.85),
    tween(`${P}-tapback`, { opacity: 1, scale: 1.18 }, { duration: 0.34, ease: "easeOutBack", label: "tapback" }),
    tween(`${P}-tapback`, { scale: 1 }, { duration: 0.16, ease: "easeOutCubic" }),
  );
}

function convoSteps(P: string, edit: boolean, audio: boolean): ReturnType<typeof seq> {
  return seq(...MSGS.map((m, i) =>
    edit && i === PUNCH
      ? par(sendMsg(P, i, m, audio), tapbackPop(P))   // overlay, fits inside the step
      : sendMsg(P, i, m, audio)));
}

function confettiBurst(P: string): ReturnType<typeof par> {
  return par(...CONF.map((c) => seq(
    wait(c.delay),
    tween(`${P}-${c.id}`, { opacity: 1 }, { duration: 0.12, ease: "linear" }),
    tween(`${P}-${c.id}`, { y: SH / 2 + 50, x: c.xEnd, rotation: c.rotEnd }, { duration: c.dur, ease: "easeInQuad" }),
  )));
}

export default scene({
  id: "imessage-chat-beforeafter",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  behaviors: [...phoneBehaviors("l"), ...phoneBehaviors("r")],
  nodes: [
    group({ id: "backdrop", x: 0, y: 0 }, [
      ...Array.from({ length: 14 }, (_, i) => {
        const t = i / 13;
        return ellipse({ id: `glow${i}`, x: W / 2, y: CY - 10, anchor: "center", width: (1500 - t * 1100) * 2, height: (1500 - t * 1100) * 2, fill: "#16294C", opacity: 0.04 });
      }),
    ]),
    phoneStage("l", XL, false),
    phoneStage("r", XR, true),
    group({ id: "labels", x: 0, y: 0, opacity: 0 }, [
      tx("lab-l", XL, 168, "original", 22, 700, MUTED),
      tx("lab-r", XR, 168, "after the edit", 22, 800, FG),
      ellipse({ id: "lab-r-dot", x: XR - 122, y: 162, anchor: "center", width: 12, height: 12, fill: "#FF4D6D" }),
    ]),
    group({ id: "caption", x: W / 2, y: 936, opacity: 0 }, [
      tx("cap-t", 0, 0, "one sentence changed only the right", 32, 800, FG),
      tx("cap-s", 0, 40, "same bubbles, same timing. the heart and confetti just slotted in", 18, 400, MUTED),
    ]),
    text({ id: "wm", x: 1844, y: 1046, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 18, fontWeight: 700, fill: "#2A3140" }),
  ],
  timeline: seq(
    // both phones wake together
    par(
      tween("l-cam", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "wake" }),
      tween("r-cam", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutCubic" }),
      tween("l-ui", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" }),
      tween("r-ui", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" }),
      tween("labels", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" }),
    ),
    wait(0.3),
    // the shared conversation: left plain, right with the tapback. In lockstep.
    par(convoSteps("l", false, false), convoSteps("r", true, true)),
    // the finale: confetti on the right (its screen only), the caption resolves
    seq(
      wait(0.01, "confetti"),
      par(
        confettiBurst("r"),
        tween("caption", { opacity: 1, y: 912 }, { duration: 0.9, ease: "easeOutCubic" }),
      ),
      wait(0.8),
    ),
  ),
  audio: {
    bgm: { synth: "ambient-pad", gain: 0.16, fadeIn: 1.2, fadeOut: 2, duck: { depth: 0.35 } },
    cues: [
      { at: "wake", file: "maximize_001.ogg", gain: 0.3 },
      ...MSGS.flatMap((m, i) => m.side === "in" ? [{ at: `type${i}`, file: "tick.wav", gain: 0.22 }] : []),
      ...MSGS.map((m, i) => m.side === "out"
        ? { at: `msg${i}`, file: "whoosh.wav", gain: 0.3 }
        : { at: `msg${i}`, file: "pluck_001.ogg", gain: 0.4 }),
      { at: "tapback", file: "pluck_002.ogg", gain: 0.5 },
      { at: "confetti", file: "rise.wav", gain: 0.4 },
      { at: "confetti", offset: 0.15, file: "confirmation_004.ogg", gain: 0.45 },
    ],
  },
});
