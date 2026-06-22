// Design tokens, deferred and re-skinnable. Every color on this card is a
// `token("color.…")` ref, not a literal — the compiler resolves it against the
// scene's design (falling back to the house brand). Re-skin the whole card by
// patching design tokens in an overlay, no edit to the scene itself:
//   reframe frame themed-card.ts --t 1
//   reframe frame themed-card.ts --t 1 --overlay examples/overlays/themed-card-reskin.json
// The overlay address `design.color.accent` survives an AI regen of the base.

import { scene, rect, text, token, seq, par, tween, wait } from "@reframe/core";

const W = 1920, H = 1080, CX = 960, CY = 540;

export default scene({
  id: "themed-card",
  size: { width: W, height: H },
  fps: 30,
  background: "#000000",
  nodes: [
    // full-bleed themed background (scene `background` tokens are a later phase)
    rect({ id: "stage", x: 0, y: 0, width: W, height: H, fill: token("color.bg") }),
    rect({ id: "card", x: CX, y: CY, width: 760, height: 380, radius: 24, anchor: "center", opacity: 0, scale: 0.94,
      fill: token("color.surface"), shadowColor: "#04060C", shadowBlur: 60, shadowY: 30 }),
    rect({ id: "bar", x: CX - 340, y: CY - 150, width: 8, height: 120, anchor: "top-left", opacity: 0, fill: token("color.accent") }),
    text({ id: "title", x: CX - 300, y: CY - 110, anchor: "center-left", opacity: 0,
      content: "On brand, by token", fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: token("color.fg") }),
    text({ id: "sub", x: CX - 300, y: CY - 36, anchor: "center-left", opacity: 0,
      content: "every color is token(...), re-skinnable via overlay", fontFamily: "Inter", fontSize: 24, fontWeight: 500, fill: token("color.muted") }),
    rect({ id: "chip", x: CX - 300, y: CY + 56, width: 150, height: 44, radius: 22, anchor: "top-left", opacity: 0, fill: token("color.accent") }),
    text({ id: "chiptext", x: CX - 225, y: CY + 78, anchor: "center", opacity: 0,
      content: "Accent", fontFamily: "Inter", fontSize: 20, fontWeight: 700, fill: token("color.bg") }),
  ],

  timeline: seq(
    wait(0.2),
    par(
      tween("card", { opacity: 1, scale: 1 }, { duration: 0.6, ease: "easeOutBack", label: "card-in" }),
      seq(wait(0.15), par(
        tween("bar", { opacity: 1 }, { duration: 0.4, ease: "easeOutCubic", label: "bar-in" }),
        tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "title-in" }),
        tween("sub", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "sub-in" }),
        tween("chip", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "chip-in" }),
        tween("chiptext", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "chiptext-in" }),
      )),
    ),
    wait(1.4),
  ),
});
