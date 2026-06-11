/**
 * Asset discovery shared by every consumer that must preload images before
 * rendering (the capture page and the preview). One walker means the two
 * sides can never disagree about which srcs a scene uses — including srcs
 * introduced only mid-scene by a state override or a tween.
 */

import type { NodeIR, SceneIR, TimelineIR } from "./ir.js";

/** All image srcs a scene can ever display, deduped, in discovery order. */
export function collectImageSrcs(ir: SceneIR): string[] {
  const srcs = new Set<string>();
  const imageIds = new Set<string>();

  const walkNodes = (nodes: NodeIR[]) => {
    for (const node of nodes) {
      if (node.type === "image") {
        imageIds.add(node.id);
        srcs.add(node.props.src);
      }
      if (node.type === "group") walkNodes(node.children);
    }
  };
  walkNodes(ir.nodes);

  for (const overrides of Object.values(ir.states ?? {})) {
    for (const [nodeId, props] of Object.entries(overrides)) {
      if (imageIds.has(nodeId) && typeof props.src === "string") srcs.add(props.src);
    }
  }

  const walkTimeline = (step: TimelineIR | undefined) => {
    if (!step) return;
    if (step.kind === "seq" || step.kind === "par" || step.kind === "stagger") {
      for (const child of step.children) walkTimeline(child);
    } else if (step.kind === "tween" && imageIds.has(step.target)) {
      const src = step.props.src;
      if (typeof src === "string") srcs.add(src);
    }
  };
  walkTimeline(ir.timeline);

  return [...srcs];
}
