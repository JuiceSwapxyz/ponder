import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Stand in for the Ponder runtime virtual module so the real controller
      // can be imported and driven over HTTP in the harness.
      "ponder:api": fileURLToPath(
        new URL("./test/points/ponderApiStub.ts", import.meta.url),
      ),
      // Mirror tsconfig `@/* -> ./src/*` so source modules that import via the
      // `@` alias resolve under Vitest without per-test module shims.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    // The points harness talks to a real Postgres; keep files serial so the
    // shared fixture database is not raced between suites.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
