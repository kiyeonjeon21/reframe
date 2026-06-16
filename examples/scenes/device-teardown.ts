import {
  scene, group, rect, text, ellipse, seq, par, beat, tween, wait,
  devicePreset, deviceScreen, deviceScreenCenter, deviceBounds,
  DEVICE_PRESET_NAMES, type NodeIR, type DevicePresetName, type TimelineIR,
} from "@reframe/core";

// A hero-focus carousel: one device at a time, large, exploded into three
// layers — chassis (tilts back), screen glass (ejects down), and content
// (floats forward). Each device crossfades to the next, cycling all ten. The
// content rides as a free plane over the glass (sized to fit), so the layers
// truly separate; the clipped-slot idiom lives in device-presets.ts.

const BG = "#070809";
const FG = "#FFFFFF";
const MUTED = "#7C8496";
const SUB = ["#FF4D00", "#00C2A8", "#7C5CFF", "#F59E0B", "#3B82F6", "#EC4899", "#10B981"];

const ri = (id: string, x: number, y: number, w: number, h: number, fill: string, radius = 0, opacity?: number): NodeIR =>
  rect({ id, x, y, anchor: "center", width: w, height: h, fill, radius, ...(opacity !== undefined ? { opacity } : {}) });
const tx = (id: string, x: number, y: number, content: string, size: number, weight: number, fill: string, anchor: "center" | "center-left" = "center-left"): NodeIR =>
  text({ id, x, y, anchor, content, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });

const CARD = "#161922";
const CARD2 = "#1E222D";

