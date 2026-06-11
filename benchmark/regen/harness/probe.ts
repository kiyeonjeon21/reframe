/**
 * Build a probe overlay that touches every stable address of a base scene:
 * every node id (a universal prop + a type-specific prop that doubles as a
 * type-change detector), every state name, every timeline label, and the
 * scene id via `target`. Composing it against a regenerated scene turns the
 * orphan report into a direct measurement of contract compliance.
 */

import type { NodeIR, OverlayDoc, PropValue, SceneIR, TimelineIR } from "@reframe/core";

/** Per node type: a harmless prop that exists only on that type. */
const TYPE_DETECTOR: Record<NodeIR["type"], { prop: string; fallback: PropValue } | null> = {
  rect: { prop: "radius", fallback: 0 },
  ellipse: { prop: "strokeWidth", fallback: 1 },
  line: { prop: "strokeWidth", fallback: 1 },
  text: { prop: "fontSize", fallback: 16 },
  group: null, // groups only have common props — type changes undetectable (documented limitation)
};

export function buildProbeOverlay(base: SceneIR): OverlayDoc {
  const nodes: NonNullable<OverlayDoc["nodes"]> = {};
  const collect = (list: NodeIR[]) => {
    for (const node of list) {
      const props = node.props as unknown as Record<string, PropValue | undefined>;
      const patch: Record<string, PropValue> = {
        opacity: typeof props.opacity === "number" ? props.opacity : 1,
      };
      const detector = TYPE_DETECTOR[node.type];
      if (detector) {
        patch[detector.prop] = props[detector.prop] ?? detector.fallback;
      }
      nodes[node.id] = patch;
      if (node.type === "group") collect(node.children);
    }
  };
  collect(base.nodes);

  const states: NonNullable<OverlayDoc["states"]> = {};
  for (const [stateName, override] of Object.entries(base.states ?? {})) {
    const firstNode = Object.keys(override)[0];
    if (!firstNode) continue;
    const firstProp = Object.keys(override[firstNode]!)[0];
    if (!firstProp) continue;
    states[stateName] = { [firstNode]: { [firstProp]: override[firstNode]![firstProp]! } };
  }

  const timeline: NonNullable<OverlayDoc["timeline"]> = {};
  const walkTimeline = (tl: TimelineIR) => {
    if ("label" in tl && tl.label !== undefined && tl.kind !== "seq" && tl.kind !== "par") {
      timeline[tl.label] = { duration: tl.duration ?? 0.5 };
    }
    if ("children" in tl) tl.children.forEach(walkTimeline);
  };
  if (base.timeline) walkTimeline(base.timeline);

  return {
    reframeOverlay: 1,
    name: "probe",
    target: base.id,
    nodes,
    ...(Object.keys(states).length > 0 && { states }),
    ...(Object.keys(timeline).length > 0 && { timeline }),
  };
}

/** Count of distinct probe addresses (for integrity checking). */
export function probeAddressCount(probe: OverlayDoc): number {
  let count = 0;
  for (const patch of Object.values(probe.nodes ?? {})) count += Object.keys(patch).length;
  for (const statePatch of Object.values(probe.states ?? {})) {
    for (const nodePatch of Object.values(statePatch)) count += Object.keys(nodePatch).length;
  }
  for (const patch of Object.values(probe.timeline ?? {})) count += Object.keys(patch).length;
  return count;
}
