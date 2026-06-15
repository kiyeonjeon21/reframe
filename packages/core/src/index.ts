export * from "./ir.js";
export * from "./dsl.js";
export { validateScene, validateComposition, SceneValidationError, PROPS_BY_TYPE } from "./validate.js";
export {
  compileComposition,
  type CompiledComposition,
  type ScenePlacement,
} from "./composeComposition.js";
export {
  composeScene,
  formatComposeReport,
  type OverlayDoc,
  type ComposeReport,
} from "./compose.js";
export { compileScene, type CompiledScene, type PropertySegment, type LabelSpan, type MotionDriver } from "./compile.js";
export { pathPoint, pathTangentAngle, type Pt } from "./path.js";
export { motionPreset, PRESET_NAMES, type PresetName, type PresetRig, type PresetOpts } from "./presets.js";
export { devicePreset, deviceScreen, DEVICE_PRESET_NAMES, type DevicePresetName, type DevicePresetOpts } from "./devicePreset.js";
export { motionOp, motionOpLabel, MOTION_OPS, type MotionOpName, type MotionOpOpts, type MotionOpResult } from "./motionOps.js";
export {
  resolveAudioPlan,
  resolveCompositionAudioPlan,
  SFX_DURATION,
  type AudioPlan,
  type ResolvedCue,
} from "./audio.js";
export {
  evaluate,
  sampleProp,
  nodeParentMatrix,
  type DisplayList,
  type DisplayOp,
  type Mat2D,
  type ClipRegion,
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
