// Apple-style "Liquid Glass" navigation over a REAL photo, using the engine's
// `backdrop` primitive: ONE frosted panel that GLIDES and RESIZES between nav items
// (Product → Resources → Company), sampling and blurring whatever is behind it LIVE
// every frame. Specular rim + top sheen + soft contact shadow. The tabs cross-fade as
// the panel travels. No pre-blurred asset — the glass is a real backdrop-filter.
//
// (Background is a photo, so this ships as mp4; the `backdrop` primitive itself also
// works live in `reframe player` over a shape/gradient background.)

import {
  scene, rect, image, path, text,
  seq, par, tween, wait,
  linearGradient,
  type NodeIR, type TimelineIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const TOP = 150;        // panel top edge
const NAVY = 96;        // nav row y
const RAD = 28;

// each nav item: where its dropdown sits + the tabs it reveals
const STOPS = {
  product:   { cx: 400, w: 384, h: 436, items: ["Overview", "Features", "Integrations", "Changelog", "Pricing"] },
  resources: { cx: 784, w: 372, h: 368, items: ["Documentation", "Guides", "Blog", "Support"] },
  company:   { cx: 1144, w: 332, h: 300, items: ["About", "Careers", "Contact"] },
};
type Key = keyof typeof STOPS;
const KEYS = Object.keys(STOPS) as Key[];
const LABEL: Record<Key, string> = { product: "Product", resources: "Resources", company: "Company" };

const caret = (k: Key, cx: number): NodeIR =>
  path({ id: `caret-${k}`, x: cx, y: NAVY + 2, d: "M-7 -4 L7 -4 L0 6 Z", fill: "#FFFFFF", opacity: 0.9 });

// the panel layers that morph together (glass body + sheen + rim)
const morphTo = (k: Key, duration: number, lbl: string): TimelineIR => {
  const s = STOPS[k];
  const e = { duration, ease: "easeInOutCubic" as const };
  return par(
    tween("g-glass", { x: s.cx, width: s.w, height: s.h }, { ...e, label: lbl }),
    tween("g-sheen", { x: s.cx, width: s.w - 10 }, { ...e, label: `${lbl}-sheen` }),
    tween("g-rim", { x: s.cx, width: s.w, height: s.h }, { ...e, label: `${lbl}-rim` }),
  );
};

const P = STOPS.product;

// tab-list nodes for a menu (left-aligned rows under the panel)
const tabs = (k: Key): NodeIR[] => {
  const s = STOPS[k];
  return s.items.map((label, i) =>
    text({ id: `menu-${k}-${i}`, x: s.cx - s.w / 2 + 36, y: TOP + 74 + i * 70, anchor: "center-left",
      content: label, fontFamily: "Inter", fontSize: 30, fontWeight: 500, fill: "#FFFFFF",
      shadowColor: "#05101C", shadowBlur: 12, shadowX: 0, shadowY: 1, opacity: 0 }));
};

export default scene({
  id: "liquid-glass-nav",
  size: { width: W, height: H },
  fps: 30,
  background: "#0B1622",
  nodes: [
    // ── the real page (photo) ──
    image({ id: "bg", src: "liquid-glass-nav/bg.jpg", x: 0, y: 0, width: W, height: H, fit: "cover" }),
    rect({ id: "scrim", x: 0, y: 0, width: W, height: 220, fill: linearGradient(["#03070E99", "#03070E00"], { angle: 90 }) }),

    // ── site nav row ──
    text({ id: "logo", x: 96, y: NAVY, anchor: "center-left", content: "✦ reframe", fontFamily: "Inter", fontSize: 30, fontWeight: 800, fill: "#FFFFFF", shadowColor: "#05101C", shadowBlur: 10, shadowX: 0, shadowY: 1 }),
    ...KEYS.map((k) =>
      text({ id: `nav-${k}`, x: STOPS[k].cx, y: NAVY, anchor: "center", content: LABEL[k], fontFamily: "Inter", fontSize: 30, fontWeight: 600, fill: "#FFFFFF", opacity: 0.6,
        shadowColor: "#05101C", shadowBlur: 10, shadowX: 0, shadowY: 1 })),
    caret("product", STOPS.product.cx + 86),
    caret("resources", STOPS.resources.cx + 100),
    caret("company", STOPS.company.cx + 86),
    rect({ id: "cta", x: 1824, y: NAVY, width: 168, height: 56, radius: 28, anchor: "center", fill: "#FFFFFF", opacity: 0.94 }),
    text({ id: "cta-t", x: 1824, y: NAVY, anchor: "center", content: "Get the app", fontFamily: "Inter", fontSize: 24, fontWeight: 700, fill: "#0B1622" }),

    // ── the liquid-glass panel: live backdrop blur of the page behind it ──
    rect({ id: "g-glass", x: P.cx, y: TOP, width: P.w, height: P.h, radius: RAD, anchor: "top-center", opacity: 0, scale: 0.96,
      backdrop: { blur: 22, saturate: 1.3 },
      fill: linearGradient(["#0A1726A6", "#0A172680"], { angle: 90 }),
      shadowColor: "#04101C", shadowBlur: 60, shadowX: 0, shadowY: 34 }),
    // top sheen (screen highlight along the upper edge)
    rect({ id: "g-sheen", x: P.cx, y: TOP, width: P.w - 10, height: 84, radius: RAD, anchor: "top-center", opacity: 0,
      fill: linearGradient(["#FFFFFF73", "#FFFFFF00"], { angle: 90 }), blend: "screen" }),
    // specular rim — bright top-left → faint → bright bottom-right edge light
    rect({ id: "g-rim", x: P.cx, y: TOP, width: P.w, height: P.h, radius: RAD, anchor: "top-center", opacity: 0,
      fill: "none", stroke: linearGradient(["#FFFFFFF2", "#FFFFFF26", "#FFFFFF80"], { angle: 125 }), strokeWidth: 2.4 }),

    // ── the tab lists (one per nav item, cross-faded) ──
    ...KEYS.flatMap(tabs),
  ],

  timeline: seq(
    wait(0.3),
    // open under Product
    par(
      tween("g-glass", { opacity: 1, scale: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "open" }),
      tween("g-sheen", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "open-sheen" }),
      tween("g-rim", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "open-rim" }),
      tween("nav-product", { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "open-nav" }),
      tween("caret-product", { rotation: 180 }, { duration: 0.5, ease: "easeOutCubic", label: "open-caret" }),
      seq(wait(0.3), par(...STOPS.product.items.map((_, i) =>
        tween(`menu-product-${i}`, { opacity: 1 }, { duration: 0.32, ease: "easeOutCubic", label: `ptab-${i}` })))),
    ),
    wait(1.4),
    par(morphTo("resources", 0.72, "to-resources"), selectTabs("product", "resources", 0.72)),
    wait(1.4),
    par(morphTo("company", 0.72, "to-company"), selectTabs("resources", "company", 0.72)),
    wait(1.4),
    par(morphTo("product", 0.72, "to-product"), selectTabs("company", "product", 0.72)),
    wait(1.0),
  ),
});

