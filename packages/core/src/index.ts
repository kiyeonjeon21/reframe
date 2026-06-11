export * from "./ir.js";
export * from "./dsl.js";
export { validateScene, SceneValidationError } from "./validate.js";
export { compileScene, type CompiledScene, type PropertySegment } from "./compile.js";
export {
  evaluate,
  type DisplayList,
  type DisplayOp,
  type Mat2D,
  type TextAlign,
  type TextBaseline,
} from "./evaluate.js";
export { resolveEase, lerpValue, isColor } from "./interpolate.js";
export { sampleBehavior } from "./behaviors.js";