// A distinctive UI per device, authored in that device's screen-LOCAL centre
// coords (origin 0,0 = screen centre) so it overlays the glass exactly.
function heroContent(name: DevicePresetName, accent: string): NodeIR[] {
  const u = `${name}-ui`;
  const { width: w, height: h } = deviceScreen(name);
  switch (name) {
    case "phone": // a music player
      return [
        tx(`${u}-time`, -w / 2 + 26, -h / 2 + 34, "9:41", 20, 700, FG),
        ri(`${u}-sig`, w / 2 - 40, -h / 2 + 32, 38, 10, MUTED, 5),
        ri(`${u}-art`, 0, -h * 0.14, w * 0.66, w * 0.66, accent, 28),
        tx(`${u}-song`, 0, h * 0.16, "Midnight Drive", 26, 800, FG, "center"),
        tx(`${u}-artist`, 0, h * 0.21, "The Echoes", 16, 400, MUTED, "center"),
        ri(`${u}-track`, 0, h * 0.29, w * 0.72, 5, "#2A2D38", 3),
        ri(`${u}-fill`, -w * 0.13, h * 0.29, w * 0.46, 5, accent, 3),
        ri(`${u}-prev`, -w * 0.22, h * 0.4, 30, 30, FG, 6),
        ellipse({ id: `${u}-play`, x: 0, y: h * 0.4, anchor: "center", width: 64, height: 64, fill: accent }),
        ri(`${u}-next`, w * 0.22, h * 0.4, 30, 30, FG, 6),
      ];
    case "tablet": { // a home screen of app icons
      const icons: NodeIR[] = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++)
          icons.push(ri(`${u}-app-${r}-${c}`, -w * 0.28 + c * w * 0.28, -h * 0.22 + r * h * 0.135, w * 0.17, w * 0.17, SUB[(r * 3 + c) % SUB.length]!, 20));
      return [
        tx(`${u}-hdr`, -w / 2 + 34, -h / 2 + 46, "Tuesday", 30, 800, FG),
        tx(`${u}-sub`, -w / 2 + 34, -h / 2 + 80, "June 16", 20, 400, MUTED),
        ...icons,
        ri(`${u}-dock`, 0, h * 0.42, w * 0.86, h * 0.1, CARD, 28),
        ...[0, 1, 2, 3].map((i) => ri(`${u}-dk${i}`, -w * 0.3 + i * w * 0.2, h * 0.42, w * 0.12, w * 0.12, SUB[(i + 2) % SUB.length]!, 14)),
      ];
    }
    case "laptop": { // a code editor
      const lines = [
        [["const ", "#7C5CFF"], ["scene", "#22D3EE"], [" = ", MUTED], ["reframe", "#FF4D00"]],
        [["  .nodes([", MUTED]],
        [["    rect", "#22D3EE"], ["({ id: ", MUTED], ["\"hero\"", "#10B981"], [" })", MUTED]],
        [["    text", "#22D3EE"], ["({ id: ", MUTED], ["\"title\"", "#10B981"], [" })", MUTED]],
        [["  ])", MUTED]],
        [["  .timeline", "#22D3EE"], ["(beat(", MUTED], ["\"in\"", "#10B981"], ["))", MUTED]],
      ];
      const code: NodeIR[] = [];
      lines.forEach((segs, r) => {
        let x = -w / 2 + 72;
        code.push(tx(`${u}-ln${r}`, -w / 2 + 30, -h / 2 + 92 + r * 46, String(r + 1), 16, 400, "#3A3D48"));
        segs.forEach(([s, col], c) => {
          code.push(tx(`${u}-c${r}-${c}`, x, -h / 2 + 92 + r * 46, s as string, 19, 600, col as string));
          x += (s as string).length * 11;
        });
      });
      return [
        ri(`${u}-tabbar`, 0, -h / 2 + 22, w, 44, CARD, 0),
        ri(`${u}-tab`, -w / 2 + 110, -h / 2 + 22, 180, 30, accent, 8),
        tx(`${u}-tabname`, -w / 2 + 44, -h / 2 + 22, "scene.ts", 16, 600, FG),
        ...code,
      ];
    }
    case "browser": { // a landing page
      return [
        tx(`${u}-logo`, -w / 2 + 40, -h / 2 + 44, "reframe", 24, 800, FG),
        ...[0, 1, 2].map((i) => tx(`${u}-nav${i}`, w / 2 - 280 + i * 90, -h / 2 + 44, ["Docs", "Pricing", "Blog"][i]!, 16, 600, MUTED)),
        tx(`${u}-h1`, -w / 2 + 40, -h * 0.12, "Ship motion,", 50, 800, FG),
        tx(`${u}-h2`, -w / 2 + 40, -h * 0.04, "not mockups.", 50, 800, accent),
        tx(`${u}-p`, -w / 2 + 40, h * 0.06, "Declare a scene. Render a deterministic mp4.", 20, 400, MUTED),
        ri(`${u}-cta`, -w / 2 + 130, h * 0.18, 200, 52, accent, 12),
        tx(`${u}-ctat`, -w / 2 + 130, h * 0.18, "Get started", 19, 700, "#07140F", "center"),
        ...[0, 1, 2].map((i) => ri(`${u}-card${i}`, w / 4 - 20, -h * 0.16 + i * h * 0.18, w * 0.36, h * 0.14, CARD, 14)),
      ];
    }
    case "watch": // activity ring + time
      return [
        ellipse({ id: `${u}-ringo`, x: 0, y: -h * 0.06, anchor: "center", width: 116, height: 116, fill: accent }),
        ellipse({ id: `${u}-ringi`, x: 0, y: -h * 0.06, anchor: "center", width: 86, height: 86, fill: "#0E0F15" }),
        tx(`${u}-bpm`, 0, -h * 0.06, "142", 30, 800, FG, "center"),
        tx(`${u}-unit`, 0, -h * 0.06 + 26, "BPM", 13, 600, MUTED, "center"),
        ri(`${u}-chip1`, -w * 0.22, h * 0.32, w * 0.32, 34, CARD, 10),
        ri(`${u}-chip2`, w * 0.22, h * 0.32, w * 0.32, 34, CARD, 10),
      ];
    case "monitor": { // an analytics dashboard
      const bars = [0, 1, 2, 3, 4, 5].map((i) =>
        ri(`${u}-bar${i}`, -w * 0.16 + i * w * 0.1, h * 0.32 - (40 + i * 22) / 2 + 10, w * 0.06, 40 + i * 22, SUB[i % SUB.length]!, 6),
      );
      return [
        ri(`${u}-side`, -w / 2 + w * 0.07, 0, w * 0.14, h, CARD, 0),
        ...[0, 1, 2, 3].map((i) => ri(`${u}-nav${i}`, -w / 2 + w * 0.07, -h * 0.32 + i * 52, w * 0.08, 12, i === 0 ? accent : "#2A2D38", 6)),
        tx(`${u}-hdr`, -w * 0.34, -h / 2 + 56, "Analytics", 30, 800, FG),
        ...[0, 1, 2].map((i) =>
          group({ id: `${u}-kpi${i}`, x: -w * 0.26 + i * w * 0.26, y: -h * 0.1 }, [
            ri(`${u}-kpi${i}-bg`, 0, 0, w * 0.22, h * 0.2, CARD, 14),
            tx(`${u}-kpi${i}-n`, -w * 0.08, -10, ["12.4k", "98%", "3.2s"][i]!, 30, 800, FG),
            tx(`${u}-kpi${i}-l`, -w * 0.08, 22, ["renders", "uptime", "p95"][i]!, 15, 400, MUTED),
          ]),
        ),
        ri(`${u}-chart`, w * 0.04, h * 0.28, w * 0.5, h * 0.34, CARD, 14),
        ...bars,
      ];
    }
    case "tv": { // a streaming home
      return [
        tx(`${u}-logo`, -w / 2 + 48, -h / 2 + 50, "STREAM", 26, 800, accent),
        ...[0, 1, 2].map((i) => tx(`${u}-nav${i}`, -w / 2 + 220 + i * 130, -h / 2 + 50, ["Home", "Series", "Films"][i]!, 18, 600, i === 0 ? FG : MUTED)),
        ri(`${u}-hero`, -w * 0.18, -h * 0.06, w * 0.6, h * 0.46, CARD2, 18),
        tx(`${u}-feat`, -w * 0.4, -h * 0.16, "Featured", 16, 700, accent),
        tx(`${u}-title`, -w * 0.4, -h * 0.06, "The Long Render", 38, 800, FG),
        ri(`${u}-play`, -w * 0.34, h * 0.08, 150, 48, FG, 10),
        tx(`${u}-playt`, -w * 0.34, h * 0.08, "▶  Play", 18, 700, "#0E0F15", "center"),
        ...[0, 1, 2, 3].map((i) => ri(`${u}-tile${i}`, w * 0.12 + (i % 2) * w * 0.2, -h * 0.12 + Math.floor(i / 2) * h * 0.26, w * 0.17, h * 0.22, SUB[i % SUB.length]!, 12)),
      ];
    }
    case "foldable": { // dual-pane: list on the left of the crease, detail on the right
      const list = [0, 1, 2].map((i) =>
        group({ id: `${u}-msg${i}`, x: -w * 0.26, y: -h * 0.22 + i * h * 0.2 }, [
          ellipse({ id: `${u}-av${i}`, x: -w * 0.13, y: 0, anchor: "center", width: 44, height: 44, fill: SUB[i % SUB.length]! }),
          ri(`${u}-l1-${i}`, w * 0.0, -10, w * 0.2, 12, "#2A2D38", 6),
          ri(`${u}-l2-${i}`, w * 0.0 - w * 0.03, 12, w * 0.14, 10, CARD, 5),
        ]),
      );
      return [
        tx(`${u}-lhdr`, -w / 2 + 36, -h / 2 + 44, "Inbox", 22, 800, FG),
        ...list,
        tx(`${u}-rhdr`, w * 0.06, -h / 2 + 44, "Thread", 22, 800, FG),
        ri(`${u}-rimg`, w * 0.26, -h * 0.12, w * 0.36, h * 0.26, accent, 14),
        ...[0, 1, 2].map((i) => ri(`${u}-rl${i}`, w * 0.26, h * 0.14 + i * 28, w * 0.36 - i * 20, 11, CARD, 5)),
      ];
    }
    case "terminal": { // a shell session
      const rows: [string, string][] = [
        ["❯ ", accent], ["pnpm reframe render scene.ts", FG],
        ["", FG], ["  bundling scene…", MUTED],
        ["  ✓ 163 frames @ 30fps", "#10B981"], ["  ✓ out/scene.mp4", "#10B981"],
        ["❯ ", accent], ["_", FG],
      ];
      const lines: NodeIR[] = [];
      for (let i = 0; i < rows.length; i += 2) {
        const y = -h / 2 + 56 + (i / 2) * 56;
        lines.push(tx(`${u}-p${i}`, -w / 2 + 36, y, rows[i]![0], 22, 700, rows[i]![1]));
        lines.push(tx(`${u}-t${i}`, -w / 2 + 36 + rows[i]![0].length * 15, y, rows[i + 1]![0], 22, 500, rows[i + 1]![1]));
      }
      return lines;
    }
    case "car": { // a navigation + media split
      return [
        ri(`${u}-map`, -w * 0.22, 0, w * 0.54, h * 0.92, "#0C1118", 16),
        ri(`${u}-road1`, -w * 0.22, -h * 0.1, w * 0.5, 8, "#222A36", 4),
        ri(`${u}-road2`, -w * 0.28, h * 0.12, 8, h * 0.6, "#222A36", 4),
        ri(`${u}-route`, -w * 0.18, h * 0.02, w * 0.34, 10, accent, 5),
        ellipse({ id: `${u}-pin`, x: -w * 0.02, y: -h * 0.06, anchor: "center", width: 26, height: 26, fill: accent }),
        tx(`${u}-eta`, -w * 0.44, -h * 0.36, "8 min", 28, 800, FG),
        tx(`${u}-dist`, -w * 0.44, -h * 0.36 + 30, "3.2 km", 16, 400, MUTED),
        ri(`${u}-media`, w * 0.3, -h * 0.18, w * 0.34, h * 0.3, CARD, 16),
        ri(`${u}-album`, w * 0.21, -h * 0.18, 64, 64, SUB[2]!, 10),
        tx(`${u}-track`, w * 0.27, -h * 0.21, "Radio 1", 18, 700, FG),
        tx(`${u}-band`, w * 0.27, -h * 0.14, "98.5 FM", 14, 400, MUTED),
        ri(`${u}-climate`, w * 0.3, h * 0.22, w * 0.34, h * 0.16, CARD, 16),
        tx(`${u}-temp`, w * 0.3, h * 0.22, "21°", 30, 800, FG, "center"),
      ];
    }
  }
}

