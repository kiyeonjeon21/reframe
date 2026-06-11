declare module "virtual:reframe-user-scenes" {
  import type { SceneIR } from "@reframe/core";
  export const userScenes: { name: string; load: () => Promise<{ default: SceneIR }> }[];
}
