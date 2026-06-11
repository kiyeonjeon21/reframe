declare module "virtual:reframe-user-scenes" {
  import type { SceneIR } from "@reframe/core";
  export const userScenes: {
    name: string;
    /** Absolute directory containing the scene file. */
    dir: string;
    load: () => Promise<{ default: SceneIR }>;
  }[];
}

/** Absolute path of examples/scenes (injected by vite define; "" when packaged). */
declare const __REFRAME_EXAMPLES_DIR__: string;
