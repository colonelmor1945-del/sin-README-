import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` exists to make a build fail when a server module is
      // imported into a client bundle. Under Vitest there is no client bundle,
      // so it is stubbed out. This does not weaken the guarantee: the real
      // check still runs in `next build`, which is where it matters.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
