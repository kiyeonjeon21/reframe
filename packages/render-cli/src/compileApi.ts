/**
 * `reframe-video/compile` — in-process scene loading for embedders (server /
 * Node-only). Bundle + evaluate + validate eDSL source into a SceneIR, with
 * classified, sanitized errors (`SceneLoadError.kind`). Lets a backend do
 * NL → eDSL → IR → (preview + diff) without shelling out to the CLI or
 * re-implementing the evaluator.
 *
 * Note: this executes the scene module in-process. Treat untrusted /
 * model-authored source as code: bound it (a timeout) and run it where a
 * misbehaving module can't do harm. True sandboxing is a separate concern.
 */
export { isComposition, loadModule, loadScene, loadSceneFromCode, SceneLoadError } from "./loadScene.js";
export { checkDeterminism } from "./determinism.js";
export type { ValidationIssue } from "@reframe/core";
