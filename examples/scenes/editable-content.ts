/**
 * editable-by-default — a headline + hero number authored as LIVE GENERATORS, so
 * the two things a human (or a regen, or a `batch` row) most wants to change have
 * STABLE CONTENT ADDRESSES that survive an AI regeneration:
 *
 *   - the headline copy   → patch  nodes.headline.text   (title re-splits + reflows)
 *   - the hero number     → patch  nodes.balance.value   (numberRoll rebuilds the reels)
 *   - the brand accent    → patch  design.color.accent   (token() re-skin)
 *
 * Try it:  reframe frame editable-content.ts --overlay ../overlays/content-edit.json --t 3 -o edited.png
 * The overlay flips the headline, the number, and the accent — none of it baked,
 * none of it orphaned. Compare with --overlay omitted.
 */
import { scene, par, seq, wait, tween, text, title, numberRoll, token } from "@reframe/core";

const head = title({
  text: "Money, reimagined",
  id: "headline",
  x: 540,
  y: 330,
  fontSize: 84,
  fontWeight: 800,
  fill: "#FFFFFF",
  entrance: "rise",
  seed: 3,
});

const balance = numberRoll({
  id: "balance",
  value: 128450,
  x: 540,
  y: 620,
  fontSize: 132,
  fontWeight: 800,
  fill: "#FFFFFF",
  prefix: "$",
  dur: 1.6,
});

export default scene({
  id: "editable-content",
  size: { width: 1080, height: 1080 },
  background: "#0A0C14",
  nodes: [
    ...head.nodes,
    balance.node,
    // accent label via token() → re-skinnable with --theme / design.color.accent
    text({
      id: "kicker",
      x: 540,
      y: 730,
      content: "TOTAL BALANCE",
      fontFamily: "Inter",
      fontSize: 26,
      fontWeight: 700,
      fill: token("color.accent"),
      letterSpacing: 6,
      anchor: "center",
      opacity: 0,
    }),
  ],
  timeline: par(
    head.timeline,
    balance.timeline,
    seq(wait(1.6), tween("kicker", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "kicker-in" })),
  ),
});
