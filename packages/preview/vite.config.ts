import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    fs: { allow: [resolve(__dirname, "..", "..")] },
  },
});
