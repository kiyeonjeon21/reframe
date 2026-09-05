// X Money — a 6-chapter feature montage in the style of refs/f5E9mA4Pf6Emo5Dw.mp4.
// Structural homage (reframe vectors/gradients, deterministic): each chapter is a
// "panel" laid out left-to-right in world space; the camera pans one panel-width
// between chapters (the reference's horizontal carousel slide).
//
//   pnpm reframe render xmoney-promo.ts --motion-blur 10 -o out/xmoney-promo.mp4
//
// Pure function of time (seeded fx only) -> deterministic, golden-safe.

import {
  scene, group, rect, ellipse, line, path, text,
  seq, par, stagger, beat, tween, wait, cameraTo, oscillate,
  splitText, linearGradient, glow,
  type NodeIR, type TimelineIR, type Ease,
} from "@reframe/core";

// ── canvas / world ───────────────────────────────────────────────────────────
const W = 1080, H = 1080, CX = W / 2;
const PANEL = W;
const D = 4.0;                            // seconds per chapter
const SLIDE = 0.5;                        // carousel pan duration

// ── palette ──────────────────────────────────────────────────────────────────
const BG = "#000000";
const WHITE = "#F4F4F2";
const GRAY = "#8A8A90";
const GREEN = "#3DDC7F";                  // positive deltas
const GREENL = "#2EA866";                 // chart line
const GREENG = "#62F08A";                 // passkey glyph (bright)
const CARD = "#0F0F12";
const CARDLINE = "#242428";
const BLUE = "#1D9BF0";

// ─────────────────────────────────────────────────────────────────────────────
// X brand mark — the actual X logo glyph (filled path, 24-unit box centred at 12,12).
// ─────────────────────────────────────────────────────────────────────────────
const X_LOGO = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
function xLogo(id: string, cx: number, cy: number, size: number, fill: string, opacity = 1): NodeIR {
  return group({ id, x: cx, y: cy, scale: size / 24, opacity }, [
    path({ id: `${id}-p`, x: -12, y: -12, d: X_LOGO, fill }),
  ]);
}

// rounded-rect outline path (centred at 0,0) — drawn around via `progress` for a border-trace
const rrOutline = (w: number, h: number, r: number) => {
  const x = w / 2, y = h / 2;
  return `M ${-x + r} ${-y} L ${x - r} ${-y} Q ${x} ${-y} ${x} ${-y + r} L ${x} ${y - r} Q ${x} ${y} ${x - r} ${y} L ${-x + r} ${y} Q ${-x} ${y} ${-x} ${y - r} L ${-x} ${-y + r} Q ${-x} ${-y} ${-x + r} ${-y} Z`;
};
// platinum edge-lit gradient for a more luxurious traced border
const BORDER_GRAD = linearGradient(["#FBFBFF", "#7E7E92", "#FBFBFF", "#9A9AAE", "#FBFBFF"], { angle: 118 });

// ── caption helpers (subtle fade-in, like the reference) ─────────────────────
const headNode = (id: string, y: number, s: string) =>
  text({ id, x: CX, y, anchor: "center", content: s, fontFamily: "Inter", fontSize: 54, fontWeight: 800, fill: WHITE, opacity: 0 });
const subNode = (id: string, y: number, s: string) =>
  text({ id, x: CX, y, anchor: "center", content: s, fontFamily: "Inter", fontSize: 27, fontWeight: 400, fill: GRAY, opacity: 0 });
const fadeIn = (ids: string[], label?: string): TimelineIR =>
  par(...ids.map((id, i) => tween(id, { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: i === 0 ? label : undefined })));

