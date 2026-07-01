import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectPath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "@shared/permissions",
          root: projectPath("packages/shared/permissions"),
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: projectPath("apps/core/vite.config.ts"),
        test: {
          name: "@apps/core",
          root: projectPath("apps/core"),
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "@services/onboarding-service",
          root: projectPath("services/onboarding-service"),
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