// cross-fade whole tab lists by fading each row (tabs are flat text nodes, not a group)
function selectTabs(from: Key, to: Key, duration: number): TimelineIR {
  const fromN = STOPS[from].items.length;
  const toN = STOPS[to].items.length;
  return par(
    ...Array.from({ length: fromN }, (_, i) =>
      tween(`menu-${from}-${i}`, { opacity: 0 }, { duration: duration * 0.35, ease: "easeInQuad", label: `${from}-${to}-o${i}` })),
    seq(wait(duration * 0.55), par(...Array.from({ length: toN }, (_, i) =>
      tween(`menu-${to}-${i}`, { opacity: 1 }, { duration: duration * 0.45, ease: "easeOutQuad", label: `${from}-${to}-i${i}` })))),
    tween(`nav-${from}`, { opacity: 0.55 }, { duration, ease: "easeInOutQuad", label: `${from}-${to}-navout` }),
    tween(`nav-${to}`, { opacity: 1 }, { duration, ease: "easeInOutQuad", label: `${from}-${to}-navin` }),
    tween(`caret-${from}`, { rotation: 0 }, { duration, ease: "easeInOutCubic", label: `${from}-${to}-cout` }),
    tween(`caret-${to}`, { rotation: 180 }, { duration, ease: "easeInOutCubic", label: `${from}-${to}-cin` }),
  );
}
