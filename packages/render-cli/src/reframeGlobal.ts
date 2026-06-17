/** Shared declaration of the bridge the capture page exposes to the harness. */

import type { SceneIR } from "@reframe/core";

declare global {
  interface Window {
    __reframe: {
      /**
       * assets: raw image src → data URL; videoAssets: raw video src → array of
       * frame data URLs (index = source frame at fps). Both decoded before init resolves.
       */
      init(
        ir: SceneIR,
        assets?: Record<string, string>,
        videoAssets?: Record<string, string[]>,
      ): Promise<{ duration: number; fps: number }>;
      renderFrame(t: number): string;
    };
  }
}

export {};
