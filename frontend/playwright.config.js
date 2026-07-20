import { defineConfig, devices } from "@playwright/test";

// Smoke tests intercept every /api/* call (see tests-e2e/mocks.js) so they
// never touch a real backend or MongoDB - this keeps them fast, deterministic,
// and runnable in CI without provisioning a database. They verify the UI
// renders, navigates, and wires up requests correctly - not full end-to-end
// backend integration (that's covered by the Vitest backend test suite).
export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});