// Depth-ordered paint (camera.zSort): nearer nodes occlude farther ones by their
// world `z`, without hand-ordering the tree. Three overlapping cards; the middle
// one's `z` animates from behind the stack to in front of it, so the paint order
// re-sorts every frame — it slides from fully occluded to fully on top. With zSort
// off, paint would stay array order and the depth would read wrong. Opt-in, so
// scenes that don't set zSort are byte-identical.

import {
  scene, rect, text, group,
  seq, tween, wait,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", FG = "#EDEFF5", DIM = "#8A93A8";

// overlapping cards across the centre; A and C hold still, B travels in depth.
const STATIC = [
  { id: "A", x: 760, z: 300, color: "#6EA8FF" },
  { id: "C", x: 1160, z: 300, color: "#3DDC97" },
];

const cardGroup = (id: string, x: number, z: number, color: string, label: string): NodeIR =>
  group({ id: `${id}-card`, x, y: 560, z }, [
    rect({ id: `${id}-bg`, x: 0, y: 0, width: 300, height: 420, anchor: "center", fill: color, radius: 28 }),
    text({ id: `${id}-label`, x: 0, y: 0, anchor: "center", content: label, fontFamily: "Inter", fontSize: 44, fontWeight: 800, fill: "#0A0C14" }),
  ]);

const nodes: NodeIR[] = [
  // no full-screen background rect here: under zSort a z:0 rect is the NEAREST plane and
  // would paint on top of everything. The scene `background` fills behind the stack instead.
  text({ id: "title", x: 120, y: 130, anchor: "center-left", fixed: true, content: "z-sort occlusion", fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: FG }),
  text({ id: "sub", x: 120, y: 190, anchor: "center-left", fixed: true, content: "the middle card's z travels front-to-back — paint order re-sorts every frame", fontFamily: "Inter", fontSize: 24, fontWeight: 400, fill: DIM }),
  ...STATIC.map((c) => cardGroup(c.id, c.x, c.z, c.color, c.id)),
  // B is declared LAST (so without zSort it would always paint on top) but starts far.
  cardGroup("B", 960, 700, "#FF5C7A", "B"),
];

export default scene({
  id: "zsort-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  camera: { perspective: 1200, zSort: true },
  nodes,
  timeline: seq(
    wait(0.6),
    // B travels from behind the stack (z 700) to in front of it (z -100)
    tween("B-card", { z: -100 }, { duration: 2.2, ease: "easeInOutCubic" }),
    wait(0.4),
    tween("B-card", { z: 700 }, { duration: 2.2, ease: "easeInOutCubic" }), // and back behind
    wait(0.4),
  ),
});
