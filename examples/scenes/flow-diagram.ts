import {
  scene,
  rect,
  line,
  ellipse,
  text,
  seq,
  par,
  stagger,
  tween,
  wait,
  motionPath,
  type NodeIR,
} from "@reframe/core";

// "Pipeline" — a system-architecture explainer. Service boxes pop in, the
// connectors DRAW ON (`line` `progress` 0→1), then data "packets" stream through
// along the pipeline via `motionPath`, while a throughput counter counts up
// (`text` numeric `content` + `suffix`). Probes: the flow/diagram genre (0 scenes),
// `progress` draw-on + `motionPath` packet flow + count-up, all addressable.

const Y = 520;
const STAGES = [
  { id: "client", label: "Client", x: 250, c: "#6EA8FF" },
  { id: "api", label: "API Gateway", x: 620, c: "#8C7BFF" },
  { id: "queue", label: "Queue", x: 990, c: "#54D6C0" },
  { id: "worker", label: "Worker", x: 1360, c: "#FFC861" },
  { id: "db", label: "Postgres", x: 1690, c: "#FF8FB0" },
];
const BW = 200;
const BH = 96;

const boxes: NodeIR[] = STAGES.flatMap((s) => [
  rect({ id: `box-${s.id}`, x: s.x, y: Y, width: BW, height: BH, radius: 16, anchor: "center", fill: "#141A2C", stroke: s.c, strokeWidth: 2.5, opacity: 0, scale: 0.85 }),
  text({ id: `lbl-${s.id}`, x: s.x, y: Y, anchor: "center", content: s.label, fontFamily: "Inter", fontSize: 26, fontWeight: 700, fill: "#EAF0FF", opacity: 0 }),
]);

// connectors between consecutive boxes (edge to edge)
const links: NodeIR[] = STAGES.slice(0, -1).map((s, i) => {
  const n = STAGES[i + 1]!;
  return line({ id: `link-${i}`, x1: s.x + BW / 2, y1: Y, x2: n.x - BW / 2, y2: Y, stroke: "#3A4868", strokeWidth: 3, progress: 0 });
});

// the route a packet takes through the whole pipeline (box centres)
const ROUTE: [number, number][] = STAGES.map((s) => [s.x, Y]);
const PACKETS = 7;

export default scene({
  id: "flow-diagram",
  size: { width: 1920, height: 1080 },
  fps: 30,
  background: "#080B16",
  nodes: [
    text({ id: "title", x: 960, y: 180, anchor: "center", content: "REQUEST PIPELINE", fontFamily: "Inter", fontSize: 52, fontWeight: 800, fill: "#EAF0FF", letterSpacing: 6, opacity: 0 }),
    ...links,
    ...boxes,
    // packets (drawn above the links), start hidden at the source
    ...Array.from({ length: PACKETS }, (_, i) =>
      ellipse({ id: `pkt-${i}`, x: STAGES[0]!.x, y: Y, width: 16, height: 16, anchor: "center", fill: "#FFFFFF", blend: "screen", opacity: 0 }),
    ),
    // throughput counter
    text({ id: "tput", x: 960, y: 760, anchor: "center", content: 0, contentThousands: true, suffix: " req/s", fontFamily: "Inter", fontSize: 64, fontWeight: 800, fill: "#54D6C0", opacity: 0 }),
    text({ id: "tput-cap", x: 960, y: 820, anchor: "center", content: "throughput", fontFamily: "Inter", fontSize: 22, fill: "#7E88A8", letterSpacing: 3, opacity: 0 }),
  ],

  timeline: seq(
    wait(0.2),
    tween("title", { opacity: 1 }, { duration: 0.5, ease: "easeOutQuad", label: "title" }),
    // 1 — boxes pop in left to right
    stagger(0.12, ...STAGES.map((s) => par(
      tween(`box-${s.id}`, { opacity: 1, scale: 1 }, { duration: 0.4, ease: "easeOutBack" }),
      tween(`lbl-${s.id}`, { opacity: 1 }, { duration: 0.4, ease: "easeOutQuad" }),
    ))),
    // 2 — connectors draw on
    stagger(0.1, ...links.map((l, i) => tween(l.id, { progress: 1 }, { duration: 0.35, ease: "easeInOutCubic", label: `wire-${i}` }))),
    // 3 — packets stream through the pipeline + counter spins up
    par(
      stagger(0.28, ...Array.from({ length: PACKETS }, (_, i) => seq(
        tween(`pkt-${i}`, { opacity: 1 }, { duration: 0.12 }),
        motionPath(`pkt-${i}`, ROUTE, { duration: 2.0, ease: "easeInOutCubic", curviness: 0 }),
        tween(`pkt-${i}`, { opacity: 0 }, { duration: 0.12 }),
      ))),
      seq(
        par(
          tween("tput", { opacity: 1 }, { duration: 0.4 }),
          tween("tput-cap", { opacity: 1 }, { duration: 0.4 }),
        ),
        tween("tput", { content: 48200 }, { duration: 2.6, ease: "easeOutCubic", label: "count" }),
      ),
    ),
    wait(1.0, "hold"),
    par(
      ...STAGES.map((s) => tween(`box-${s.id}`, { opacity: 0 }, { duration: 0.5, ease: "easeInQuad" })),
      ...STAGES.map((s) => tween(`lbl-${s.id}`, { opacity: 0 }, { duration: 0.5 })),
      ...links.map((l) => tween(l.id, { progress: 0 }, { duration: 0.5 })),
      tween("title", { opacity: 0 }, { duration: 0.5 }),
      tween("tput", { opacity: 0 }, { duration: 0.5 }),
      tween("tput-cap", { opacity: 0 }, { duration: 0.5 }),
    ),
  ),
});
