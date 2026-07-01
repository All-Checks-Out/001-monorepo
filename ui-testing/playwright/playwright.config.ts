import { defineConfig, devices } from "@playwright/test";
import * as path from "node:path";

const baseURL = process.env.ACO_E2E_BASE_URL ?? "http://127.0.0.1:4173";
const uiTestRoot = __dirname;
const repoRoot = path.resolve(uiTestRoot, "../..");

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./setup/global-setup.ts",
  globalTeardown: "./setup/global-teardown.ts",
  outputDir: path.join(uiTestRoot, "results"),
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["html", { outputFolder: path.join(uiTestRoot, "report") }], ["list"]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bash ui-testing/playwright/scripts/start-ui-test-servers.sh",
    cwd: repoRoot,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
