export * from "./ir.js";
export * from "./dsl.js";
export { validateScene, SceneValidationError, PROPS_BY_TYPE } from "./validate.js";
export {
  composeScene,
  formatComposeReport,
  type OverlayDoc,
  type ComposeReport,
} from "./compose.js";
export { compileScene, type CompiledScene, type PropertySegment, type LabelSpan, type MotionDriver } from "./compile.js";
export { pathPoint, pathTangentAngle, type Pt } from "./path.js";
export {
  resolveAudioPlan,
  SFX_DURATION,
  type AudioPlan,
  type ResolvedCue,
} from "./audio.js";
export {
  evaluate,
  type DisplayList,
  type DisplayOp,
  type Mat2D,
  type TextAlign,
  type TextBaseline,
} from "./evaluate.js";
export { resolveEase, lerpValue, isColor, EASE_NAMES } from "./interpolate.js";
export { sampleBehavior } from "./behaviors.js";
export { collectImageSrcs } from "./assets.js";
export {
  sketchToTimeline,
  type MotionSketch,
  type MotionEvent,
  type MotionEventKind,
  type MotionRegion,
} from "./motion.js";