const TAGLINE: Record<DevicePresetName, string> = {
  phone: "Now Playing", tablet: "Home screen", laptop: "Code editor", browser: "Landing page", watch: "Activity",
  monitor: "Dashboard", tv: "Streaming", foldable: "Dual pane", terminal: "Shell session", car: "Navigation",
};

const STAGE_X = 960;
const STAGE_Y = 512;
const heroScale = (name: DevicePresetName) => {
  const b = deviceBounds(name);
  return Math.max(0.4, Math.min(1.25, Math.min(980 / b.width, 612 / b.height)));
};

// Each hero lives in its own centred stage group (faded out until its turn). An
// inner `${name}-x` group carries the shared 2.5D skew so the chassis and the
// content tilt as parallel planes; within it, the layers offset along a common
// diagonal so they fan apart instead of crossing.
const stages: NodeIR[] = DEVICE_PRESET_NAMES.flatMap((name, i) => {
  const scale = heroScale(name);
  const accent = SUB[i % SUB.length]!;
  const sc = deviceScreenCenter(name);
  return [
    group({ id: `stage-${name}`, x: STAGE_X, y: STAGE_Y + 40, opacity: 0 }, [
      group({ id: `${name}-x`, x: 0, y: 0 }, [
        devicePreset(name, { id: name, x: 0, y: 0, scale, content: [], screen: "#13161D" }),
        group({ id: `${name}-ui`, x: sc.x * scale, y: sc.y * scale, scale }, heroContent(name, accent)),
      ]),
      tx(`${name}-cap`, 0, 392, name, 30, 800, FG, "center"),
      tx(`${name}-tag`, 0, 430, TAGLINE[name], 18, 400, MUTED, "center"),
    ]),
  ];
});

