// A short, loopable logo sting used to prove the standalone browser player:
// a gold mark punches in, the wordmark rises and settles. Pure + deterministic.
import { scene, group, rect, text, path, ellipse, seq, par, tween, wait } from "@reframe/core";

const S = 1080;
const GOLD = "#E9B949", BG = "#0B0D12", FG = "#F2EEE6";
const CX = S / 2;

export default scene({
  id: "sting",
  size: { width: S, height: S },
  fps: 30,
  background: BG,
  nodes: [
    // soft gold halo behind the mark
    ...Array.from({ length: 6 }, (_, i) => {
      const t = i / 5;
      return ellipse({ id: `glow${i}`, x: CX, y: 470, anchor: "center", width: 620 - t * 420, height: 620 - t * 420, fill: GOLD, opacity: 0.05 });
    }),
    // the mark: gold rounded square + play triangle (punches in)
    group({ id: "mark", x: CX, y: 470, scale: 0, rotation: -12, opacity: 0 }, [
      rect({ id: "m-sq", x: 0, y: 0, anchor: "center", width: 220, height: 220, radius: 50, fill: GOLD }),
      path({ id: "m-tri", d: "M-34 -46 L48 0 L-34 46 Z", x: 0, y: 0, fill: "#1A1407", originX: 0, originY: 0 }),
    ]),
    // wordmark + tagline (rise and settle)
    text({ id: "word", x: CX, y: 700, anchor: "center", content: "reframe", fontFamily: "Inter", fontSize: 98, fontWeight: 800, fill: FG, opacity: 0 }),
    text({ id: "tag", x: CX, y: 782, anchor: "center", content: "every frame is code", fontFamily: "Inter", fontSize: 30, fontWeight: 500, fill: GOLD, opacity: 0 }),
    // impact flash
    rect({ id: "flash", x: CX, y: CX, anchor: "center", width: S, height: S, fill: "#FFFFFF", opacity: 0 }),
  ],
  timeline: seq(
    wait(0.4),
    par(
      seq(
        tween("mark", { opacity: 1, scale: 1.12, rotation: 0 }, { duration: 0.45, ease: "easeOutBack" }),
        tween("mark", { scale: 1 }, { duration: 0.24, ease: "easeOutCubic" }),
      ),
      seq(wait(0.16), tween("flash", { opacity: 0.5 }, { duration: 0.08 }), tween("flash", { opacity: 0 }, { duration: 0.5 })),
      seq(wait(0.34), tween("word", { opacity: 1, y: 660 }, { duration: 0.5, ease: "easeOutCubic" })),
      seq(wait(0.58), tween("tag", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic" })),
    ),
    wait(2.0),
  ),
});
