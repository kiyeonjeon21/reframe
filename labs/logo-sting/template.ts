import { scene, rect, path, text, group, seq, par, tween, wait, motionPreset, type PresetName, type PresetRig, type SceneIR } from "@reframe/core";

// A logo sting as a pure function of data + a named motion preset. The logo
// rig (fills + outline inks) is built here; the actual choreography is chosen
// from the motion vocabulary (motionPreset) so the same logo can swoop, pop,
// rise, spin, etc. Everything stays deterministic; a seed varies the motion
// within its family.

export interface LogoStingData {
  name: string;
  paths: { d: string; fill: string }[];
  viewBox: { minX: number; minY: number; w: number; h: number };
  /** Motion preset + knobs (the vocabulary). Defaults to reveal-orbit. */
  motion?: PresetName;
  energy?: number;
  speed?: number;
  intensity?: number;
  from?: "left" | "right" | "top" | "bottom";
  seed?: number;
}

const BG = "#0D1117";
const FG = "#E6EDF3";
const MUTED = "#8B949E";
const LOGO_PX = 520; // target on-screen size of the mark's longest side

export function buildLogoSting(d: LogoStingData): SceneIR {
  const W = 1080;
  const H = 1080;
  const CX = 540;
  const CY = 500; // a little high — leaves room for the wordmark
  const vcx = d.viewBox.minX + d.viewBox.w / 2;
  const vcy = d.viewBox.minY + d.viewBox.h / 2;
  const fit = LOGO_PX / Math.max(d.viewBox.w, d.viewBox.h);
  const sw = 2.2 / fit; // ~2px once the group is scaled by `fit`

  // Two layers per sub-path: a fill (blooms) and an outline ink (draws on).
  const fills = d.paths.map((p, i) =>
    path({ id: `fill-${i}`, d: p.d, originX: vcx, originY: vcy, x: 0, y: 0, fill: p.fill, opacity: 0 }),
  );
  const inks = d.paths.map((p, i) =>
    path({ id: `ink-${i}`, d: p.d, originX: vcx, originY: vcy, x: 0, y: 0, stroke: p.fill, strokeWidth: sw, progress: 0 }),
  );

  const rig: PresetRig = {
    group: "logo",
    center: [CX, CY],
    baseScale: fit,
    fills: fills.map((n) => n.id),
    inks: inks.map((n) => n.id),
  };

  return scene({
    id: "logo-sting",
    size: { width: W, height: H },
    fps: 30,
    background: BG,
    nodes: [
      rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: BG }),
      group({ id: "logo", x: CX, y: CY, scale: fit }, [...fills, ...inks]),
      text({ id: "word", x: CX, y: 905, anchor: "center", content: d.name, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: FG, opacity: 0 }),
      text({ id: "made", x: CX, y: 968, anchor: "center", content: "made with reframe", fontFamily: "Inter", fontSize: 20, fill: MUTED, opacity: 0 }),
    ],
    timeline: seq(
      // the logo's entrance is chosen from the motion vocabulary
      motionPreset(d.motion ?? "reveal-orbit", {
        target: rig,
        ...(d.energy !== undefined && { energy: d.energy }),
        ...(d.speed !== undefined && { speed: d.speed }),
        ...(d.intensity !== undefined && { intensity: d.intensity }),
        ...(d.from !== undefined && { from: d.from }),
        ...(d.seed !== undefined && { seed: d.seed }),
      }),
      // then the wordmark settles in
      par(
        tween("word", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "word" }),
        seq(wait(0.2), tween("made", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" })),
      ),
      wait(0.8, "hold"),
    ),
  });
}
