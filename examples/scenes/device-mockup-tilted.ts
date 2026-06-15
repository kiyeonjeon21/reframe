import { scene, group, rect, text, seq, par, beat, tween, wait, type NodeIR } from "@reframe/core";

// The device mockup, leaned into a 2.5D "tilt": the phone group carries
// skewX + a slight vertical squash (scaleY) — a fake-perspective hero angle
// within the affine model (no true 3D). The clipped screen and all its content
// inherit the parent matrix, so everything leans together. The lean settles on
// entry (skewX animates from a steeper angle to its resting tilt).

const BG = "#06070A";
const BODY = "#15161C";
const SCREEN = "#0E0F15";
const MUTED = "#7A8194";

const CARDS = [
  { id: "c1", title: "Morning run", sub: "5.2 km · 27 min", color: "#FF4D00" },
  { id: "c2", title: "Inbox", sub: "3 new messages", color: "#00C2A8" },
  { id: "c3", title: "Design sync", sub: "10:00 · Zoom", color: "#7C5CFF" },
  { id: "c4", title: "Groceries", sub: "7 items left", color: "#F59E0B" },
  { id: "c5", title: "Focus time", sub: "2h 15m today", color: "#3B82F6" },
  { id: "c6", title: "Podcast", sub: "42 min left", color: "#EC4899" },
  { id: "c7", title: "Weather", sub: "21° · clear", color: "#10B981" },
];

const cardNode = (c: (typeof CARDS)[number], y: number): NodeIR =>
  group({ id: c.id, x: 0, y }, [
    rect({ id: `${c.id}-bg`, x: 0, y: 0, anchor: "center", width: 300, height: 104, fill: "#171922", stroke: "#242837", strokeWidth: 1, radius: 18 }),
    rect({ id: `${c.id}-ic`, x: -118, y: 0, anchor: "center", width: 50, height: 50, fill: c.color, radius: 13 }),
    text({ id: `${c.id}-t`, x: -84, y: -10, content: c.title, fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: "#FFFFFF" }),
    text({ id: `${c.id}-s`, x: -84, y: 18, content: c.sub, fontFamily: "Inter", fontSize: 14, fill: MUTED }),
  ]);

export default scene({
  id: "device-mockup-tilted",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    // skewX leans the top to the left; scaleY squashes ~6% to fake a tilt-away
    group({ id: "phone", x: 960, y: 620, opacity: 0, skewX: -14, scaleY: 0.94 }, [
      rect({ id: "body", x: 0, y: 0, anchor: "center", width: 392, height: 812, fill: BODY, stroke: "#2A2D38", strokeWidth: 2, radius: 54 }),
      group({ id: "screen", x: 0, y: 0, clip: { kind: "rect", x: -176, y: -368, width: 352, height: 736, radius: 38 } }, [
        rect({ id: "screenbg", x: 0, y: 0, anchor: "center", width: 352, height: 736, fill: SCREEN }),
        group({ id: "feed", x: 0, y: 0 }, [
          text({ id: "hdr", x: -150, y: -330, content: "Today", fontFamily: "Inter", fontSize: 36, fontWeight: 800, fill: "#FFFFFF" }),
          ...CARDS.map((c, i) => cardNode(c, -250 + i * 120)),
        ]),
      ]),
      rect({ id: "notch", x: 0, y: -368, anchor: "center", width: 130, height: 32, fill: "#000000", radius: 16 }),
      rect({ id: "home", x: 0, y: 350, anchor: "center", width: 120, height: 5, fill: "#3A3D48", radius: 3 }),
    ]),
  ],
  timeline: seq(
    // rise in and let the lean settle from -14° to -8°
    beat("reveal", { nodes: ["phone"] }, [
      par(tween("phone", { opacity: 1, y: 540, skewX: -8 }, { duration: 0.9, ease: "easeOutExpo", label: "phone-in" })),
    ]),
    wait(0.5),
    beat("scroll", { nodes: ["feed"] }, [
      tween("feed", { y: -300 }, { duration: 2.4, ease: "easeInOutCubic", label: "scroll-down" }),
      wait(0.4),
      tween("feed", { y: 0 }, { duration: 1.1, ease: "easeInOutCubic", label: "scroll-back" }),
    ]),
  ),
});
