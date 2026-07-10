import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/component/**", "jsdom"]],
    setupFiles: ["tests/setup-component.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    env: {
      AUTH_SECRET: "test-auth-secret",
      AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      NEXT_PUBLIC_SERVER_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["features/**/*.ts", "lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
