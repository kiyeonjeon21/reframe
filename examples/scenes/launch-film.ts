/**
 * launch-film — an indie-SaaS launch film as code. Everything that changes per
 * brand is an ADDRESS: the copy (`title`), the hero number (`numberRoll`), and the
 * colors (`token()` → `design.*`). So one scene + one data file → N on-brand films:
 *
 *   reframe batch launch-film.ts ../data/launch-brands.json
 *     → out/launch-film-drift.mp4 / -forge.mp4 / -lumen.mp4 (3 brands, one command)
 *
 * Or re-skin a single brand kit:  reframe render launch-film.ts --theme drift.json
 * Edit by hand or by prompt; the edits survive an AI regen (stable addresses).
 */
import { scene, par, seq, wait, tween, rect, text, title, numberRoll, token } from "@reframe/core";

const W = 1920;
const H = 1080;
const CX = W / 2;

// 1 — brand wordmark (cold open)
const mark = title({
  text: "Drift",
  id: "brandmark",
  x: CX,
  y: 470,
  fontSize: 168,
  fontWeight: 800,
  fill: token("color.fg"),
  entrance: "rise",
  seed: 5,
});

// 2 — value-prop headline
const head = title({
  text: "Analytics that fit your stack",
  id: "headline",
  x: CX,
  y: 540,
  fontSize: 84,
  fontWeight: 800,
  fill: token("color.fg"),
  entrance: "rise",
  seed: 9,
});

// 3 — the proof stat (rolls like an odometer)
const kpi = numberRoll({
  id: "kpi",
  value: 2400000,
  x: CX,
  y: 500,
  fontSize: 220,
  fontWeight: 800,
  fill: token("color.fg"),
  dur: 1.7,
});

// 4 — call to action. Accent-colored TEXT (no fixed-width pill): the CTA copy is
// editable per brand, so wrapping it in a fixed-size chip would clip a longer
// phrase ("Get observability") — content-editable elements must not be boxed in
// fixed chrome. The accent fill re-skins with the brand token.
const cta = title({
  text: "Start free",
  id: "cta",
  x: CX,
  y: 540,
  fontSize: 112,
  fontWeight: 800,
  fill: token("color.accent"),
  entrance: "rise",
  seed: 2,
});

export default scene({
  id: "launch-film",
  size: { width: W, height: H },
  background: token("color.bg"),
  nodes: [
    ...mark.nodes,
    // accent rule under the wordmark (grows from center)
    rect({ id: "rule", x: CX, y: 590, width: 360, height: 8, radius: 4, anchor: "center", fill: token("color.accent"), scaleX: 0 }),
    ...head.nodes,
    kpi.node,
    // kicker label under the stat (token accent so it re-skins)
    text({ id: "kicker", x: CX, y: 660, content: "EVENTS TRACKED / MONTH", fontFamily: "Inter", fontSize: 34, fontWeight: 700, fill: token("color.accent"), letterSpacing: 8, anchor: "center", opacity: 0 }),
    ...cta.nodes,
  ],
  timeline: par(
    // ACT 1 — wordmark
    seq(
      mark.timeline,
      par(tween("rule", { scaleX: 1 }, { duration: 0.6, ease: "easeOutCubic", label: "rule-draw" })),
      wait(1.4),
      par(
        tween("brandmark", { opacity: 0, y: 440 }, { duration: 0.5, ease: "easeInCubic", label: "brandmark-out" }),
        tween("rule", { opacity: 0 }, { duration: 0.4 }),
      ),
    ),
    // ACT 2 — promise
    seq(
      wait(3.2),
      head.timeline,
      wait(2.6),
      tween("headline", { opacity: 0, y: 500 }, { duration: 0.5, ease: "easeInCubic", label: "headline-out" }),
    ),
    // ACT 3 — proof stat (hidden until its beat, then rolls)
    seq(
      tween("kpi", { opacity: 0 }, { duration: 0.001 }),
      wait(7.0),
      par(
        tween("kpi", { opacity: 1 }, { duration: 0.4 }),
        kpi.timeline,
        seq(wait(0.5), tween("kicker", { opacity: 1 }, { duration: 0.5, ease: "easeOutCubic", label: "kicker-in" })),
      ),
      wait(1.4),
      par(
        tween("kpi", { opacity: 0 }, { duration: 0.5, ease: "easeInCubic", label: "kpi-out" }),
        tween("kicker", { opacity: 0 }, { duration: 0.4 }),
      ),
    ),
    // ACT 4 — CTA (KPI has fully cleared by 10.6; CTA enters at 11.0)
    seq(
      wait(11.0),
      cta.timeline,
      wait(2.5),
    ),
  ),
});
