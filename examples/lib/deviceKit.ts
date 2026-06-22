// Shared device-hero kit: the per-device sample UI (heroContent), the signature
// motion (signature), and a `deviceHero` builder that assembles a device's
// `${name}-x` group (chassis + content plane). Used by both the full carousel
// (device-teardown.ts) and the X promo cut (x-demo.ts) so the look stays in one
// place. The frames come from devicePreset(); the choreography is plain tweens /
// motionPath / draw-on against the stable content ids.

import {
  group, rect, text, ellipse, path, seq, par, tween, wait, motionPath,
  devicePreset, deviceScreen, deviceScreenCenter, deviceBounds, brand,
  type NodeIR, type DevicePresetName, type TimelineIR, type GroupProps,
} from "@reframe/core";

// Sourced from the house brand (DESIGN.md tokens) so device scenes stay on-brand.
export const BG = brand.color.bg;
export const FG = brand.color.fg;
export const MUTED = brand.color.muted;
export const SUB = [brand.color.accent, brand.color.accent2, brand.color.dataViz[1]!, "#F59E0B", "#3B82F6", "#EC4899", "#10B981"];
export const CARD = brand.color.surface;
export const CARD2 = brand.color.surface2;

type Extra = Partial<GroupProps> & Record<string, unknown>;
export const ri = (id: string, x: number, y: number, w: number, h: number, fill: string, radius = 0, extra: Extra = {}): NodeIR =>
  rect({ id, x, y, anchor: "center", width: w, height: h, fill, radius, ...extra });
export const tx = (id: string, x: number, y: number, content: string, size: number, weight: number, fill: string, anchor: "center" | "center-left" = "center-left"): NodeIR =>
  text({ id, x, y, anchor, content, fontFamily: "Inter", fontSize: size, fontWeight: weight, fill });
export const slot = (id: string, x: number, y: number, children: NodeIR[], opacity = 0): NodeIR =>
  group({ id, x, y, opacity }, children);

export const TAGLINE: Record<DevicePresetName, string> = {
  phone: "Now Playing", tablet: "Home screen", laptop: "Code editor", browser: "Landing page", watch: "Activity",
  monitor: "Dashboard", tv: "Streaming", foldable: "Dual pane", terminal: "Shell session", car: "Navigation",
};
export const XINIT: Partial<Record<DevicePresetName, Partial<GroupProps>>> = {
  phone: { scaleX: 0 }, watch: { scale: 0.86 }, foldable: { scaleX: 0.32 },
};
export const heroScale = (name: DevicePresetName): number => {
  const b = deviceBounds(name);
  return Math.max(0.4, Math.min(1.25, Math.min(980 / b.width, 612 / b.height)));
};

