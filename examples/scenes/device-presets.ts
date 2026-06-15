import { scene, group, rect, text, seq, par, beat, tween, wait, devicePreset, deviceScreen, type NodeIR } from "@reframe/core";

// Three devices from devicePreset(), side by side, each with content clipped to
// its screen. devicePreset is a STATIC node generator — the motion (entrance +
// in-screen scroll) is plain tweens on the device group ids and the content
// handle the caller nests inside `content`.

const BG = "#06070A";
const MUTED = "#7A8194";

// --- phone: a scrollable feed (authored in the phone's screen-local coords) ---
const PS = deviceScreen("phone"); // { width: 352, height: 736 }
const FEED = [
  { t: "Morning run", s: "5.2 km · 27 min", c: "#FF4D00" },
  { t: "Inbox", s: "3 new messages", c: "#00C2A8" },
  { t: "Design sync", s: "10:00 · Zoom", c: "#7C5CFF" },
  { t: "Groceries", s: "7 items left", c: "#F59E0B" },
  { t: "Focus time", s: "2h 15m today", c: "#3B82F6" },
  { t: "Podcast", s: "42 min left", c: "#EC4899" },
  { t: "Weather", s: "21° · clear", c: "#10B981" },
];
const phoneFeed = (): NodeIR =>
  group({ id: "pf", x: 0, y: 0 }, [
    text({ id: "pf-hdr", x: -PS.width / 2 + 26, y: -PS.height / 2 + 38, content: "Today", fontFamily: "Inter", fontSize: 34, fontWeight: 800, fill: "#FFFFFF" }),
    ...FEED.map((c, i) =>
      group({ id: `pf-${i}`, x: 0, y: -PS.height / 2 + 110 + i * 116 }, [
        rect({ id: `pf-${i}-bg`, x: 0, y: 0, anchor: "center", width: 300, height: 100, fill: "#171922", stroke: "#242837", strokeWidth: 1, radius: 18 }),
        rect({ id: `pf-${i}-ic`, x: -116, y: 0, anchor: "center", width: 48, height: 48, fill: c.c, radius: 12 }),
        text({ id: `pf-${i}-t`, x: -82, y: -10, content: c.t, fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: "#FFFFFF" }),
        text({ id: `pf-${i}-s`, x: -82, y: 16, content: c.s, fontFamily: "Inter", fontSize: 14, fill: MUTED }),
      ]),
    ),
  ]);

// --- browser: a landing-hero (screen-local coords) ---
const browserContent = (): NodeIR[] => [
  text({ id: "wb-h", x: -440, y: -150, content: "Ship motion, not mockups", fontFamily: "Inter", fontSize: 52, fontWeight: 800, fill: "#FFFFFF" }),
  text({ id: "wb-s", x: -440, y: -90, content: "declare a scene · render a deterministic mp4", fontFamily: "Inter", fontSize: 22, fill: MUTED }),
  ...[0, 1, 2].map((i) =>
    group({ id: `wb-b${i}`, x: -320 + i * 320, y: 90 }, [
      rect({ id: `wb-b${i}-bg`, x: 0, y: 0, anchor: "center", width: 280, height: 160, fill: "#12141B", stroke: "#222633", strokeWidth: 1, radius: 16 }),
      rect({ id: `wb-b${i}-ic`, x: 0, y: -36, anchor: "center", width: 44, height: 44, fill: ["#FF4D00", "#00C2A8", "#7C5CFF"][i]!, radius: 12 }),
      text({ id: `wb-b${i}-t`, x: 0, y: 24, anchor: "center", content: ["declare", "edit", "render"][i]!, fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: "#FFFFFF" }),
    ]),
  ),
];

// --- laptop: a dashboard (screen-local coords) ---
const laptopContent = (): NodeIR[] => [
  rect({ id: "lp-side", x: -360, y: 0, anchor: "center", width: 120, height: 520, fill: "#12141B" }),
  text({ id: "lp-h", x: -270, y: -210, content: "Dashboard", fontFamily: "Inter", fontSize: 28, fontWeight: 800, fill: "#FFFFFF" }),
  ...[0, 1, 2, 3, 4].map((i) =>
    rect({ id: `lp-bar${i}`, x: -240 + i * 110, y: 100, anchor: "bottom-center", width: 70, height: 60 + i * 48, fill: ["#FF4D00", "#00C2A8", "#7C5CFF", "#F59E0B", "#3B82F6"][i]!, radius: 8 }),
  ),
];

export default scene({
  id: "device-presets",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    devicePreset("phone", { id: "phone", x: 360, y: 600, scale: 0.86, opacity: 0, content: [phoneFeed()] }),
    devicePreset("browser", { id: "web", x: 1130, y: 380, scale: 0.74, opacity: 0, url: "reframe.video/docs", content: browserContent() }),
    devicePreset("laptop", { id: "laptop", x: 1300, y: 800, scale: 0.62, opacity: 0, content: laptopContent() }),
  ],
  timeline: seq(
    // entrance: stagger the three devices rising in
    beat("enter", { nodes: ["phone", "web", "laptop"] }, [
      par(
        tween("phone", { opacity: 1, y: 560 }, { duration: 0.8, ease: "easeOutExpo", label: "phone-in" }),
        seq(wait(0.12), tween("web", { opacity: 1, y: 360 }, { duration: 0.8, ease: "easeOutExpo", label: "web-in" })),
        seq(wait(0.24), tween("laptop", { opacity: 1, y: 780 }, { duration: 0.8, ease: "easeOutExpo", label: "laptop-in" })),
      ),
    ]),
    wait(0.5),
    // scroll the feed INSIDE the phone's clipped screen — `pf` is the handle
    beat("scroll", { nodes: ["pf"] }, [
      tween("pf", { y: -300 }, { duration: 2.4, ease: "easeInOutCubic", label: "scroll-down" }),
      wait(0.4),
      tween("pf", { y: 0 }, { duration: 1.1, ease: "easeInOutCubic", label: "scroll-back" }),
    ]),
  ),
});
