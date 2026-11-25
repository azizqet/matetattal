import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["unit/**/*.test.ts", "backend/**/*.test.ts", "e2e/**/*.test.ts", "backup/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
