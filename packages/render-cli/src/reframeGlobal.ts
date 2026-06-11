/** Shared declaration of the bridge the capture page exposes to the harness. */

import type { SceneIR } from "@reframe/core";

declare global {
  interface Window {
    __reframe: {
      init(ir: SceneIR): { duration: number; fps: number };
      renderFrame(t: number): string;
    };
  }
}

export {};