// a centred "<pre> [X] <post>" lockup with the brand mark inline
function lockupX(idp: string, pre: string, post: string, o: { y: number; fontSize: number; fontWeight: 400 | 700 | 800; fill: string }) {
  const measure = (s: string) => s ? splitText(s, { id: `${idp}_m`, x: 0, y: 0, fontSize: o.fontSize, fontWeight: o.fontWeight }).width : 0;
  const w1 = measure(pre), w2 = measure(post);
  const xs = o.fontSize * 0.92, gap = o.fontSize * 0.16;
  const total = w1 + (pre ? gap : 0) + xs + gap + w2;
  const left = CX - total / 2;
  const xcx = left + w1 + (pre ? gap : 0) + xs / 2;
  const postX = xcx + xs / 2 + gap;
  return {
    nodes: [
      ...(pre ? [text({ id: `${idp}-p`, x: left, y: o.y, anchor: "center-left", content: pre, fontFamily: "Inter", fontSize: o.fontSize, fontWeight: o.fontWeight, fill: o.fill, opacity: 0 })] : []),
      xLogo(`${idp}-x`, xcx, o.y, xs, o.fill, 0),
      text({ id: `${idp}-q`, x: postX, y: o.y, anchor: "center-left", content: post, fontFamily: "Inter", fontSize: o.fontSize, fontWeight: o.fontWeight, fill: o.fill, opacity: 0 }),
    ] as NodeIR[],
    ids: [...(pre ? [`${idp}-p`] : []), `${idp}-x`, `${idp}-q`],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Odometer money reel — each digit is a clipped window over a vertical column of
// glyphs; the column slides DOWN so digits roll over one-by-one (new digit drops in
// from the top), the mechanical count-up the reference uses. Returns the nodes plus
// an `anim()` that rolls every reel to its target (lower places spin longer/settle last).
// ─────────────────────────────────────────────────────────────────────────────
function moneyReel(idp: string, formatted: string, prefix: string, o: { cx: number; y: number; fontSize: number; fontWeight: 400 | 700 | 800; fill: string; dur: number; grow?: boolean; align?: "left" | "center" }) {
  const fs = o.fontSize, digitW = fs * 0.56, commaW = fs * 0.3, preW = fs * 0.64, H = fs * 1.18;
  const chars = [...formatted];
  const isDigit = chars.map((c) => /\d/.test(c));
  const nDigits = isDigit.filter(Boolean).length;
  // digits to the right of each char (used to time the "grow" reveal, right -> left)
  const dRight: number[] = []; { let c = 0; for (let i = chars.length - 1; i >= 0; i--) { dRight[i] = c; if (isDigit[i]) c++; } }
  let total = prefix ? preW : 0;
  for (const ch of chars) total += /\d/.test(ch) ? digitW : commaW;
  let x = o.align === "left" ? o.cx : o.cx - total / 2;
  const startO = o.grow ? 0 : 1;
  const nodes: NodeIR[] = [];
  type Slot = { reveal: string; reel?: string; di?: number; dr: number };
  const slots: Slot[] = [];
  if (prefix) { nodes.push(text({ id: `${idp}-pre`, x, y: o.y, anchor: "center-left", content: prefix, fontFamily: "Inter", fontSize: fs, fontWeight: o.fontWeight, fill: o.fill })); x += preW; }
  let di = 0, ci = 0;
  for (let i = 0; i < chars.length; i++) {
    if (isDigit[i]) {
      const fromRight = nDigits - 1 - di, spins = 1, target = Number(chars[i]);
      const steps = spins * 10 + target;
      const col: NodeIR[] = [];
      for (let r = 0; r <= steps; r++) col.push(text({ id: `${idp}-d${di}-${r}`, x: 0, y: r * H, anchor: "center", content: String(((steps - r) % 10 + 10) % 10), fontFamily: "Inter", fontSize: fs, fontWeight: o.fontWeight, fill: o.fill }));
      const reelId = `${idp}-reel${di}`, clipId = `${idp}-clip${di}`;
      nodes.push(group({ id: clipId, x: x + digitW / 2, y: o.y, opacity: startO, clip: { kind: "rect", x: -digitW / 2 - 3, y: -H / 2, width: digitW + 6, height: H } }, [
        group({ id: reelId, x: 0, y: -steps * H }, col),
      ]));
      slots.push({ reveal: clipId, reel: reelId, di, dr: dRight[i]! });
      x += digitW; di++;
    } else {
      const sepId = `${idp}-sep${ci++}`;
      nodes.push(text({ id: sepId, x: x + commaW / 2, y: o.y, anchor: "center", content: chars[i], fontFamily: "Inter", fontSize: fs, fontWeight: o.fontWeight, fill: o.fill, opacity: startO }));
      slots.push({ reveal: sepId, dr: dRight[i]! });
      x += commaW;
    }
  }
  const step = (o.dur * 0.4) / Math.max(1, nDigits - 1);
  // LINEAR (constant slow roll) — easeOut* front-loads the motion into a fast initial blur,
  // which is what reads as "too fast" no matter the duration. Constant speed reads much slower.
  const ROLL: Ease = "linear";
  const anim = (label?: string): TimelineIR => {
    if (o.grow) {
      // digits appear right -> left (the number grows in magnitude), each rolls to its target by o.dur
      return par(...slots.map((s) => {
        const delay = s.dr * step;
        const reveal = tween(s.reveal, { opacity: 1 }, { duration: 0.24, ease: "easeOutQuad" });
        const body = s.reel
          ? par(reveal, tween(s.reel, { y: 0 }, { duration: Math.max(0.6, o.dur - delay), ease: ROLL, label: s.di === nDigits - 1 ? label : undefined }))
          : reveal;
        return delay > 0 ? seq(wait(delay), body) : body;
      }));
    }
    // classic: all visible, every reel rolls at a steady slow pace; lower places settle last
    return par(...slots.filter((s) => s.reel).map((s) =>
      tween(s.reel!, { y: 0 }, { duration: o.dur * (0.78 + 0.055 * s.di!), ease: ROLL, label: s.di === nDigits - 1 ? label : undefined })));
  };
  return { nodes, anim };
}

// ── panel wrapper ─────────────────────────────────────────────────────────────
const panel = (i: number, nodes: NodeIR[]): NodeIR => group({ id: `ch${i}`, x: i * PANEL, y: 0 }, nodes);
const camX = (i: number) => i * PANEL + CX;

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER 0 — "Welcome to X Money" : 2×2 account cards, balances rolling
// ═══════════════════════════════════════════════════════════════════════════
const C0 = { w: 316, h: 160 };
const c0cells = [
  { x: CX - 170, y: 250 }, { x: CX + 170, y: 250 },
  { x: CX - 170, y: 432 }, { x: CX + 170, y: 432 },
];
const c0amounts = ["12,409", "8,035", "27,604"];
const c0reels = c0amounts.map((amt, i) => moneyReel(`c0b${i}`, amt, "$", { cx: -C0.w / 2 + 28, y: 50, fontSize: 38, fontWeight: 700, fill: WHITE, dur: 3.0, align: "left" }));
type Acct = { label: string; delta: string; avatar: NodeIR };
function accountCard(idx: number, a: Acct): NodeIR {
  const c = c0cells[idx]!;
  const L = -C0.w / 2 + 28;
  return group({ id: `c0-card${idx}`, x: c.x, y: c.y + 22, opacity: 0 }, [
    // soft accent glow under the card
    rect({ id: `c0-glow${idx}`, x: 0, y: 0, anchor: "center", width: C0.w, height: C0.h, radius: 28, fill: CARD, shadowColor: "#3A3A4A", shadowBlur: 26 }),
    // dark fill with a faint base edge; the bright border is TRACED on (below)
    rect({ id: `c0-bg${idx}`, x: 0, y: 0, anchor: "center", width: C0.w, height: C0.h, radius: 28, fill: CARD, stroke: "#1C1C22", strokeWidth: 2 }),
    // top inner highlight (glass edge)
    rect({ id: `c0-hl${idx}`, x: 0, y: -C0.h / 2 + 6, anchor: "center", width: C0.w - 56, height: 2, radius: 1, fill: "#ffffff33", blend: "screen" }),
    // luxurious traced border — a platinum edge-lit line drawn around the outline
    path({ id: `c0-bd${idx}`, x: 0, y: 0, d: rrOutline(C0.w, C0.h, 28), fill: "none", stroke: BORDER_GRAD, strokeWidth: 1.8, progress: 0, ...glow("#D6D6F0", 7) }),
    a.avatar,
    text({ id: `c0-lbl${idx}`, x: L + 46, y: -46, anchor: "center-left", content: a.label, fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: WHITE }),
    text({ id: `c0-dl${idx}`, x: L, y: 14, anchor: "center-left", content: a.delta, fontFamily: "Inter", fontSize: 20, fontWeight: 400, fill: GREEN }),
    ...c0reels[idx]!.nodes,
  ]);
}
const c0avatar = (idx: number, fill: string, inner?: NodeIR) =>
  group({ id: `c0-av${idx}`, x: -C0.w / 2 + 28 + 18, y: -46 }, [
    ellipse({ id: `c0-avc${idx}`, x: 0, y: 0, width: 42, height: 42, anchor: "center", fill }),
    ...(inner ? [inner] : []),
  ]);
const c0cards = [
  accountCard(0, { label: "Account 1", delta: "+$12.21", avatar: c0avatar(0, "#E6B98C") }),
  accountCard(1, { label: "Savings", delta: "+$35.21", avatar: c0avatar(1, BLUE, text({ id: "c0-avS", x: 0, y: 0, anchor: "center", content: "S", fontFamily: "Inter", fontSize: 22, fontWeight: 800, fill: "#FFFFFF" })) }),
  accountCard(2, { label: "Business", delta: "+$56.24", avatar: c0avatar(2, "#3A3A40", rect({ id: "c0-avB", x: 0, y: 0, anchor: "center", width: 21, height: 16, radius: 3, fill: "none", stroke: "#FFFFFF", strokeWidth: 3 })) }),
];
const c0add = group({ id: "c0-add", x: c0cells[3]!.x, y: c0cells[3]!.y + 22, opacity: 0 }, [
  rect({ id: "c0-addglow", x: 0, y: 0, anchor: "center", width: C0.w, height: C0.h, radius: 28, fill: "#0B0B0D", shadowColor: "#3A3A4A", shadowBlur: 26 }),
  rect({ id: "c0-addbg", x: 0, y: 0, anchor: "center", width: C0.w, height: C0.h, radius: 28, fill: "#0B0B0D", stroke: "#1C1C22", strokeWidth: 2 }),
  rect({ id: "c0-addhl", x: 0, y: -C0.h / 2 + 6, anchor: "center", width: C0.w - 56, height: 2, radius: 1, fill: "#ffffff33", blend: "screen" }),
  path({ id: "c0-bd3", x: 0, y: 0, d: rrOutline(C0.w, C0.h, 28), fill: "none", stroke: BORDER_GRAD, strokeWidth: 1.8, progress: 0, ...glow("#D6D6F0", 7) }),
  line({ id: "c0-addv", x1: 0, y1: -19, x2: 0, y2: 19, stroke: GRAY, strokeWidth: 4 }),
  line({ id: "c0-addh", x1: -19, y1: 0, x2: 19, y2: 0, stroke: GRAY, strokeWidth: 4 }),
]);
const c0head = lockupX("c0-h", "Welcome to", "Money", { y: 800, fontSize: 54, fontWeight: 800, fill: WHITE });
const c0subs = [subNode("c0-s0", 864, "Accounts for every day spending,"), subNode("c0-s1", 904, "saving, sending, and more.")];
const chapter0 = panel(0, [...c0cards, c0add, ...c0head.nodes, ...c0subs]);

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER 1 — "Tap into everything" : brushed-graphite X card, slow 3D turn
// ═══════════════════════════════════════════════════════════════════════════
const CARD_W = 600, CARD_H = 374, CARD_CY = 360;
const metal = linearGradient(
  [{ offset: 0, color: "#34373c" }, { offset: 0.28, color: "#868990" }, { offset: 0.46, color: "#5b5e64" }, { offset: 0.64, color: "#a4a7ad" }, { offset: 0.82, color: "#56595f" }, { offset: 1, color: "#3a3d42" }],
  { angle: 120 });
const metalBack = linearGradient(
  [{ offset: 0, color: "#2b2e33" }, { offset: 0.3, color: "#6e7178" }, { offset: 0.5, color: "#4a4d53" }, { offset: 0.7, color: "#80838a" }, { offset: 1, color: "#2f3237" }],
  { angle: 120 });
// FRONT face — chip + embossed X + card details
const c1front = group({ id: "c1-front", x: 0, y: 0 }, [
  rect({ id: "c1-base", x: 0, y: 0, anchor: "center", width: CARD_W, height: CARD_H, radius: 34, fill: metal }),
  rect({ id: "c1-chip", x: -CARD_W / 2 + 92, y: -CARD_H / 2 + 88, anchor: "center", width: 76, height: 58, radius: 11,
    fill: linearGradient(["#c9b16a", "#9a7d35", "#dcc985"], { angle: 120 }), stroke: "#7a6228", strokeWidth: 1 }),
  line({ id: "c1-chipl", x1: -CARD_W / 2 + 92, y1: -CARD_H / 2 + 88, x2: -CARD_W / 2 + 92, y2: -CARD_H / 2 + 117, stroke: "#7a6228", strokeWidth: 1 }),
  // embossed X LOGO (same-tone bevel: dark offset + light offset over the metal)
  xLogo("c1-xlo", 116, 10, 250, "#26282c", 0.42),
  xLogo("c1-xhi", 106, -2, 250, "#eef0f2", 0.30),
  text({ id: "c1-num", x: -CARD_W / 2 + 56, y: CARD_H / 2 - 70, anchor: "center-left", content: "5412  ••••  ••••  1745", fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: "#e8eaed88" }),
  text({ id: "c1-name", x: -CARD_W / 2 + 56, y: CARD_H / 2 - 38, anchor: "center-left", content: "X MONEY", fontFamily: "Inter", fontSize: 17, fontWeight: 700, fill: "#e8eaed66" }),
  text({ id: "c1-visa", x: CARD_W / 2 - 56, y: CARD_H / 2 - 44, anchor: "center-right", content: "VISA", fontFamily: "Inter", fontSize: 28, fontWeight: 800, fill: "#eef0f2aa" }),
  rect({ id: "c1-hl", x: -300, y: 0, anchor: "center", width: 140, height: CARD_H * 1.7, rotation: 16,
    fill: linearGradient(["#ffffff00", "#ffffffcc", "#ffffff00"], { angle: 0 }), blend: "screen" }),
]);
// BACK face — magnetic stripe + signature panel + watermark. The affine perspective
// keeps orientation past 90° (|cos|, no true mirror), so the back is authored upright.
const c1back = group({ id: "c1-back", x: 0, y: 0, opacity: 0 }, [
  rect({ id: "c1-bbase", x: 0, y: 0, anchor: "center", width: CARD_W, height: CARD_H, radius: 34, fill: metalBack }),
  rect({ id: "c1-mag", x: 0, y: -CARD_H / 2 + 66, anchor: "center", width: CARD_W, height: 58, fill: "#141418" }),
  rect({ id: "c1-sig", x: -36, y: 18, anchor: "center", width: CARD_W - 150, height: 46, radius: 5, fill: "#e7e7ea" }),
  text({ id: "c1-sigt", x: -36, y: 18, anchor: "center", content: "authorized signature", fontFamily: "Inter", fontSize: 16, fontWeight: 400, fill: "#9a9aa2" }),
  rect({ id: "c1-cvv", x: CARD_W / 2 - 96, y: 18, anchor: "center", width: 84, height: 46, radius: 5, fill: "#e7e7ea" }),
  text({ id: "c1-cvvt", x: CARD_W / 2 - 96, y: 18, anchor: "center", content: "•••", fontFamily: "Inter", fontSize: 22, fontWeight: 700, fill: "#5a5a62" }),
  xLogo("c1-bx", 150, -6, 92, "#ffffff1f"),
  text({ id: "c1-bname", x: -CARD_W / 2 + 56, y: CARD_H / 2 - 40, anchor: "center-left", content: "X MONEY", fontFamily: "Inter", fontSize: 18, fontWeight: 800, fill: "#eef0f288" }),
  text({ id: "c1-bfdic", x: CARD_W / 2 - 56, y: CARD_H / 2 - 40, anchor: "center-right", content: "MEMBER FDIC", fontFamily: "Inter", fontSize: 14, fontWeight: 700, fill: "#cfd1d655" }),
]);
const c1card = group({ id: "c1-card", x: CX, y: CARD_CY, rotateX: -14, rotateY: -20, opacity: 0, scale: 0.9,
  clip: { kind: "rect", x: -CARD_W / 2, y: -CARD_H / 2, width: CARD_W, height: CARD_H, radius: 34 }, ...glow("#000000DD", 72) }, [
  c1front, c1back,
]);
const c1head = headNode("c1-h0", 814, "Tap into everything");
const c1subs = [subNode("c1-s0", 866, "Custom metal Visa debit card with free ATM"), subNode("c1-s1", 906, "withdrawals and no foreign transaction fees.")];
const chapter1 = panel(1, [c1card, c1head, ...c1subs]);

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER 2 — "Pay anyone, any way" : scrolling transaction feed
// ═══════════════════════════════════════════════════════════════════════════
const ROW_W = 560, ROW_H = 94;
// a small recognizable brand mark (or a personal avatar) inside the icon slot
function brandIcon(id: string, cx: number, cy: number, brand: string, color?: string, initial?: string): NodeIR {
  const S = 54;
  const sq = (fill: string) => rect({ id: `${id}-sq`, x: cx, y: cy, anchor: "center", width: S, height: S, radius: 15, fill });
  switch (brand) {
    case "bluebottle": return group({ id, x: 0, y: 0 }, [
      sq("#FFFFFF"),
      rect({ id: `${id}-bn`, x: cx, y: cy - 13, anchor: "center", width: 7, height: 10, fill: "#1166B5" }),
      path({ id: `${id}-bb`, x: cx, y: cy + 4, d: "M -9 -8 Q -9 -12 0 -12 Q 9 -12 9 -8 L 8 13 Q 8 17 0 17 Q -8 17 -8 13 Z", fill: "#1166B5" }),
    ]);
    case "mcdonalds": return group({ id, x: 0, y: 0 }, [
      sq("#D81F26"),
      path({ id: `${id}-m`, x: cx, y: cy + 2, d: "M -16 14 L -16 -10 Q -16 -16 -8 -16 Q -1 -16 -1 -6 L -1 14 M 1 14 L 1 -6 Q 1 -16 8 -16 Q 16 -16 16 -10 L 16 14", fill: "none", stroke: "#FFC72C", strokeWidth: 6 }),
    ]);
    case "chase": return group({ id, x: 0, y: 0 }, [
      sq("#1066B0"),
      rect({ id: `${id}-d`, x: cx, y: cy, anchor: "center", width: 24, height: 24, radius: 3, rotation: 45, fill: "none", stroke: "#FFFFFF", strokeWidth: 5 }),
    ]);
    case "starbucks": return group({ id, x: 0, y: 0 }, [
      ellipse({ id: `${id}-c`, x: cx, y: cy, width: S, height: S, anchor: "center", fill: "#00704A" }),
      ellipse({ id: `${id}-r`, x: cx, y: cy, width: 34, height: 34, anchor: "center", fill: "none", stroke: "#FFFFFF", strokeWidth: 3 }),
      ellipse({ id: `${id}-i`, x: cx, y: cy, width: 13, height: 13, anchor: "center", fill: "#FFFFFF" }),
    ]);
    default: return group({ id, x: 0, y: 0 }, [   // person avatar
      ellipse({ id: `${id}-c`, x: cx, y: cy, width: S, height: S, anchor: "center", fill: color ?? "#7C5CFF" }),
      text({ id: `${id}-t`, x: cx, y: cy, anchor: "center", content: initial ?? "?", fontFamily: "Inter", fontSize: 24, fontWeight: 800, fill: "#FFFFFF" }),
    ]);
  }
}
type Tx = { brand: string; name: string; sub: string; amount: string; verified?: boolean; green?: boolean; color?: string; initial?: string };
// front (k=0) = top of the pile; cards pop UPWARD one by one, building the stack up
const stack: Tx[] = [
  { brand: "bluebottle", name: "Blue Bottle", sub: "Coffee", amount: "$7.00", verified: true },
  { brand: "mcdonalds", name: "McDonald's", sub: "Lunch", amount: "$12.48" },
  { brand: "person", name: "Mihir", sub: "pickle ball", amount: "+$25.00", verified: true, green: true, color: "#3AA0FF", initial: "M" },
  { brand: "chase", name: "Chase Checking", sub: "Transfer to bank", amount: "$4,000.00" },
  { brand: "starbucks", name: "Starbucks", sub: "Coffee", amount: "$6.85" },
  { brand: "person", name: "alex", sub: "dinner", amount: "$120.00", verified: true, color: "#7C5CFF", initial: "A" },
];
const N2 = stack.length;
// a 3-card window: each card pops UP into the top (newest, prominent), then the older
// cards slide down a slot and the one leaving the bottom fades out — only 3 visible.
const SLOTS = [
  { y: 250, s: 1.0, o: 1.0 },    // 0 top    (newest — prominent, pops in here)
  { y: 322, s: 0.95, o: 0.7 },   // 1 middle
  { y: 392, s: 0.9, o: 0.42 },   // 2 bottom (oldest — about to leave)
];
const ENTER_Y = 290, I2 = 0.62;  // enters just below the top slot and pops UP into it
function txCard(k: number, t: Tx): NodeIR {
  const L = -ROW_W / 2 + 26;
  return group({ id: `c2-card${k}`, x: CX, y: ENTER_Y, scale: 0.7, opacity: 0 }, [
    rect({ id: `c2-bg${k}`, x: 0, y: 0, anchor: "center", width: ROW_W, height: ROW_H, radius: 24, fill: "#15151A", stroke: "#2C2C32", strokeWidth: 2, ...glow("#000000AA", 26) }),
    brandIcon(`c2-ic${k}`, L + 27, 0, t.brand, t.color, t.initial),
    text({ id: `c2-nm${k}`, x: L + 70, y: -13, anchor: "center-left", content: t.name, fontFamily: "Inter", fontSize: 25, fontWeight: 700, fill: WHITE }),
    ...(t.verified ? [ellipse({ id: `c2-vb${k}`, x: L + 70 + t.name.length * 12.5 + 16, y: -13, width: 20, height: 20, anchor: "center", fill: BLUE })] : []),
    text({ id: `c2-sb${k}`, x: L + 70, y: 17, anchor: "center-left", content: t.sub, fontFamily: "Inter", fontSize: 20, fontWeight: 400, fill: GRAY }),
    text({ id: `c2-am${k}`, x: ROW_W / 2 - 28, y: 0, anchor: "center-right", content: t.amount, fontFamily: "Inter", fontSize: 25, fontWeight: 700, fill: t.green ? GREEN : WHITE }),
  ]);
}
// paint in entry order so newer cards (lower in the pile) sit on top of older ones
const c2cards = stack.map((t, k) => txCard(k, t));
// one card's lifecycle: pop UP into the top slot, slide down through the slots, fade out at the bottom
const c2cycle = (k: number): TimelineIR => seq(
  wait(k * I2),
  tween(`c2-card${k}`, { y: SLOTS[0]!.y, scale: SLOTS[0]!.s, opacity: SLOTS[0]!.o }, { duration: 0.45, ease: "springBouncy", label: k === 0 ? "c2-pop" : undefined }),
  wait(I2 - 0.45),
  tween(`c2-card${k}`, { y: SLOTS[1]!.y, scale: SLOTS[1]!.s, opacity: SLOTS[1]!.o }, { duration: 0.4, ease: "easeOutCubic" }),
  wait(I2 - 0.4),
  tween(`c2-card${k}`, { y: SLOTS[2]!.y, scale: SLOTS[2]!.s, opacity: SLOTS[2]!.o }, { duration: 0.4, ease: "easeOutCubic" }),
  wait(I2 - 0.4),
  tween(`c2-card${k}`, { y: SLOTS[2]!.y + 50, scale: 0.84, opacity: 0 }, { duration: 0.4, ease: "easeInQuad" }),
);
const c2head = headNode("c2-h0", 814, "Pay anyone, any way");
const c2sub0 = subNode("c2-s0", 866, "Pay your rent, send a wire, mail a check, or pay");
const c2sub1 = lockupX("c2-s1", "friends, all with", "Money.", { y: 906, fontSize: 27, fontWeight: 400, fill: GRAY });
const chapter2 = panel(2, [...c2cards, c2head, c2sub0, ...c2sub1.nodes]);

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER 3 — "Earn while you sleep" : balance card -> net-worth projection
// ═══════════════════════════════════════════════════════════════════════════
const B_W = 600, B_H = 340, B_CY = 318;
const c3balReel = moneyReel("c3bal", "28,869", "$", { cx: -B_W / 2 + 40, y: -B_H / 2 + 104, fontSize: 56, fontWeight: 800, fill: WHITE, dur: 1.8, align: "left" });
const c3card = group({ id: "c3-card", x: CX, y: B_CY, opacity: 0, scale: 0.92 }, [
  rect({ id: "c3-bg", x: 0, y: 0, anchor: "center", width: B_W, height: B_H, radius: 30, fill: CARD, stroke: CARDLINE, strokeWidth: 2, ...glow("#000000AA", 36) }),
  ellipse({ id: "c3-av", x: -B_W / 2 + 44, y: -B_H / 2 + 46, width: 38, height: 38, anchor: "center", fill: "#E6B98C" }),
  text({ id: "c3-acct", x: -B_W / 2 + 72, y: -B_H / 2 + 46, anchor: "center-left", content: "Account 1", fontFamily: "Inter", fontSize: 25, fontWeight: 700, fill: WHITE }),
  ...c3balReel.nodes,
  text({ id: "c3-cents", x: -B_W / 2 + 256, y: -B_H / 2 + 86, anchor: "center-left", content: "21", fontFamily: "Inter", fontSize: 24, fontWeight: 700, fill: WHITE, opacity: 0 }),
  text({ id: "c3-earn", x: -B_W / 2 + 40, y: -B_H / 2 + 150, anchor: "center-left", content: "Earned $12.56", fontFamily: "Inter", fontSize: 23, fontWeight: 700, fill: GREEN }),
]);
// ONE chart: drawn small & CONTAINED in the card (stage 1), then the SAME finished
// chart is scaled + panned (zoom-in, no redraw) into the full projection (stage 2)
const bigD = "M -380 250 C -240 232 -170 150 -60 130 C 60 108 110 10 200 -50 C 270 -96 330 -120 392 -132";
// the curve only — small & fully inside the card (stage 1), then it scales + pans so the
// FINAL rising part fills the frame (stage 2): a zoom INTO the end, not a uniform blow-up
const c3graph = group({ id: "c3-graph", x: CX, y: 372, scale: 0.42 }, [
  path({ id: "c3-curve", x: 0, y: 0, d: bigD, fill: "none", stroke: GREENL, strokeWidth: 5, progress: 0, ...glow(GREENL, 14) }),
]);
// endpoint mark + projection label — fixed where the curve's END lands after the zoom
const c3pulse = ellipse({ id: "c3-pulse", x: CX + 158, y: 256, width: 46, height: 46, anchor: "center", fill: "none", stroke: GREENG, strokeWidth: 3, opacity: 0 });
const c3dot = ellipse({ id: "c3-dot", x: CX + 158, y: 256, width: 24, height: 24, anchor: "center", fill: GREENG, opacity: 0, ...glow(GREENG, 22) });
const c3proj = [
  text({ id: "c3-pv", x: CX + 120, y: 322, anchor: "center", content: "$2.1MM", fontFamily: "Inter", fontSize: 48, fontWeight: 800, fill: WHITE, opacity: 0 }),
  text({ id: "c3-pl", x: CX + 120, y: 356, anchor: "center", content: "Net Worth at 65", fontFamily: "Inter", fontSize: 22, fontWeight: 400, fill: GRAY, opacity: 0 }),
];
const c3head = headNode("c3-h0", 814, "Earn while you sleep");
const c3subs = [subNode("c3-s0", 866, "Your cash earns industry-leading interest, with"), subNode("c3-s1", 906, "no minimum balance.")];
const chapter3 = panel(3, [c3card, c3graph, c3pulse, c3dot, ...c3proj, c3head, ...c3subs]);

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER 4 — "Secured with passkeys" : Face ID -> ring -> check
// ═══════════════════════════════════════════════════════════════════════════
const TILE_CY = 356, TS = 1.18;           // tile scale-up for glyph geometry
const c4tile = rect({ id: "c4-tile", x: CX, y: TILE_CY, anchor: "center", width: 312, height: 312, radius: 72, fill: "#08080A", stroke: "#16161A", strokeWidth: 2, shadowColor: "#1C4D33", shadowBlur: 34, opacity: 0, scale: 0.8 });
const g = (d: string, id: string) => path({ id, x: 0, y: 0, d, fill: "none", stroke: GREENG, strokeWidth: 9, ...glow(GREENG, 13) });
const c4face = group({ id: "c4-face", x: CX, y: TILE_CY, scale: TS, opacity: 0 }, [
  g("M -52 -26 L -52 -52 L -26 -52", "c4-tl"),
  g("M 26 -52 L 52 -52 L 52 -26", "c4-tr"),
  g("M -52 26 L -52 52 L -26 52", "c4-bl"),
  g("M 26 52 L 52 52 L 52 26", "c4-br"),
  line({ id: "c4-eye1", x1: -20, y1: -16, x2: -20, y2: 4, stroke: GREENG, strokeWidth: 9 }),
  line({ id: "c4-eye2", x1: 20, y1: -16, x2: 20, y2: 4, stroke: GREENG, strokeWidth: 9 }),
  g("M 0 -8 L 0 12 L 9 12", "c4-nose"),
  g("M -20 24 Q 0 38 20 24", "c4-smile"),
]);
const c4ring = ellipse({ id: "c4-ring", x: CX, y: TILE_CY, width: 150, height: 150, anchor: "center", fill: "none", stroke: GREENG, strokeWidth: 10, opacity: 0, scale: 0.6, ...glow(GREENG, 18) });
const c4check = path({ id: "c4-check", x: CX, y: TILE_CY, d: "M -36 5 L -9 34 L 43 -32", fill: "none", stroke: GREENG, strokeWidth: 12, progress: 0, ...glow(GREENG, 16) });
const c4burst = ellipse({ id: "c4-burst", x: CX, y: TILE_CY, width: 150, height: 150, anchor: "center", fill: "none", stroke: GREENG, strokeWidth: 6, opacity: 0, scale: 1, ...glow(GREENG, 20) });
const c4head = headNode("c4-h0", 814, "Secured with passkeys");
const c4subs = [subNode("c4-s0", 866, "Unlock using passkeys, a safer and"), subNode("c4-s1", 906, "faster alternative to passwords.")];
const chapter4 = panel(4, [c4tile, c4face, c4ring, c4check, c4burst, c4head, ...c4subs]);

// ═══════════════════════════════════════════════════════════════════════════
// CHAPTER 5 — "Access up to $10M of FDIC Insurance" : giant count-up
// ═══════════════════════════════════════════════════════════════════════════
const disclaimer = [
  "Deposits are held at Cross River Bank, Member FDIC, and at other FDIC-insured",
  "institutions. Certain conditions must be satisfied for pass-through deposit insurance",
  "coverage to apply. X Payments LLC is not an FDIC-insured bank. Deposit insurance",
  "only covers the failure of an insured bank.",
];
const c5reel = moneyReel("c5", "10,000,000", "$", { cx: CX, y: 352, fontSize: 112, fontWeight: 800, fill: WHITE, dur: 2.8, grow: true });
const c5num = group({ id: "c5-num", x: 0, y: 0, opacity: 0 }, c5reel.nodes);
const c5disc = disclaimer.map((s, i) =>
  text({ id: `c5-d${i}`, x: CX, y: 552 + i * 26, anchor: "center", content: s, fontFamily: "Inter", fontSize: 15, fontWeight: 400, fill: "#55555C", opacity: 0 }));
const c5heads = [headNode("c5-h0", 786, "Access up to $10M"), headNode("c5-h1", 844, "of FDIC Insurance")];
const c5sub0 = subNode("c5-s0", 902, "Your funds are automatically enrolled in the");
const c5sub1 = lockupX("c5-s1", "", "Cash Sweep Program.", { y: 938, fontSize: 27, fontWeight: 400, fill: GRAY });
const chapter5 = panel(5, [c5num, ...c5disc, ...c5heads, c5sub0, ...c5sub1.nodes]);

// ═══════════════════════════════════════════════════════════════════════════
export default scene({
  id: "xmoney-promo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { x: CX, y: CX, perspective: 1300 },
  nodes: [chapter0, chapter1, chapter2, chapter3, chapter4, chapter5],

  timeline: par(
    // ── camera carousel ──────────────────────────────────────────────────────
    seq(
      wait(D - SLIDE), cameraTo({ x: camX(1) }, { duration: SLIDE, ease: "easeInOutCubic", label: "pan1" }),
      wait(D - SLIDE), cameraTo({ x: camX(2) }, { duration: SLIDE, ease: "easeInOutCubic", label: "pan2" }),
      wait(D - SLIDE), cameraTo({ x: camX(3) }, { duration: SLIDE, ease: "easeInOutCubic", label: "pan3" }),
      wait(D - SLIDE), cameraTo({ x: camX(4) }, { duration: SLIDE, ease: "easeInOutCubic", label: "pan4" }),
      wait(D - SLIDE), cameraTo({ x: camX(5) }, { duration: SLIDE, ease: "easeInOutCubic", label: "pan5" }),
      wait(D, "end"),
    ),

    // ── chapter 0 : cards stagger in, balances roll (and keep ticking) ───────
    beat("scene0", { at: 0 }, [par(
      fadeIn(c0head.ids, "c0-head"),
      fadeIn(["c0-s0", "c0-s1"]),
      stagger(0.12,
        ...[0, 1, 2].map((i) => tween(`c0-card${i}`, { opacity: 1, y: c0cells[i]!.y }, { duration: 0.55, ease: "easeOutBack", label: i === 0 ? "c0-pop" : undefined })),
        tween("c0-add", { opacity: 1, y: c0cells[3]!.y }, { duration: 0.55, ease: "easeOutBack" })),
      // border traces draw around each panel's outline (staggered with the cards)
      seq(wait(0.18), stagger(0.12,
        ...[0, 1, 2, 3].map((i) => tween(`c0-bd${i}`, { progress: 1 }, { duration: 0.7, ease: "easeInOutQuad" })))),
      seq(wait(0.4), par(...c0reels.map((r) => r.anim()))),
    )]),

    // ── chapter 1 : edge-on reveal -> continuous turntable + light sweep ─────
    beat("scene1", { at: D }, [par(
      fadeIn(["c1-h0"], "c1-head"),
      fadeIn(["c1-s0", "c1-s1"]),
      tween("c1-card", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "c1-in" }),
      // a full 180° turn (oblique): front -> edge -> back
      tween("c1-card", { rotateY: 160 }, { duration: 3.4, ease: "linear" }),
      // swap faces at the edge-on crossover (rotateY ~ 90, card is a thin sliver -> hidden swap)
      seq(wait(2.02), par(
        tween("c1-front", { opacity: 0 }, { duration: 0.12 }),
        tween("c1-back", { opacity: 1 }, { duration: 0.12 }))),
      // specular highlight sweeps across the front as it turns
      seq(
        tween("c1-hl", { x: 300 }, { duration: 1.4, ease: "easeInOutQuad" }),
        tween("c1-hl", { x: -300 }, { duration: 1.2, ease: "easeInOutQuad" })),
    )]),

    // ── chapter 2 : a rolling 3-card window — pop in at bottom, rise, fade at top ──
    beat("scene2", { at: 2 * D }, [par(
      fadeIn(["c2-h0"], "c2-head"),
      fadeIn(["c2-s0", ...c2sub1.ids]),
      seq(wait(0.15), par(...Array.from({ length: N2 }, (_, k) => c2cycle(k)))),
    )]),

    // ── chapter 3 : balance rolls -> projection curve to glowing endpoint ────
    beat("scene3", { at: 3 * D }, [par(
      fadeIn(["c3-h0"], "c3-head"),
      fadeIn(["c3-s0", "c3-s1"]),
      seq(
        // stage 1 — card in, balance rolls, chart draws on (CONTAINED in the card)
        par(
          tween("c3-card", { opacity: 1, scale: 1 }, { duration: 0.45, ease: "easeOutCubic" }),
          seq(wait(0.25), par(
            c3balReel.anim("c3-roll"),
            tween("c3-cents", { opacity: 1 }, { duration: 0.35 }),
            tween("c3-curve", { progress: 1 }, { duration: 1.0, ease: "easeInOutCubic" }))),
        ),
        wait(0.15),
        // stage 2 — ZOOM INTO the END of the finished curve (push toward the endpoint); card fades
        par(
          tween("c3-card", { opacity: 0, scale: 1.5 }, { duration: 0.5, ease: "easeInQuad" }),
          tween("c3-graph", { x: CX - 624, y: 519, scale: 2.0 }, { duration: 1.15, ease: "easeInOutCubic", label: "c3-draw" }),
          seq(wait(0.8), par(
            tween("c3-dot", { opacity: 1 }, { duration: 0.3 }),
            tween("c3-pulse", { opacity: 0.7 }, { duration: 0.3 }),
            tween("c3-pv", { opacity: 1 }, { duration: 0.4 }),
            tween("c3-pl", { opacity: 1 }, { duration: 0.4 }))),
        ),
      ),
    )]),

    // ── chapter 4 : Face ID draws, morphs to a check ─────────────────────────
    beat("scene4", { at: 4 * D }, [par(
      fadeIn(["c4-h0"], "c4-head"),
      fadeIn(["c4-s0", "c4-s1"]),
      seq(
        par(
          tween("c4-tile", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutBack" }),
          seq(wait(0.15), tween("c4-face", { opacity: 1 }, { duration: 0.45, ease: "easeOutCubic" }))),
        wait(1.15),
        // face implodes to the centre while the ring sweeps in
        par(
          tween("c4-face", { opacity: 0, scale: TS * 0.45 }, { duration: 0.32, ease: "easeInBack" }),
          seq(wait(0.1), tween("c4-ring", { opacity: 1, scale: 1 }, { duration: 0.42, ease: "easeOutBack" }))),
        // check snaps in
        tween("c4-check", { progress: 1 }, { duration: 0.34, ease: "easeOutCubic", label: "c4-check" }),
        // success: burst ring + tile bounce + glow flash
        par(
          seq(tween("c4-burst", { opacity: 0.85, scale: 1.05 }, { duration: 0.06 }),
            tween("c4-burst", { opacity: 0, scale: 2.4 }, { duration: 0.55, ease: "easeOutCubic" })),
          seq(tween("c4-tile", { scale: 1.09 }, { duration: 0.12, ease: "easeOutQuad" }),
            tween("c4-tile", { scale: 1.0 }, { duration: 0.3, ease: "easeOutBack" })),
          seq(tween("c4-tile", { shadowBlur: 74, shadowColor: GREENG }, { duration: 0.15 }),
            tween("c4-tile", { shadowBlur: 34, shadowColor: "#1C4D33" }, { duration: 0.5 })),
        ),
      ),
    )]),

    // ── chapter 5 : giant count-up to $10M (lean on motion blur) ─────────────
    beat("scene5", { at: 5 * D }, [par(
      fadeIn(["c5-h0", "c5-h1"], "c5-head"),
      fadeIn(["c5-s0", ...c5sub1.ids]),
      seq(wait(0.2), par(
        tween("c5-num", { opacity: 1 }, { duration: 0.3 }),
        c5reel.anim("c5-roll"),
        stagger(0.05, ...c5disc.map((d) => tween(d.id, { opacity: 1 }, { duration: 0.5 }))))),
    )]),
  ),

  behaviors: [
    // chapter-1 metal card: gentle tumble on top of the 180° turn (keeps it oblique)
    oscillate("c1-card", "rotateX", { amplitude: 3, frequency: 0.16 }, { from: D + 0.3, until: 2 * D }),
    // chapter-3 endpoint: a pulsing ring
    oscillate("c3-pulse", "scale", { amplitude: 0.5, frequency: 1.2 }, { from: 3 * D + 2.3, until: 4 * D }),
    oscillate("c3-pulse", "opacity", { amplitude: 0.35, frequency: 1.2 }, { from: 3 * D + 2.3, until: 4 * D }),
  ],

  audio: {
    bgm: { synth: "pulse", gain: 0.11, fadeIn: 1.0, fadeOut: 1.8, duck: { depth: 0.35 } },
    cues: [
      { at: "c0-pop", sfx: "sparkle", gain: 0.35 },
      { at: "pan1", sfx: "swoosh", gain: 0.28 },
      { at: "c1-in", sfx: "scan", gain: 0.3 },
      { at: "pan2", sfx: "swoosh", gain: 0.28 },
      { at: "c2-pop", sfx: "select", gain: 0.3 },
      { at: "pan3", sfx: "swoosh", gain: 0.28 },
      { at: "c3-draw", sfx: "riser", gain: 0.26 },
      { at: "pan4", sfx: "swoosh", gain: 0.28 },
      { at: "c4-check", sfx: "success", gain: 0.4 },
      { at: "pan5", sfx: "swoosh", gain: 0.28 },
      { at: "c5-roll", sfx: "riser", gain: 0.3 },
    ],
  },
});
