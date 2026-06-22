// Depth of field (z-blur): a lens property layered on the 2.5D perspective. Three
// cards sit at increasing depth (z); `camera.aperture` softens everything off the
// focal plane, and animating `camera.focus` racks focus from the front card to the
// back one and back. The in-focus card is crisp while its neighbours blur by
// aperture·|depth − focus|. Renderer untouched — DOF just feeds the existing `blur`
// op field. Additive / golden-safe (no aperture ⇒ no blur).

import {
  scene, rect, text, group,
  seq, tween, wait,
  type NodeIR,
} from "@reframe/core";

const W = 1920, H = 1080;
const BG = "#0A0C14", FG = "#EDEFF5", DIM = "#8A93A8";

const CARDS = [
  { id: "front", z: 0, x: 620, color: "#FF5C7A", label: "z 0" },
  { id: "mid", z: 320, x: 960, color: "#6EA8FF", label: "z 320" },
  { id: "back", z: 680, x: 1320, color: "#3DDC97", label: "z 680" },
];

const nodes: NodeIR[] = [
  rect({ id: "bg", x: 0, y: 0, width: W, height: H, fill: BG }),
  // HUD text: `fixed` pins it to the screen (out of the camera) AND opts it out of
  // DOF — otherwise the title (at z 0) would soften whenever focus racks to a far plane.
  text({ id: "title", x: 120, y: 130, anchor: "center-left", fixed: true, content: "depth of field", fontFamily: "Inter", fontSize: 56, fontWeight: 800, fill: FG }),
  text({ id: "sub", x: 120, y: 190, anchor: "center-left", fixed: true, content: "camera.aperture softens off the focal plane; camera.focus racks through the stack", fontFamily: "Inter", fontSize: 24, fontWeight: 400, fill: DIM }),
];

for (const c of CARDS) {
  nodes.push(
    group({ id: `${c.id}-card`, x: c.x, y: 560, z: c.z }, [
      rect({ id: `${c.id}-bg`, x: 0, y: 0, width: 300, height: 380, anchor: "center", fill: c.color, radius: 28 }),
      text({ id: `${c.id}-label`, x: 0, y: 0, anchor: "center", content: c.label, fontFamily: "Inter", fontSize: 40, fontWeight: 800, fill: "#0A0C14" }),
    ]),
  );
}

export default scene({
  id: "dof-demo",
  size: { width: W, height: H },
  fps: 30,
  background: BG,
  // perspective on; aperture sets the DOF strength; focus starts on the front card.
  camera: { perspective: 1100, aperture: 0.05, focus: 0 },
  nodes,
  timeline: seq(
    wait(0.6),
    tween("camera", { focus: 680 }, { duration: 1.6, ease: "easeInOutCubic" }), // rack to the back card
    wait(0.5),
    tween("camera", { focus: 0 }, { duration: 1.6, ease: "easeInOutCubic" }), // and back to the front
    wait(0.5),
  ),
});
