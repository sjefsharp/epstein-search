import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules", "dist", ".next", "worker", "tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/", "*.config.*", ".next/", "worker/"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 75,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
