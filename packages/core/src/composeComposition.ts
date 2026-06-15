/**
 * Composition layout: place each scene on a single timeline and report the
 * total duration. Pure data in, pure data out — like compileScene, this never
 * renders. Each scene is compiled independently (compileScene), so a scene's
 * frames inside a composition equal rendering it alone, offset by its `start`.
 */

import { compileScene, type CompiledScene } from "./compile.js";
import { DEFAULT_CROSSFADE, type CompositionIR, type SceneIR, type SceneTransition } from "./ir.js";

export interface ScenePlacement {
  id: string;
  scene: SceneIR;
  compiled: CompiledScene;
  /** Absolute start on the composition timeline (s). */
  start: number;
  /** The scene's own duration (s). */
  duration: number;
  transition: SceneTransition;
  /** Overlap with the previous scene (s); 0 for a cut. */
  overlap: number;
}

export interface CompiledComposition {
  ir: CompositionIR;
  scenes: ScenePlacement[];
  /** Total composition duration (s) — the end of the last scene. */
  duration: number;
}

export function compileComposition(comp: CompositionIR): CompiledComposition {
  const scenes: ScenePlacement[] = [];
  let prevEnd = 0;
  comp.scenes.forEach((entry, i) => {
    const compiled = compileScene(entry.scene);
    const duration = compiled.duration;
    const transition: SceneTransition = entry.transition ?? "cut";
    const append = i === 0 ? 0 : prevEnd;

    let start: number;
    if (typeof entry.at === "number") {
      start = entry.at; // absolute
    } else if (typeof entry.at === "string") {
      start = append + Number(entry.at); // "-0.5" overlaps, "+0.5" gaps
    } else if (transition === "crossfade" && i > 0) {
      start = append - DEFAULT_CROSSFADE;
    } else {
      start = append; // sequential cut
    }
    start = Math.max(0, start);

    const overlap = i > 0 ? Math.max(0, prevEnd - start) : 0;
    scenes.push({ id: entry.scene.id, scene: entry.scene, compiled, start, duration, transition, overlap });
    prevEnd = start + duration;
  });

  const duration = scenes.reduce((max, s) => Math.max(max, s.start + s.duration), 0);
  return { ir: comp, scenes, duration };
}