// One hero's beat: fade in, explode three layers, settle, fade out.
function heroBeat(name: DevicePresetName): TimelineIR {
  const scale = heroScale(name);
  const sc = deviceScreenCenter(name);
  const uiX = sc.x * scale;
  const uiY = sc.y * scale;
  return beat(name, { nodes: [name, `${name}-ui`] }, [
    seq(
      tween(`stage-${name}`, { opacity: 1, y: STAGE_Y }, { duration: 0.55, ease: "easeOutCubic", label: `${name}-in` }),
      wait(0.2),
      par(
        tween(`${name}-x`, { skewX: -12, skewY: 6 }, { duration: 0.7, ease: "easeOutCubic", label: `${name}-tilt` }),
        tween(name, { x: -26, y: -14, opacity: 0.58 }, { duration: 0.7, ease: "easeOutCubic", label: `${name}-back` }),
        tween(`${name}-screen`, { x: sc.x + 64, y: sc.y + 72 }, { duration: 0.7, ease: "easeOutCubic", label: `${name}-eject` }),
        tween(`${name}-ui`, { x: uiX + 116, y: uiY + 92, scale: scale * 1.1 }, { duration: 0.7, ease: "easeOutCubic", label: `${name}-float` }),
      ),
      wait(0.7),
      par(
        tween(`${name}-x`, { skewX: 0, skewY: 0 }, { duration: 0.45, ease: "easeInOutCubic", label: `${name}-untilt` }),
        tween(name, { x: 0, y: 0, opacity: 1 }, { duration: 0.45, ease: "easeInOutCubic", label: `${name}-fwd` }),
        tween(`${name}-screen`, { x: sc.x, y: sc.y }, { duration: 0.45, ease: "easeInOutCubic", label: `${name}-seat` }),
        tween(`${name}-ui`, { x: uiX, y: uiY, scale }, { duration: 0.45, ease: "easeInOutCubic", label: `${name}-sink` }),
      ),
      tween(`stage-${name}`, { opacity: 0, y: STAGE_Y - 24 }, { duration: 0.5, ease: "easeInCubic", label: `${name}-out` }),
    ),
  ]);
}

const DWELL = 2.7; // each hero overlaps the previous one's exit by ~0.35s

export default scene({
  id: "device-teardown",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: BG,
  nodes: [
    tx("title", 96, 70, "ten device presets, exploded", 40, 800, FG),
    tx("subtitle", 96, 110, "one devicePreset() call each · chassis + screen + content, pulled apart", 20, 400, MUTED),
    ...stages,
  ],
  timeline: par(
    ...DEVICE_PRESET_NAMES.map((name, i) => seq(wait(i * DWELL), heroBeat(name))),
  ),
});