// ── content: authored with START states for whatever its signature animates ──
export function heroContent(name: DevicePresetName, accent: string): NodeIR[] {
  const u = `${name}-ui`;
  const { width: w, height: h } = deviceScreen(name);
  switch (name) {
    case "phone": {
      const fillX = -w * 0.36;
      return [
        tx(`${u}-time`, -w / 2 + 26, -h / 2 + 34, "9:41", 20, 700, FG),
        ri(`${u}-sig`, w / 2 - 40, -h / 2 + 32, 38, 10, MUTED, 5),
        ri(`${u}-art`, 0, -h * 0.14, w * 0.66, w * 0.66, accent, 28),
        tx(`${u}-song`, 0, h * 0.16, "Midnight Drive", 26, 800, FG, "center"),
        tx(`${u}-artist`, 0, h * 0.21, "The Echoes", 16, 400, MUTED, "center"),
        ri(`${u}-track`, 0, h * 0.29, w * 0.72, 5, "#2A2D38", 3),
        ri(`${u}-fill`, fillX, h * 0.29, 0, 5, accent, 3, { anchor: "center-left" }),
        ri(`${u}-prev`, -w * 0.22, h * 0.4, 30, 30, FG, 6),
        ellipse({ id: `${u}-play`, x: 0, y: h * 0.4, anchor: "center", width: 64, height: 64, fill: accent }),
        ri(`${u}-next`, w * 0.22, h * 0.4, 30, 30, FG, 6),
      ];
    }
    case "tablet": {
      const icons: NodeIR[] = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++)
          icons.push(ri(`${u}-app-${r}-${c}`, -w * 0.28 + c * w * 0.28, -h * 0.22 + r * h * 0.135, w * 0.17, w * 0.17, SUB[(r * 3 + c) % SUB.length]!, 20, { scale: 0 }));
      return [
        slot(`${u}-head`, 0, -16, [
          tx(`${u}-hdr`, -w / 2 + 34, -h / 2 + 46, "Tuesday", 30, 800, FG),
          tx(`${u}-sub`, -w / 2 + 34, -h / 2 + 80, "June 16", 20, 400, MUTED),
        ]),
        ...icons,
        ri(`${u}-dock`, 0, h * 0.42, w * 0.86, h * 0.1, CARD, 28),
        ...[0, 1, 2, 3].map((i) => ri(`${u}-dk${i}`, -w * 0.3 + i * w * 0.2, h * 0.42, w * 0.12, w * 0.12, SUB[(i + 2) % SUB.length]!, 14, { scale: 0 })),
      ];
    }
    case "laptop": {
      const lines = [
        [["const ", "#7C5CFF"], ["scene", "#22D3EE"], [" = ", MUTED], ["reframe", "#FF4D00"]],
        [["  .nodes([", MUTED]],
        [["    rect", "#22D3EE"], ["({ id: ", MUTED], ["\"hero\"", "#10B981"], [" })", MUTED]],
        [["    text", "#22D3EE"], ["({ id: ", MUTED], ["\"title\"", "#10B981"], [" })", MUTED]],
        [["  ])", MUTED]],
        [["  .timeline", "#22D3EE"], ["(beat(", MUTED], ["\"in\"", "#10B981"], ["))", MUTED]],
      ];
      const lineSlots = lines.map((segs, r) => {
        const y = -h / 2 + 92 + r * 46;
        const kids: NodeIR[] = [tx(`${u}-ln${r}`, -w / 2 + 30, y, String(r + 1), 16, 400, "#3A3D48")];
        let x = -w / 2 + 72;
        segs.forEach(([s, col], c) => {
          kids.push(tx(`${u}-c${r}-${c}`, x, y, s as string, 19, 600, col as string));
          x += (s as string).length * 11;
        });
        return slot(`${u}-line${r}`, -50, 0, kids);
      });
      return [
        ri(`${u}-tabbar`, 0, -h / 2 + 22, w, 44, CARD, 0),
        ri(`${u}-tab`, -w / 2 + 110, -h / 2 + 22, 180, 30, accent, 8),
        tx(`${u}-tabname`, -w / 2 + 44, -h / 2 + 22, "scene.ts", 16, 600, FG),
        ...lineSlots,
      ];
    }
    case "browser": {
      return [
        slot(`${u}-top`, 0, -24, [
          tx(`${u}-logo`, -w / 2 + 40, -h / 2 + 44, "reframe", 24, 800, FG),
          ...[0, 1, 2].map((i) => tx(`${u}-nav${i}`, w / 2 - 280 + i * 90, -h / 2 + 44, ["Docs", "Pricing", "Blog"][i]!, 16, 600, MUTED)),
        ]),
        slot(`${u}-hero`, 0, 54, [
          tx(`${u}-h1`, -w / 2 + 40, -h * 0.12, "Ship motion,", 50, 800, FG),
          tx(`${u}-h2`, -w / 2 + 40, -h * 0.04, "not mockups.", 50, 800, accent),
          tx(`${u}-p`, -w / 2 + 40, h * 0.06, "Declare a scene. Render a deterministic mp4.", 20, 400, MUTED),
          ri(`${u}-cta`, -w / 2 + 130, h * 0.18, 200, 52, accent, 12),
          tx(`${u}-ctat`, -w / 2 + 130, h * 0.18, "Get started", 19, 700, "#07140F", "center"),
        ]),
        ...[0, 1, 2].map((i) => slot(`${u}-card${i}`, 90, 0, [ri(`${u}-cb${i}`, w / 4 - 20, -h * 0.16 + i * h * 0.18, w * 0.36, h * 0.14, CARD, 14)])),
      ];
    }
    case "watch": {
      const cy = -h * 0.05;
      const top = cy - 52;
      return [
        ellipse({ id: `${u}-disc`, x: 0, y: cy, anchor: "center", width: 120, height: 120, fill: CARD }),
        path({ id: `${u}-arc`, x: 0, y: 0, d: `M 0 ${top} A 52 52 0 1 1 -0.01 ${top}`, stroke: accent, strokeWidth: 13, progress: 0 }),
        tx(`${u}-bpm`, 0, cy - 4, "142", 30, 800, FG, "center"),
        tx(`${u}-unit`, 0, cy + 24, "BPM", 13, 600, MUTED, "center"),
        slot(`${u}-chips`, 0, 20, [
          ri(`${u}-chip1`, -w * 0.22, h * 0.32, w * 0.32, 34, CARD, 10),
          ri(`${u}-chip2`, w * 0.22, h * 0.32, w * 0.32, 34, CARD, 10),
        ]),
      ];
    }
    case "monitor": {
      const floor = h * 0.34;
      const bars = [0, 1, 2, 3, 4, 5].map((i) =>
        ri(`${u}-bar${i}`, -w * 0.16 + i * w * 0.1, floor, w * 0.06, 40 + i * 22, SUB[i % SUB.length]!, 6, { anchor: "bottom-center", scaleY: 0 }),
      );
      return [
        ri(`${u}-side`, -w / 2 + w * 0.07, 0, w * 0.14, h, CARD, 0),
        ...[0, 1, 2, 3].map((i) => ri(`${u}-nav${i}`, -w / 2 + w * 0.07, -h * 0.32 + i * 52, w * 0.08, 12, i === 0 ? accent : "#2A2D38", 6)),
        tx(`${u}-hdr`, -w * 0.34, -h / 2 + 56, "Analytics", 30, 800, FG),
        ...[0, 1, 2].map((i) =>
          slot(`${u}-kpi${i}`, 0, -18, [
            group({ id: `${u}-kpibox${i}`, x: -w * 0.26 + i * w * 0.26, y: -h * 0.1 }, [
              ri(`${u}-kpi${i}-bg`, 0, 0, w * 0.22, h * 0.2, CARD, 14),
              tx(`${u}-kpi${i}-n`, -w * 0.08, -10, ["12.4k", "98%", "3.2s"][i]!, 30, 800, FG),
              tx(`${u}-kpi${i}-l`, -w * 0.08, 22, ["renders", "uptime", "p95"][i]!, 15, 400, MUTED),
            ]),
          ]),
        ),
        ri(`${u}-chart`, w * 0.04, h * 0.28, w * 0.5, h * 0.34, CARD, 14),
        ...bars,
      ];
    }
    case "tv": {
      return [
        slot(`${u}-nav`, 0, -20, [
          tx(`${u}-logo`, -w / 2 + 48, -h / 2 + 50, "STREAM", 26, 800, accent),
          ...[0, 1, 2].map((i) => tx(`${u}-nv${i}`, -w / 2 + 220 + i * 130, -h / 2 + 50, ["Home", "Series", "Films"][i]!, 18, 600, i === 0 ? FG : MUTED)),
        ]),
        slot(`${u}-banner`, -70, 0, [
          ri(`${u}-hero`, -w * 0.24, -h * 0.02, w * 0.46, h * 0.5, CARD2, 18),
          tx(`${u}-feat`, -w * 0.43, -h * 0.13, "Featured", 16, 700, accent),
          tx(`${u}-title`, -w * 0.43, -h * 0.03, "The Long Render", 36, 800, FG),
          ri(`${u}-play`, -w * 0.37, h * 0.1, 150, 48, FG, 10),
          tx(`${u}-playt`, -w * 0.37, h * 0.1, "▶  Play", 18, 700, "#0E0F15", "center"),
        ]),
        ...[0, 1, 2, 3].map((i) => ri(`${u}-tile${i}`, w * 0.18 + (i % 2) * w * 0.2, -h * 0.14 + Math.floor(i / 2) * h * 0.26, w * 0.16, h * 0.22, SUB[i % SUB.length]!, 12, { scale: 0 })),
      ];
    }
    case "foldable": {
      const list = [0, 1, 2].map((i) =>
        group({ id: `${u}-msg${i}`, x: -w * 0.26, y: -h * 0.22 + i * h * 0.2 }, [
          ellipse({ id: `${u}-av${i}`, x: -w * 0.13, y: 0, anchor: "center", width: 44, height: 44, fill: SUB[i % SUB.length]! }),
          ri(`${u}-l1-${i}`, 0, -10, w * 0.2, 12, "#2A2D38", 6),
          ri(`${u}-l2-${i}`, -w * 0.03, 12, w * 0.14, 10, CARD, 5),
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
    case "terminal": {
      const rows: [string, string, string, string][] = [
        ["❯ ", accent, "pnpm reframe render scene.ts", FG],
        ["", FG, "  bundling scene…", MUTED],
        ["", FG, "  ✓ 163 frames @ 30fps", "#10B981"],
        ["❯ ", accent, "█", accent],
      ];
      return rows.map((rw, i) => {
        const y = -h / 2 + 56 + i * 56;
        return slot(`${u}-row${i}`, 0, 0, [
          tx(`${u}-p${i}`, -w / 2 + 36, y, rw[0], 22, 700, rw[1]),
          tx(`${u}-t${i}`, -w / 2 + 36 + rw[0].length * 15, y, rw[2], 22, 500, rw[3]),
        ]);
      });
    }
    case "car": {
      return [
        ri(`${u}-map`, -w * 0.22, 0, w * 0.54, h * 0.92, "#0C1118", 16),
        ri(`${u}-road1`, -w * 0.22, -h * 0.1, w * 0.5, 8, "#222A36", 4),
        ri(`${u}-road2`, -w * 0.28, h * 0.12, 8, h * 0.6, "#222A36", 4),
        path({ id: `${u}-route`, x: 0, y: 0, d: "M -300 100 L -220 20 L -120 44 L -40 -30 L 30 -74", stroke: accent, strokeWidth: 10, progress: 0 }),
        ellipse({ id: `${u}-pin`, x: -300, y: 100, anchor: "center", width: 26, height: 26, fill: accent }),
        slot(`${u}-eta`, -30, 0, [
          tx(`${u}-etan`, -w * 0.44, -h * 0.36, "8 min", 28, 800, FG),
          tx(`${u}-etad`, -w * 0.44, -h * 0.36 + 30, "3.2 km", 16, 400, MUTED),
        ]),
        slot(`${u}-mediaslot`, 40, 0, [
          ri(`${u}-media`, w * 0.3, -h * 0.18, w * 0.34, h * 0.3, CARD, 16),
          ri(`${u}-album`, w * 0.21, -h * 0.18, 64, 64, SUB[2]!, 10),
          tx(`${u}-track`, w * 0.27, -h * 0.21, "Radio 1", 18, 700, FG),
          tx(`${u}-band`, w * 0.27, -h * 0.14, "98.5 FM", 14, 400, MUTED),
          ri(`${u}-climate`, w * 0.3, h * 0.22, w * 0.34, h * 0.16, CARD, 16),
          tx(`${u}-temp`, w * 0.3, h * 0.22, "21°", 30, 800, FG, "center"),
        ]),
      ];
    }
  }
}

// ── each device's signature move ──
export function signature(name: DevicePresetName): TimelineIR {
  const u = `${name}-ui`;
  const { width: w } = deviceScreen(name);
  switch (name) {
    case "phone":
      return par(
        tween(`${name}-x`, { scaleX: 1 }, { duration: 0.6, ease: "easeOutBack", label: "flip" }),
        seq(wait(0.45), tween(`${u}-fill`, { width: w * 0.46 }, { duration: 0.7, ease: "easeOutCubic", label: "fill" })),
        seq(wait(0.55),
          tween(`${u}-art`, { scale: 1.07 }, { duration: 0.16, ease: "easeOutQuad" }),
          tween(`${u}-art`, { scale: 1 }, { duration: 0.22, ease: "easeInOutQuad" }),
          tween(`${u}-art`, { scale: 1.05 }, { duration: 0.16, ease: "easeOutQuad" }),
          tween(`${u}-art`, { scale: 1 }, { duration: 0.22, ease: "easeInOutQuad", label: "pulse" }),
        ),
      );
    case "tablet": {
      const grid = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) grid.push({ id: `${u}-app-${r}-${c}`, d: r + c });
      const dock = [0, 1, 2, 3].map((i) => ({ id: `${u}-dk${i}`, d: 5 + i }));
      return par(
        tween(`${u}-head`, { x: 0, y: 0, opacity: 1 }, { duration: 0.45, ease: "easeOutCubic", label: "head" }),
        ...[...grid, ...dock].map((g) => seq(wait(0.1 + g.d * 0.07), tween(g.id, { scale: 1 }, { duration: 0.42, ease: "easeOutBack" }))),
      );
    }
    case "laptop":
      return par(
        seq(wait(0.1), tween(`${name}-screen`, { opacity: 1 }, { duration: 0.3, ease: "easeOutQuad", label: "wake" })),
        ...[0, 1, 2, 3, 4, 5].map((r) => seq(wait(0.25 + r * 0.12), tween(`${u}-line${r}`, { x: 0, opacity: 1 }, { duration: 0.4, ease: "easeOutCubic" }))),
      );
    case "browser":
      return par(
        tween(`${u}-top`, { x: 0, y: 0, opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "top" }),
        seq(wait(0.12), tween(`${u}-hero`, { x: 0, y: 0, opacity: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "hero" })),
        ...[0, 1, 2].map((i) => seq(wait(0.3 + i * 0.12), tween(`${u}-card${i}`, { x: 0, y: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutBack" }))),
      );
    case "watch":
      return par(
        tween(`${name}-x`, { scale: 1 }, { duration: 0.5, ease: "easeOutBack", label: "raise" }),
        seq(wait(0.25), tween(`${u}-arc`, { progress: 1 }, { duration: 1.0, ease: "easeOutCubic", label: "ring" })),
        seq(wait(0.5), tween(`${u}-chips`, { x: 0, y: 0, opacity: 1 }, { duration: 0.45, ease: "easeOutCubic", label: "chips" })),
      );
    case "monitor":
      return par(
        tween(`${u}-hdr`, { opacity: 1 }, { duration: 0.3 }),
        ...[0, 1, 2].map((i) => seq(wait(0.1 + i * 0.1), tween(`${u}-kpi${i}`, { x: 0, y: 0, opacity: 1 }, { duration: 0.45, ease: "easeOutCubic" }))),
        ...[0, 1, 2, 3, 4, 5].map((i) => seq(wait(0.45 + i * 0.08), tween(`${u}-bar${i}`, { scaleY: 1 }, { duration: 0.5, ease: "easeOutBack" }))),
      );
    case "tv":
      return par(
        tween(`${u}-nav`, { x: 0, y: 0, opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "nav" }),
        seq(wait(0.1), tween(`${u}-banner`, { x: 0, y: 0, opacity: 1 }, { duration: 0.55, ease: "easeOutCubic", label: "banner" })),
        ...[0, 1, 2, 3].map((i) => seq(wait(0.35 + i * 0.1), tween(`${u}-tile${i}`, { scale: 1 }, { duration: 0.45, ease: "easeOutBack" }))),
      );
    case "foldable":
      return seq(
        tween(`${name}-x`, { scaleX: 1 }, { duration: 0.7, ease: "easeOutBack", label: "unfold" }),
        tween(`${name}-ui`, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad", label: "light" }),
      );
    case "terminal":
      return seq(
        ...[0, 1, 2, 3].map((i) => seq(wait(i === 0 ? 0.1 : 0.34), tween(`${u}-row${i}`, { opacity: 1 }, { duration: 0.16, ease: "linear" }))),
      );
    case "car":
      return par(
        tween(`${u}-route`, { progress: 1 }, { duration: 1.1, ease: "easeInOutCubic", label: "route" }),
        motionPath(`${u}-pin`, [[-300, 100], [-220, 20], [-120, 44], [-40, -30], [30, -74]], { duration: 1.1, ease: "easeInOutCubic", label: "drive" }),
        tween(`${u}-eta`, { x: 0, opacity: 1 }, { duration: 0.45, ease: "easeOutCubic", label: "eta" }),
        seq(wait(0.4), tween(`${u}-mediaslot`, { x: 0, opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "media" })),
      );
  }
}

// The inner `${name}-x` group (chassis + content plane), ready to drop into a
// positioned stage. `signature(name)` animates these stable ids.
export function deviceHero(name: DevicePresetName, accent: string, scale = heroScale(name)): NodeIR {
  const sc = deviceScreenCenter(name);
  const uiOpacity = name === "foldable" ? 0 : 1; // foldable's UI lights up after the unfold
  return group({ id: `${name}-x`, x: 0, y: 0, ...(XINIT[name] ?? {}) }, [
    devicePreset(name, { id: name, x: 0, y: 0, scale, content: [], screen: "#13161D" }),
    group({ id: `${name}-ui`, x: sc.x * scale, y: sc.y * scale, scale, opacity: uiOpacity }, heroContent(name, accent)),
  ]);
}
