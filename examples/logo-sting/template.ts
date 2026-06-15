import { scene, rect, path, text, group, seq, par, stagger, tween, wait, motionPath, type SceneIR } from "@reframe/core";

// A logo sting as a pure function of data: the outline draws itself on, the
// fill blooms, the mark swoops along a curve while it zooms, then settles under
// a wordmark. generate.mts feeds a parsed SVG; everything here is deterministic.

export interface LogoStingData {
  name: string;
  paths: { d: string; fill: string }[];
  viewBox: { minX: number; minY: number; w: number; h: number };
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
  const z = (k: number) => fit * k; // scale relative to the fitted size

  // Two layers per sub-path: a fill (blooms) and an outline ink (draws on).
  const fills = d.paths.map((p, i) =>
    path({ id: `fill-${i}`, d: p.d, originX: vcx, originY: vcy, x: 0, y: 0, fill: p.fill, opacity: 0 }),
  );
  const inks = d.paths.map((p, i) =>
    path({ id: `ink-${i}`, d: p.d, originX: vcx, originY: vcy, x: 0, y: 0, stroke: p.fill, strokeWidth: sw, progress: 0 }),
  );

  return scene({
    id: "logo-sting",
    size: { width: W, height: H },
    fps: 30,
    background: BG,
    nodes: [
      rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: BG }),
      // the group carries fit + zoom + the swoop; children pivot at the mark centre
      group({ id: "logo", x: CX, y: CY, scale: fit }, [...fills, ...inks]),
      text({ id: "word", x: CX, y: 905, anchor: "center", content: d.name, fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: FG, opacity: 0 }),
      text({ id: "made", x: CX, y: 968, anchor: "center", content: "made with reframe", fontFamily: "Inter", fontSize: 20, fill: MUTED, opacity: 0 }),
    ],
    timeline: seq(
      wait(0.3),
      // 1) the outline draws itself on
      stagger(0.15, ...inks.map((_, i) =>
        tween(`ink-${i}`, { progress: 1 }, { duration: 1.3, ease: "easeInOutQuad", ...(i === 0 && { label: "draw" }) }),
      )),
      // 2) the fill blooms in
      stagger(0.08, ...fills.map((_, i) =>
        tween(`fill-${i}`, { opacity: 1 }, { duration: 0.45, ease: "easeOutQuad", ...(i === 0 && { label: "fill" }) }),
      )),
      // 3) hero move: swoop along a curve while it zooms (the MotionPath beat)
      par(
        motionPath("logo", [[CX, CY], [CX - 230, CY - 160], [CX + 250, CY - 200], [CX, CY]], { duration: 1.7, ease: "easeInOutCubic", label: "swoop" }),
        seq(
          tween("logo", { scale: z(1.22) }, { duration: 0.85, ease: "easeOutBack" }),
          tween("logo", { scale: z(1) }, { duration: 0.85, ease: "easeInOutQuad" }),
        ),
      ),
      // 4) wordmark in, with a slow Ken Burns settle
      par(
        tween("word", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "word" }),
        seq(wait(0.2), tween("made", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad" })),
        tween("logo", { scale: z(1.05) }, { duration: 2.4, ease: "easeInOutQuad", label: "drift" }),
      ),
      wait(0.8, "hold"),
    ),
  });
}
